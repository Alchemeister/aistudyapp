import type { VercelRequest, VercelResponse } from '@vercel/node';

// Server-side AI generation endpoint
// Keeps Gemini API key secret and enforces subscription/credit limits

const GEMINI_API_KEY = process.env.VITE_AI_SERVICE_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Debug logging for deployment troubleshooting
console.log('[generate.ts] Startup check:', {
  hasGeminiKey: !!GEMINI_API_KEY,
  geminiKeyLength: GEMINI_API_KEY?.length || 0,
  hasFirebaseServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
  firebaseServiceAccountLength: process.env.FIREBASE_SERVICE_ACCOUNT?.length || 0,
});

// Firebase Admin - lazy initialization to avoid ESM import issues
let admin: any = null;
let firebaseAdminInitialized = false;

async function initFirebaseAdmin() {
  if (firebaseAdminInitialized) return admin;

  try {
    // Dynamic import for ESM compatibility
    const firebaseAdmin = await import('firebase-admin');
    admin = firebaseAdmin.default || firebaseAdmin;

    console.log('[generate.ts] firebase-admin module loaded, apps:', admin?.apps?.length || 0);

    if (!admin?.apps?.length) {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (serviceAccount) {
        try {
          admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccount)),
          });
          console.log('[generate.ts] Firebase Admin initialized successfully');
        } catch (e) {
          console.error('[generate.ts] Firebase Admin init failed:', e instanceof Error ? e.message : 'Unknown error');
        }
      } else {
        console.warn('[generate.ts] FIREBASE_SERVICE_ACCOUNT env var not set');
      }
    }
    firebaseAdminInitialized = true;
  } catch (e) {
    console.error('[generate.ts] Failed to load firebase-admin:', e instanceof Error ? e.message : 'Unknown error');
  }

  return admin;
}

// Content types that require Pro subscription
const PRO_ONLY_TYPES = ['concept_connections', 'mock_test', 'ai_tutor'];

// Generation limits
const FREE_MONTHLY_LIMIT = 50;
const PRO_MONTHLY_LIMIT = 500;

// Verify Firebase auth token
async function verifyAuth(authHeader: string | undefined): Promise<{ uid: string; email: string } | null> {
  console.log('[generate.ts] verifyAuth called, hasAuthHeader:', !!authHeader, 'startsWithBearer:', authHeader?.startsWith('Bearer '));

  if (!authHeader?.startsWith('Bearer ')) {
    console.log('[generate.ts] Auth failed: No Bearer token');
    return null;
  }
  const token = authHeader.slice(7);
  console.log('[generate.ts] Token length:', token.length);

  // Initialize Firebase Admin
  const adminSdk = await initFirebaseAdmin();

  // If Firebase Admin not initialized, use a fallback for debugging
  // This allows testing the Gemini API even if Firebase is misconfigured
  if (!adminSdk?.apps?.length) {
    console.warn('[generate.ts] Firebase Admin not initialized - using fallback auth (DEBUG MODE)');
    // Extract uid from token payload (JWT format: header.payload.signature)
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      console.log('[generate.ts] Fallback auth - extracted uid:', payload.user_id?.substring(0, 8) + '...');
      return { uid: payload.user_id || 'anonymous', email: payload.email || '' };
    } catch {
      console.log('[generate.ts] Fallback auth - could not parse token, using anonymous');
      return { uid: 'anonymous-debug', email: '' };
    }
  }

  try {
    const decoded = await adminSdk.auth().verifyIdToken(token);
    console.log('[generate.ts] Auth success, uid:', decoded.uid?.substring(0, 8) + '...');
    return { uid: decoded.uid, email: decoded.email || '' };
  } catch (e) {
    console.error('[generate.ts] Auth token verification failed:', e instanceof Error ? e.message : 'Unknown error');
    return null;
  }
}

// Get user's subscription status and credits
async function getSubscriptionStatus(userId: string): Promise<{
  status: 'free' | 'pro';
  monthlyUsed: number;
  monthlyLimit: number;
  canGenerate: boolean;
}> {
  const adminSdk = await initFirebaseAdmin();
  if (!adminSdk?.apps?.length) {
    return { status: 'free', monthlyUsed: 0, monthlyLimit: FREE_MONTHLY_LIMIT, canGenerate: true };
  }

  try {
    const db = adminSdk.firestore();
    const subDoc = await db.doc(`users/${userId}/subscription/current`).get();

    if (!subDoc.exists) {
      return { status: 'free', monthlyUsed: 0, monthlyLimit: FREE_MONTHLY_LIMIT, canGenerate: true };
    }

    const data = subDoc.data();
    const status = data?.status === 'pro' ? 'pro' : 'free';
    const monthlyUsed = data?.monthlyCreditsUsed || 0;
    const monthlyLimit = status === 'pro' ? PRO_MONTHLY_LIMIT : FREE_MONTHLY_LIMIT;

    // Check if subscription expired
    if (status === 'pro' && data?.currentPeriodEnd) {
      const endDate = new Date(data.currentPeriodEnd);
      if (new Date() > endDate) {
        return { status: 'free', monthlyUsed, monthlyLimit: FREE_MONTHLY_LIMIT, canGenerate: monthlyUsed < FREE_MONTHLY_LIMIT };
      }
    }

    return {
      status,
      monthlyUsed,
      monthlyLimit,
      canGenerate: monthlyUsed < monthlyLimit,
    };
  } catch (e) {
    console.error('Failed to get subscription status');
    return { status: 'free', monthlyUsed: 0, monthlyLimit: FREE_MONTHLY_LIMIT, canGenerate: true };
  }
}

// Deduct a credit after successful generation
async function deductCredit(userId: string): Promise<void> {
  const adminSdk = await initFirebaseAdmin();
  if (!adminSdk?.apps?.length) return;

  try {
    const db = adminSdk.firestore();
    const docRef = db.doc(`users/${userId}/subscription/current`);
    await docRef.update({
      monthlyCreditsUsed: adminSdk.firestore.FieldValue.increment(1),
    });
  } catch (e) {
    console.error('Failed to deduct credit');
  }
}

// Simple rate limiting (per user, in-memory for this instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Top-level try-catch to ensure we always return JSON, never plain text
  try {
    console.log('[generate.ts] Handler called, method:', req.method);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!GEMINI_API_KEY) {
      console.error('[generate.ts] VITE_AI_SERVICE_KEY not configured - returning 500');
      return res.status(500).json({ error: 'AI service not configured', debug: 'VITE_AI_SERVICE_KEY missing' });
    }

    // Verify authentication
    const authUser = await verifyAuth(req.headers.authorization as string);
    if (!authUser) {
      console.log('[generate.ts] Auth failed - returning 401');
      return res.status(401).json({ error: 'Unauthorized', debug: 'Auth verification failed' });
    }
    console.log('[generate.ts] Auth passed for user');

    // Rate limiting
    if (!checkRateLimit(authUser.uid)) {
      return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    }

    const { contentType, prompt, systemInstruction } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    // Check subscription status
    const subscription = await getSubscriptionStatus(authUser.uid);

    // Check if content type requires Pro
    if (PRO_ONLY_TYPES.includes(contentType) && subscription.status !== 'pro') {
      return res.status(403).json({
        error: 'This feature requires a Pro subscription',
        requiresPro: true,
      });
    }

    // Check if user has credits remaining
    if (!subscription.canGenerate) {
      return res.status(403).json({
        error: subscription.status === 'pro'
          ? 'Monthly generation limit reached'
          : 'Free generation limit reached. Upgrade to Pro for more.',
        limitReached: true,
        monthlyUsed: subscription.monthlyUsed,
        monthlyLimit: subscription.monthlyLimit,
      });
    }

    // Call Gemini API (server-side, key hidden)
    console.log('[generate.ts] Calling Gemini API...');
    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('[generate.ts] Gemini API error:', geminiResponse.status, errorText.substring(0, 200));
      return res.status(500).json({ error: 'AI generation failed', debug: `Gemini returned ${geminiResponse.status}` });
    }

    const result = await geminiResponse.json();
    console.log('[generate.ts] Gemini response received');

    // Deduct credit after successful generation
    await deductCredit(authUser.uid);

    // Extract text from response
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return res.status(200).json({
      success: true,
      content: generatedText,
      creditsRemaining: subscription.monthlyLimit - subscription.monthlyUsed - 1,
    });

  } catch (error: any) {
    console.error('[generate.ts] Unhandled error:', error?.message || error);
    return res.status(500).json({
      error: 'Failed to generate content',
      debug: error?.message || 'Unknown error'
    });
  }
}
