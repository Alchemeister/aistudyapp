import Stripe from 'stripe';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

// Initialize Firebase Admin (for server-side Firestore access)
if (!getApps().length) {
  // In production, use service account credentials from environment
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  if (serviceAccount) {
    initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    // For development, initialize without credentials (won't work for Firestore)
    console.warn('Firebase Admin: No service account configured');
  }
}

const adminDb = getApps().length > 0 ? getFirestore() : null;

// Credit pack amounts
const CREDIT_PACKS: Record<string, number> = {
  'price_1Sn7pJBqCnLJvgINEwYx5kLI': 25,
  'price_1Sn7qWBqCnLJvgINLtBkKpkA': 50,
  'price_1Sn7rsBqCnLJvgINalcNIC0v': 100,
};

// Plan durations in days
const PLAN_DURATIONS: Record<string, number> = {
  'price_1Sn7frBqCnLJvgINioGtjNlu': 30,   // monthly
  'price_1Sn7h8BqCnLJvgINum0uluPA': 120,  // semester (4 months)
  'price_1Sn7o4BqCnLJvgINSjWw3ly8': 365,  // annual
};

// Disable body parsing for raw body access (required for Stripe signature verification)
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to get raw body
async function getRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'] as string;
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  if (!adminDb) {
    console.error('Firebase Admin not initialized');
    return;
  }

  const { userId, priceId } = session.metadata || {};
  if (!userId || !priceId) {
    console.error('Missing metadata in checkout session');
    return;
  }

  const docRef = adminDb.collection('users').doc(userId).collection('subscription').doc('current');

  // Check if this is a credit pack purchase
  if (CREDIT_PACKS[priceId]) {
    const credits = CREDIT_PACKS[priceId];
    const docSnap = await docRef.get();
    const currentCredits = docSnap.exists ? (docSnap.data()?.purchasedCredits || 0) : 0;

    await docRef.set({
      purchasedCredits: currentCredits + credits,
    }, { merge: true });

    console.log(`Added ${credits} credits to user ${userId}`);
    return;
  }

  // This is a subscription purchase
  const duration = PLAN_DURATIONS[priceId] || 30;
  const currentPeriodEnd = new Date();
  currentPeriodEnd.setDate(currentPeriodEnd.getDate() + duration);

  const plan = priceId === 'price_1Sn7frBqCnLJvgINioGtjNlu' ? 'monthly'
    : priceId === 'price_1Sn7h8BqCnLJvgINum0uluPA' ? 'semester'
    : 'annual';

  await docRef.set({
    status: 'pro',
    stripeCustomerId: session.customer as string,
    stripeSubscriptionId: session.subscription as string || null,
    plan,
    currentPeriodEnd: currentPeriodEnd.toISOString(),
  }, { merge: true });

  console.log(`Activated Pro subscription for user ${userId}, plan: ${plan}`);
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  if (!adminDb) return;

  // Find user by stripeSubscriptionId
  const usersRef = adminDb.collectionGroup('subscription');
  const snapshot = await usersRef.where('stripeSubscriptionId', '==', subscription.id).get();

  if (snapshot.empty) {
    console.log('No user found for canceled subscription:', subscription.id);
    return;
  }

  for (const doc of snapshot.docs) {
    await doc.ref.update({
      status: 'free',
      stripeSubscriptionId: null,
      plan: null,
    });
    console.log(`Canceled subscription for user: ${doc.ref.parent.parent?.id}`);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  if (!adminDb) return;

  // Find user by stripeSubscriptionId
  const usersRef = adminDb.collectionGroup('subscription');
  const snapshot = await usersRef.where('stripeSubscriptionId', '==', subscription.id).get();

  if (snapshot.empty) {
    console.log('No user found for updated subscription:', subscription.id);
    return;
  }

  for (const doc of snapshot.docs) {
    const newPeriodEnd = new Date(subscription.current_period_end * 1000);
    await doc.ref.update({
      currentPeriodEnd: newPeriodEnd.toISOString(),
      status: subscription.status === 'active' ? 'pro' : 'free',
    });
    console.log(`Updated subscription for user: ${doc.ref.parent.parent?.id}`);
  }
}
