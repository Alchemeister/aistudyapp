import Stripe from 'stripe';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
});

// Initialize Firebase Admin (singleton pattern)
if (!admin.apps?.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  console.log('Firebase Admin init: serviceAccount exists:', !!serviceAccount);
  if (serviceAccount) {
    try {
      const parsed = JSON.parse(serviceAccount);
      console.log('Firebase Admin init: parsed project_id:', parsed.project_id);
      admin.initializeApp({
        credential: admin.credential.cert(parsed),
      });
      console.log('Firebase Admin init: SUCCESS, apps count:', admin.apps?.length);
    } catch (e) {
      console.error('Firebase Admin init failed:', e);
    }
  }
}

// Map price IDs to their metadata
const PRICE_METADATA: Record<string, { type: 'subscription' | 'credits'; credits?: number; plan?: string; duration?: number }> = {
  // Subscriptions
  'price_1Sn7frBqCnLJvgINioGtjNlu': { type: 'subscription', plan: 'monthly' },
  'price_1Sn7h8BqCnLJvgINum0uluPA': { type: 'subscription', plan: 'semester', duration: 120 }, // 4 months in days
  'price_1Sn7o4BqCnLJvgINSjWw3ly8': { type: 'subscription', plan: 'annual', duration: 365 },
  // Credit packs
  'price_1Sn7pJBqCnLJvgINEwYx5kLI': { type: 'credits', credits: 25 },
  'price_1Sn7qWBqCnLJvgINLtBkKpkA': { type: 'credits', credits: 50 },
  'price_1Sn7rsBqCnLJvgINalcNIC0v': { type: 'credits', credits: 100 },
};

// Allowed redirect URL patterns (prevent open redirect)
const ALLOWED_REDIRECT_ORIGINS = [
  'https://studystack.ai',
  'https://www.studystack.ai',
  'http://localhost:5173',
  'http://localhost:3000',
];

// Verify Firebase ID token and return user info
async function verifyAuthToken(authHeader: string | undefined): Promise<{ uid: string; email: string } | null> {
  console.log('verifyAuthToken: authHeader present:', !!authHeader);
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('verifyAuthToken: no Bearer token');
    return null;
  }
  const token = authHeader.slice(7);
  console.log('verifyAuthToken: token length:', token.length);

  try {
    console.log('verifyAuthToken: admin.apps?.length:', admin.apps?.length);
    if (!admin.apps?.length) {
      console.log('verifyAuthToken: Firebase Admin not initialized');
      return null;
    }
    const decoded = await admin.auth().verifyIdToken(token);
    console.log('verifyAuthToken: SUCCESS, uid:', decoded.uid);
    return { uid: decoded.uid, email: decoded.email || '' };
  } catch (e) {
    console.error('Token verification failed:', e);
    return null;
  }
}

// Validate redirect URL is safe
function isValidRedirectUrl(url: string | undefined, origin: string | undefined): boolean {
  if (!url) return true; // Will use default
  try {
    const parsed = new URL(url);
    // Allow same origin or whitelisted origins
    if (origin && parsed.origin === origin) return true;
    return ALLOWED_REDIRECT_ORIGINS.includes(parsed.origin);
  } catch {
    return false;
  }
}

// Get user's actual referral credits from Firestore
async function getUserReferralCredits(userId: string): Promise<number> {
  if (!admin.apps?.length) return 0;

  try {
    const db = admin.firestore();
    const refDoc = await db.doc(`users/${userId}/referral/info`).get();
    if (!refDoc.exists) return 0;

    const data = refDoc.data();
    const referralCredits = data?.referralCredits || 0;
    const refereeCredits = data?.refereeCredits || 0;
    const creditsUsed = data?.creditsUsed || 0;

    return Math.max(0, referralCredits + refereeCredits - creditsUsed);
  } catch (e) {
    console.error('Failed to get referral credits:', e);
    return 0;
  }
}

// Create a one-time coupon for referral credits (amount in cents)
async function createReferralCreditCoupon(amountCents: number, userId: string): Promise<string | null> {
  if (amountCents <= 0) return null;

  try {
    // Create a unique coupon for this user's credits
    const couponId = `REFERRAL_CREDIT_${userId}_${Date.now()}`;
    await stripe.coupons.create({
      id: couponId,
      amount_off: amountCents,
      currency: 'usd',
      duration: 'once',
      name: `Referral Credit - $${(amountCents / 100).toFixed(2)} off`,
      max_redemptions: 1,
    });
    return couponId;
  } catch (error) {
    console.error('Failed to create referral credit coupon:', error);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // SECURITY: Verify Firebase auth token
    const authHeader = req.headers.authorization as string | undefined;
    const authUser = await verifyAuthToken(authHeader);

    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized - valid auth token required' });
    }

    const { priceId, mode, successUrl, cancelUrl, applyCredits } = req.body;

    // SECURITY: Use authenticated user's ID and email, not client-provided values
    const userId = authUser.uid;
    const email = authUser.email;

    if (!priceId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const priceMeta = PRICE_METADATA[priceId];
    if (!priceMeta) {
      return res.status(400).json({ error: 'Invalid price ID' });
    }

    // SECURITY: Validate redirect URLs to prevent open redirect
    const origin = req.headers.origin as string | undefined;
    if (!isValidRedirectUrl(successUrl, origin) || !isValidRedirectUrl(cancelUrl, origin)) {
      return res.status(400).json({ error: 'Invalid redirect URL' });
    }

    // SECURITY: Get actual referral credits from server, not client
    let verifiedCredits = 0;
    if (applyCredits && priceMeta.type === 'subscription') {
      verifiedCredits = await getUserReferralCredits(userId);
      // Cap credits at the price of the plan
      const planPrices: Record<string, number> = { monthly: 1499, semester: 4999, annual: 9999 };
      const planPrice = planPrices[priceMeta.plan || 'monthly'] || 1499;
      verifiedCredits = Math.min(verifiedCredits, planPrice);
    }

    // Create checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: mode === 'subscription' ? 'subscription' : 'payment',
      success_url: successUrl || `${origin}/#/settings?payment=success`,
      cancel_url: cancelUrl || `${origin}/#/settings?payment=cancelled`,
      metadata: {
        userId,
        priceId,
        referralCreditsCents: verifiedCredits, // Server-verified credits
        ...priceMeta,
      },
    };

    // Apply verified referral credits as coupon
    if (verifiedCredits > 0) {
      const couponId = await createReferralCreditCoupon(verifiedCredits, userId);
      if (couponId) {
        sessionParams.discounts = [{ coupon: couponId }];
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout session error:', error);
    // SECURITY: Don't expose internal error details
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
