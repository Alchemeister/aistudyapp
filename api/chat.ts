import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

// Server-side AI Tutor chat endpoint
// Keeps Gemini API key secret and enforces Pro subscription

const GEMINI_API_KEY = process.env.VITE_AI_SERVICE_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Initialize Firebase Admin
if (!admin.apps?.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccount) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccount)),
      });
    } catch (e) {
      console.error('Firebase Admin init failed');
    }
  }
}

const DAILY_MESSAGE_LIMIT = 100;

// Verify Firebase auth token
async function verifyAuth(authHeader: string | undefined): Promise<{ uid: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    if (!admin.apps?.length) return null;
    const decoded = await admin.auth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

// Check if user is Pro and has daily messages remaining
async function checkAITutorAccess(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  messagesRemaining?: number;
}> {
  if (!admin.apps?.length) {
    return { allowed: false, reason: 'Service unavailable' };
  }

  try {
    const db = admin.firestore();
    const subDoc = await db.doc(`users/${userId}/subscription/current`).get();

    if (!subDoc.exists) {
      return { allowed: false, reason: 'AI Tutor requires a Pro subscription' };
    }

    const data = subDoc.data();

    // Check Pro status
    if (data?.status !== 'pro') {
      return { allowed: false, reason: 'AI Tutor requires a Pro subscription' };
    }

    // Check if subscription expired
    if (data?.currentPeriodEnd) {
      const endDate = new Date(data.currentPeriodEnd);
      if (new Date() > endDate) {
        return { allowed: false, reason: 'Your Pro subscription has expired' };
      }
    }

    // Check daily message limit
    const messagesToday = data?.aiTutorMessagesToday || 0;
    const resetDate = data?.aiTutorResetDate ? new Date(data.aiTutorResetDate) : new Date(0);

    // Reset if new day
    if (new Date() >= resetDate) {
      return { allowed: true, messagesRemaining: DAILY_MESSAGE_LIMIT };
    }

    if (messagesToday >= DAILY_MESSAGE_LIMIT) {
      return { allowed: false, reason: 'Daily AI Tutor limit reached. Come back tomorrow!' };
    }

    return { allowed: true, messagesRemaining: DAILY_MESSAGE_LIMIT - messagesToday };
  } catch (e) {
    console.error('Failed to check AI Tutor access');
    return { allowed: false, reason: 'Failed to verify subscription' };
  }
}

// Deduct a message after successful chat
async function deductMessage(userId: string): Promise<void> {
  if (!admin.apps?.length) return;

  try {
    const db = admin.firestore();
    const docRef = db.doc(`users/${userId}/subscription/current`);
    const doc = await docRef.get();
    const data = doc.data();

    const now = new Date();
    const resetDate = data?.aiTutorResetDate ? new Date(data.aiTutorResetDate) : new Date(0);

    // Reset daily counter if new day
    if (now >= resetDate) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      await docRef.update({
        aiTutorMessagesToday: 1,
        aiTutorResetDate: tomorrow.toISOString(),
      });
    } else {
      await docRef.update({
        aiTutorMessagesToday: admin.firestore.FieldValue.increment(1),
      });
    }
  } catch (e) {
    console.error('Failed to deduct message');
  }
}

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // messages per minute
const RATE_WINDOW = 60000;

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'AI service not configured' });
  }

  // Verify authentication
  const authUser = await verifyAuth(req.headers.authorization as string);
  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Rate limiting
  if (!checkRateLimit(authUser.uid)) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }

  try {
    const { message, context, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Missing message' });
    }

    // Check Pro status and daily limits
    const access = await checkAITutorAccess(authUser.uid);
    if (!access.allowed) {
      return res.status(403).json({ error: access.reason, requiresPro: true });
    }

    // Build conversation with context
    const systemPrompt = `You are an AI Study Tutor for StudyStack. Help the student understand the material.

${context ? `Study Context:\n${context}\n` : ''}

Be concise, encouraging, and educational. Use examples when helpful. If asked about topics outside the study material, politely redirect to the subject matter.`;

    // Build messages array for chat
    const contents = [];

    // Add history if provided
    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-10)) { // Last 10 messages for context
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }],
        });
      }
    }

    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    // Call Gemini API
    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!geminiResponse.ok) {
      console.error('Gemini API error');
      return res.status(500).json({ error: 'AI chat failed' });
    }

    const result = await geminiResponse.json();

    // Deduct message after successful response
    await deductMessage(authUser.uid);

    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return res.status(200).json({
      success: true,
      response: responseText,
      messagesRemaining: (access.messagesRemaining || 0) - 1,
    });

  } catch (error) {
    console.error('Chat error');
    return res.status(500).json({ error: 'Failed to process chat' });
  }
}
