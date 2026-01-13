import Stripe from 'stripe';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
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

// Referral configuration
const REFERRAL_CONFIG = {
  referrerDiscountAmount: 750, // $7.50 in cents (50% off monthly $14.99)
  maxReferrals: 6,             // Cap at 6 referrals
};

// Email configuration
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'StudyStack <hello@send.studystack.ai>';

// Send email via Resend API (server-side)
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured, skipping email');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });

    if (!response.ok) {
      console.error('Resend API error:', await response.text());
      return false;
    }

    console.log(`Email sent: ${subject}`);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

// Email templates for webhook
const emailTemplates = {
  paymentReceipt: (name: string, plan: string, amount: string, date: string) => ({
    subject: 'Your StudyStack receipt 🧾',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3b82f6; margin: 0;">StudyStack</h1>
        </div>
        <h2 style="color: #1e293b;">Payment Received ✓</h2>
        <p style="color: #475569;">Thanks${name ? `, ${name}` : ''}! Here's your receipt:</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; color: #475569;">
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Plan</strong></td><td style="text-align: right; border-bottom: 1px solid #e2e8f0;">StudyStack Pro (${plan})</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Amount</strong></td><td style="text-align: right; border-bottom: 1px solid #e2e8f0;">${amount}</td></tr>
            <tr><td style="padding: 8px 0;"><strong>Date</strong></td><td style="text-align: right;">${date}</td></tr>
          </table>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://studystack.app" style="background: linear-gradient(to right, #3b82f6, #2563eb); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Start Studying</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">StudyStack - Study smarter, not harder</p>
      </div>
    `,
  }),

  subscriptionConfirmed: (name: string, plan: string, expiresAt: string) => ({
    subject: 'Welcome to StudyStack Pro! 🚀',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3b82f6; margin: 0;">StudyStack</h1>
        </div>
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="background: linear-gradient(to right, #f59e0b, #d97706); color: white; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: bold;">⭐ PRO MEMBER</span>
        </div>
        <h2 style="color: #1e293b; text-align: center;">You're all set${name ? `, ${name}` : ''}!</h2>
        <p style="color: #475569; text-align: center;">Your ${plan} plan is now active. Here's what you unlocked:</p>
        <div style="background: #eff6ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <ul style="color: #1e40af; line-height: 2; margin: 0; padding-left: 20px;">
            <li>🎙️ <strong>Lecture Recording</strong> - Record & transcribe automatically</li>
            <li>💬 <strong>AI Tutor</strong> - Ask questions about your material</li>
            <li>🧠 <strong>Concept Maps</strong> - Visualize connections</li>
            <li>📝 <strong>1,000 generations/month</strong></li>
          </ul>
        </div>
        <p style="color: #64748b; font-size: 14px; text-align: center;">Your plan renews on <strong>${expiresAt}</strong></p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://studystack.app" style="background: linear-gradient(to right, #3b82f6, #2563eb); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Start Exploring Pro</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">StudyStack - Study smarter, not harder</p>
      </div>
    `,
  }),

  referralSuccess: (name: string, totalCredits: string) => ({
    subject: 'You earned $7.50! 💰',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3b82f6; margin: 0;">StudyStack</h1>
        </div>
        <div style="text-align: center; margin-bottom: 20px;"><span style="font-size: 48px;">🎊</span></div>
        <h2 style="color: #1e293b; text-align: center;">Cha-ching${name ? `, ${name}` : ''}!</h2>
        <p style="color: #475569; text-align: center;">Your friend just upgraded to Pro!</p>
        <div style="background: linear-gradient(to right, #22c55e, #16a34a); border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center; color: white;">
          <p style="margin: 0 0 8px 0; font-size: 14px; opacity: 0.9;">You earned</p>
          <p style="margin: 0; font-size: 36px; font-weight: bold;">$7.50</p>
          <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Total credits: ${totalCredits}</p>
        </div>
        <p style="color: #475569; text-align: center;">Your credits will automatically apply to your next purchase.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://studystack.app/#/settings" style="background: linear-gradient(to right, #3b82f6, #2563eb); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Your Credits</a>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">StudyStack - Study smarter, not harder</p>
      </div>
    `,
  }),
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

  const { userId, priceId, referralCreditsCents } = session.metadata || {};
  if (!userId || !priceId) {
    console.error('Missing metadata in checkout session');
    return;
  }

  // SECURITY: Deduct referral credits used in this checkout (server-side, after payment confirmed)
  const creditsUsed = parseInt(referralCreditsCents || '0') || 0;
  if (creditsUsed > 0) {
    try {
      const userRefDoc = adminDb.collection('users').doc(userId).collection('referral').doc('info');
      const refSnap = await userRefDoc.get();
      if (refSnap.exists) {
        const currentUsed = refSnap.data()?.creditsUsed || 0;
        await userRefDoc.update({
          creditsUsed: currentUsed + creditsUsed,
        });
        console.log(`Deducted ${creditsUsed} cents in referral credits`);
      }
    } catch (e) {
      console.error('Failed to deduct referral credits:', e);
      // Don't fail the whole checkout for this
    }
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

    console.log(`Added ${credits} credits to account`);
    return;
  }

  // This is a subscription purchase
  const duration = PLAN_DURATIONS[priceId] || 30;
  const currentPeriodEnd = new Date();
  currentPeriodEnd.setDate(currentPeriodEnd.getDate() + duration);

  const plan = priceId === 'price_1Sn7frBqCnLJvgINioGtjNlu' ? 'monthly'
    : priceId === 'price_1Sn7h8BqCnLJvgINum0uluPA' ? 'semester'
    : 'annual';

  const planDisplay = plan.charAt(0).toUpperCase() + plan.slice(1);
  const amount = plan === 'monthly' ? '$14.99' : plan === 'semester' ? '$49.99' : '$99.99';

  await docRef.set({
    status: 'pro',
    stripeCustomerId: session.customer as string,
    stripeSubscriptionId: session.subscription as string || null,
    plan,
    currentPeriodEnd: currentPeriodEnd.toISOString(),
  }, { merge: true });

  console.log(`Activated Pro subscription, plan: ${plan}`);

  // Send emails
  const customerEmail = session.customer_email || session.customer_details?.email;
  const customerName = session.customer_details?.name || '';

  if (customerEmail) {
    // Send payment receipt
    const receiptEmail = emailTemplates.paymentReceipt(
      customerName,
      planDisplay,
      amount,
      new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    );
    await sendEmail(customerEmail, receiptEmail.subject, receiptEmail.html);

    // Send subscription confirmed
    const confirmEmail = emailTemplates.subscriptionConfirmed(
      customerName,
      planDisplay,
      currentPeriodEnd.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    );
    await sendEmail(customerEmail, confirmEmail.subject, confirmEmail.html);
  }

  // Award referral credit if user was referred
  await awardReferralCredit(userId);
}

// Award credits to referrer when referred user upgrades to Pro
// Awards $7.50 (750 cents) in referral credits to the referrer's account
async function awardReferralCredit(userId: string) {
  if (!adminDb) return;

  try {
    // Get user's referral info to find who referred them
    const userRefDoc = await adminDb.collection('users').doc(userId).collection('referral').doc('info').get();
    if (!userRefDoc.exists) return;

    const userRef = userRefDoc.data();
    if (!userRef?.referredBy) return;

    // Check if we already awarded credits for this referral
    const recordId = `${userRef.referredBy}_${userId}`;
    const recordRef = adminDb.collection('users').doc(userRef.referredBy).collection('referralHistory').doc(recordId);
    const recordSnap = await recordRef.get();

    if (!recordSnap.exists) return;
    const record = recordSnap.data();

    if (record?.creditsAwarded > 0) return; // Already awarded

    // Check if referrer has hit the cap (6 referrals max)
    const referrerDocRef = adminDb.collection('users').doc(userRef.referredBy).collection('referral').doc('info');
    const referrerRefSnap = await referrerDocRef.get();

    if (!referrerRefSnap.exists) return;
    const referrerData = referrerRefSnap.data();
    const currentConversions = referrerData?.proConversions || 0;

    if (currentConversions >= REFERRAL_CONFIG.maxReferrals) {
      console.log(`Referrer has hit the cap of ${REFERRAL_CONFIG.maxReferrals} referrals`);
      // Still mark as converted but don't award credits
      await recordRef.update({
        status: 'converted_pro',
        creditsAwarded: 0,
        convertedAt: new Date().toISOString(),
      });
      return;
    }

    const creditsToAward = REFERRAL_CONFIG.referrerDiscountAmount; // 750 cents = $7.50

    // Update referral record with credits awarded
    await recordRef.update({
      status: 'converted_pro',
      creditsAwarded: creditsToAward,
      convertedAt: new Date().toISOString(),
    });

    // Update referrer's referral credits and stats
    const currentCredits = referrerData?.referralCredits || 0;
    const newTotalCredits = currentCredits + creditsToAward;
    await referrerDocRef.update({
      proConversions: currentConversions + 1,
      referralCredits: newTotalCredits,
    });

    console.log(`Awarded $${creditsToAward / 100} referral credit for Pro conversion`);

    // Send email to referrer
    try {
      // Get referrer's email from their subscription doc or auth
      const referrerSubDoc = await adminDb.collection('users').doc(userRef.referredBy).collection('subscription').doc('current').get();
      const referrerEmail = referrerSubDoc.exists ? referrerSubDoc.data()?.email : null;

      // Try to get from auth metadata if not in subscription
      if (referrerEmail) {
        const totalCreditsStr = `$${(newTotalCredits / 100).toFixed(2)}`;
        const successEmail = emailTemplates.referralSuccess(referrerData?.displayName || '', totalCreditsStr);
        await sendEmail(referrerEmail, successEmail.subject, successEmail.html);
      }
    } catch (emailError) {
      console.error('Failed to send referral success email:', emailError);
    }
  } catch (error) {
    console.error('Error awarding referral credits:', error);
  }
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
    console.log('Subscription canceled successfully');
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
    const newPeriodEnd = new Date((subscription as any).current_period_end * 1000);
    await doc.ref.update({
      currentPeriodEnd: newPeriodEnd.toISOString(),
      status: subscription.status === 'active' ? 'pro' : 'free',
    });
    console.log('Subscription updated successfully');
  }
}
