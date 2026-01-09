// Subscription Service - Handles Stripe integration and subscription management
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, isConfigured } from './firebase';
import { STRIPE_CONFIG, FEATURES } from './stripeConfig';

// User subscription data stored in Firestore
export interface UserSubscription {
  userId: string;
  status: 'free' | 'pro';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  plan?: 'monthly' | 'semester' | 'annual';
  currentPeriodEnd?: string; // ISO date when subscription expires
  purchasedCredits: number;
  monthlyCreditsUsed: number;
  creditsResetDate: string; // ISO date when monthly credits reset
  aiTutorMessagesToday: number;
  aiTutorResetDate: string; // ISO date for daily reset
}

// Default subscription for new users
const createDefaultSubscription = (userId: string): UserSubscription => {
  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(0, 0, 0, 0);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  return {
    userId,
    status: 'free',
    purchasedCredits: 0,
    monthlyCreditsUsed: 0,
    creditsResetDate: nextMonth.toISOString(),
    aiTutorMessagesToday: 0,
    aiTutorResetDate: tomorrow.toISOString(),
  };
};

// Get or create user subscription document
export const getUserSubscription = async (userId: string): Promise<UserSubscription> => {
  if (!isConfigured || !db) {
    // Return default if Firebase not configured
    return createDefaultSubscription(userId);
  }

  try {
    const docRef = doc(db, 'users', userId, 'subscription', 'current');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as UserSubscription;
      const now = new Date();

      // Check if we need to reset monthly credits
      const resetDate = new Date(data.creditsResetDate);
      if (now >= resetDate) {
        const nextReset = new Date(now);
        nextReset.setMonth(nextReset.getMonth() + 1);
        nextReset.setDate(1);
        nextReset.setHours(0, 0, 0, 0);

        const updated: Partial<UserSubscription> = {
          monthlyCreditsUsed: 0,
          creditsResetDate: nextReset.toISOString(),
        };
        await updateDoc(docRef, updated);
        Object.assign(data, updated);
      }

      // Check if we need to reset daily AI tutor messages
      const aiResetDate = new Date(data.aiTutorResetDate);
      if (now >= aiResetDate) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const updated: Partial<UserSubscription> = {
          aiTutorMessagesToday: 0,
          aiTutorResetDate: tomorrow.toISOString(),
        };
        await updateDoc(docRef, updated);
        Object.assign(data, updated);
      }

      // Check if subscription has expired (for one-time purchases like semester/annual)
      if (data.status === 'pro' && data.currentPeriodEnd) {
        const endDate = new Date(data.currentPeriodEnd);
        if (now > endDate) {
          const updated: Partial<UserSubscription> = { status: 'free' };
          await updateDoc(docRef, updated);
          data.status = 'free';
        }
      }

      return data;
    }

    // Create new subscription document for new users
    const newSub = createDefaultSubscription(userId);
    await setDoc(docRef, newSub);
    return newSub;
  } catch (error) {
    console.error('Error getting subscription:', error);
    return createDefaultSubscription(userId);
  }
};

// Check if user can generate content
export const canGenerate = async (userId: string): Promise<{ allowed: boolean; reason?: string }> => {
  const sub = await getUserSubscription(userId);

  const limit = sub.status === 'pro'
    ? STRIPE_CONFIG.proTier.generations
    : STRIPE_CONFIG.freeTier.generations;

  const freeRemaining = limit - sub.monthlyCreditsUsed;
  const totalAvailable = freeRemaining + sub.purchasedCredits;

  if (totalAvailable <= 0) {
    return {
      allowed: false,
      reason: sub.status === 'pro'
        ? 'Monthly generation limit reached. Buy more credits to continue.'
        : 'Free generations used up. Upgrade to Pro or buy credits.'
    };
  }

  return { allowed: true };
};

// Deduct a credit after generation
export const deductCredit = async (userId: string): Promise<void> => {
  if (!isConfigured || !db) return;

  const docRef = doc(db, 'users', userId, 'subscription', 'current');
  const sub = await getUserSubscription(userId);

  const limit = sub.status === 'pro'
    ? STRIPE_CONFIG.proTier.generations
    : STRIPE_CONFIG.freeTier.generations;

  if (sub.monthlyCreditsUsed < limit) {
    // Use monthly allocation first
    await updateDoc(docRef, {
      monthlyCreditsUsed: sub.monthlyCreditsUsed + 1,
    });
  } else if (sub.purchasedCredits > 0) {
    // Then use purchased credits
    await updateDoc(docRef, {
      purchasedCredits: sub.purchasedCredits - 1,
    });
  }
};

// Check if user can use AI Tutor
export const canUseAITutor = async (userId: string): Promise<{ allowed: boolean; reason?: string }> => {
  const sub = await getUserSubscription(userId);

  if (sub.status !== 'pro') {
    return { allowed: false, reason: 'AI Tutor is a Pro feature. Upgrade to access.' };
  }

  if (sub.aiTutorMessagesToday >= STRIPE_CONFIG.proTier.aiTutorMessages) {
    return { allowed: false, reason: 'Daily AI Tutor limit reached. Come back tomorrow!' };
  }

  return { allowed: true };
};

// Deduct an AI Tutor message
export const deductAITutorMessage = async (userId: string): Promise<void> => {
  if (!isConfigured || !db) return;

  const docRef = doc(db, 'users', userId, 'subscription', 'current');
  const sub = await getUserSubscription(userId);

  await updateDoc(docRef, {
    aiTutorMessagesToday: sub.aiTutorMessagesToday + 1,
  });
};

// Check if user has access to a feature
export const hasFeatureAccess = async (userId: string, feature: keyof typeof FEATURES.free): Promise<boolean> => {
  const sub = await getUserSubscription(userId);
  const tier = sub.status === 'pro' ? FEATURES.pro : FEATURES.free;
  return tier[feature];
};

// Check if user has cloud PDF storage access (Pro feature)
export const hasCloudPdfAccess = async (userId: string): Promise<boolean> => {
  const sub = await getUserSubscription(userId);
  return sub.status === 'pro';
};

// Get remaining credits info for display
export const getCreditsInfo = async (userId: string): Promise<{
  status: 'free' | 'pro';
  monthlyUsed: number;
  monthlyLimit: number;
  monthlyRemaining: number;
  purchased: number;
  total: number;
  resetDate: string;
  aiTutorRemaining: number;
  plan?: string;
  expiresAt?: string;
}> => {
  const sub = await getUserSubscription(userId);
  const limit = sub.status === 'pro'
    ? STRIPE_CONFIG.proTier.generations
    : STRIPE_CONFIG.freeTier.generations;
  const monthlyRemaining = Math.max(0, limit - sub.monthlyCreditsUsed);
  const aiTutorLimit = sub.status === 'pro' ? STRIPE_CONFIG.proTier.aiTutorMessages : 0;

  return {
    status: sub.status,
    monthlyUsed: sub.monthlyCreditsUsed,
    monthlyLimit: limit,
    monthlyRemaining,
    purchased: sub.purchasedCredits,
    total: monthlyRemaining + sub.purchasedCredits,
    resetDate: sub.creditsResetDate,
    aiTutorRemaining: Math.max(0, aiTutorLimit - sub.aiTutorMessagesToday),
    plan: sub.plan,
    expiresAt: sub.currentPeriodEnd,
  };
};

// Create Stripe checkout session (calls our API)
export const createCheckoutSession = async (
  userId: string,
  priceId: string,
  email: string,
  mode: 'subscription' | 'payment' = 'subscription'
): Promise<string> => {
  const successUrl = `${window.location.origin}/#/settings?payment=success`;
  const cancelUrl = `${window.location.origin}/#/settings?payment=cancelled`;

  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      priceId,
      email,
      mode,
      successUrl,
      cancelUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create checkout session');
  }

  const { url } = await response.json();
  return url;
};

// Redirect to Stripe checkout for subscription
export const upgradeToPro = async (userId: string, email: string, plan: 'monthly' | 'semester' | 'annual'): Promise<void> => {
  const priceId = {
    monthly: STRIPE_CONFIG.prices.proMonthly,
    semester: STRIPE_CONFIG.prices.proSemester,
    annual: STRIPE_CONFIG.prices.proAnnual,
  }[plan];

  // Semester and annual are one-time payments, monthly is subscription
  const mode = plan === 'monthly' ? 'subscription' : 'payment';
  const url = await createCheckoutSession(userId, priceId, email, mode);
  window.location.href = url;
};

// Redirect to Stripe checkout for credits
export const buyCredits = async (userId: string, email: string, pack: 'pack25' | 'pack50' | 'pack100'): Promise<void> => {
  const { priceId } = STRIPE_CONFIG.credits[pack];
  const url = await createCheckoutSession(userId, priceId, email, 'payment');
  window.location.href = url;
};

// --- Functions called by webhook (backend only) ---

// Add purchased credits (called by webhook handler)
export const addPurchasedCredits = async (userId: string, credits: number): Promise<void> => {
  if (!db) return;
  const docRef = doc(db, 'users', userId, 'subscription', 'current');
  const sub = await getUserSubscription(userId);

  await updateDoc(docRef, {
    purchasedCredits: sub.purchasedCredits + credits,
  });
};

// Activate Pro subscription (called by webhook handler)
export const activateProSubscription = async (
  userId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string | null,
  plan: 'monthly' | 'semester' | 'annual',
  currentPeriodEnd: string
): Promise<void> => {
  if (!db) return;
  const docRef = doc(db, 'users', userId, 'subscription', 'current');

  await updateDoc(docRef, {
    status: 'pro',
    stripeCustomerId,
    stripeSubscriptionId,
    plan,
    currentPeriodEnd,
  });
};

// Cancel/expire subscription (called by webhook handler)
export const cancelSubscription = async (userId: string): Promise<void> => {
  if (!db) return;
  const docRef = doc(db, 'users', userId, 'subscription', 'current');

  await updateDoc(docRef, {
    status: 'free',
    stripeSubscriptionId: null,
    plan: null,
    currentPeriodEnd: null,
  });
};
