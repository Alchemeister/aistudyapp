/**
 * CREDITS SERVICE - PLACEHOLDER
 *
 * This file will handle:
 * - Generation usage tracking
 * - Credit purchases (one-time)
 * - Abuse detection
 *
 * SETUP REQUIRED:
 * 1. Set up Stripe for one-time payments
 * 2. Create credit pack products in Stripe
 * 3. Add Firestore security rules for usage collection
 */

import { db, isConfigured, doc, setDoc, getDoc, collection } from './firebase';

// Credit pack pricing
export const CREDIT_PACKS = {
  SMALL: {
    id: 'credits_small',
    generations: 50,
    price: 3, // $3
    stripePriceId: 'price_CREDITS_50', // TODO: Replace with actual Stripe Price ID
  },
  MEDIUM: {
    id: 'credits_medium',
    generations: 150,
    price: 7, // $7 (save $2)
    stripePriceId: 'price_CREDITS_150',
  },
  LARGE: {
    id: 'credits_large',
    generations: 500,
    price: 20, // $20 (save $10)
    stripePriceId: 'price_CREDITS_500',
  }
};

// Abuse detection thresholds
export const ABUSE_THRESHOLDS = {
  GENERATIONS_PER_HOUR: 50,    // Flag if > 50 in 1 hour
  GENERATIONS_PER_DAY: 200,    // Flag if > 200 in 1 day
  TOKENS_PER_DAY: 2000000,     // Flag if > 2M tokens in 1 day
};

export interface UserUsage {
  userId: string;
  generationsThisMonth: number;
  tokensThisMonth: number;
  bonusCredits: number; // Purchased credits (don't expire)
  periodStart: string;
  periodEnd: string;
  lastGeneration?: string;
  flagged?: boolean;
  flagReason?: string;
}

export interface GenerationLog {
  timestamp: string;
  type: string; // 'flashcards', 'quiz', 'notes', etc.
  tokensUsed: number;
  chapterIds?: string[];
}

/**
 * Get user's current usage
 */
export const getUserUsage = async (userId: string): Promise<UserUsage | null> => {
  if (!isConfigured || !db) return null;

  try {
    const usageRef = doc(db, 'users', userId, 'usage', 'current');
    const snapshot = await getDoc(usageRef);

    if (!snapshot.exists()) {
      // Initialize usage for new user
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const initialUsage: UserUsage = {
        userId,
        generationsThisMonth: 0,
        tokensThisMonth: 0,
        bonusCredits: 0,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString()
      };

      await setDoc(usageRef, initialUsage);
      return initialUsage;
    }

    // Check if we need to reset for new month
    const usage = snapshot.data() as UserUsage;
    const now = new Date();
    const periodEnd = new Date(usage.periodEnd);

    if (now > periodEnd) {
      // Reset for new month
      const newPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const newPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const resetUsage: UserUsage = {
        ...usage,
        generationsThisMonth: 0,
        tokensThisMonth: 0,
        periodStart: newPeriodStart.toISOString(),
        periodEnd: newPeriodEnd.toISOString()
      };

      await setDoc(usageRef, resetUsage);
      return resetUsage;
    }

    return usage;
  } catch (error) {
    console.error('Failed to get usage:', error);
    return null;
  }
};

/**
 * Record a generation and update usage
 */
export const recordGeneration = async (
  userId: string,
  type: string,
  tokensUsed: number
): Promise<{ allowed: boolean; remaining: number; message?: string }> => {
  if (!isConfigured || !db) {
    return { allowed: true, remaining: 999 }; // Allow if no tracking
  }

  try {
    const usage = await getUserUsage(userId);
    if (!usage) {
      return { allowed: true, remaining: 999 };
    }

    // TODO: Check subscription tier limits
    // const subscription = await getUserSubscription(userId);
    // const limit = TIERS[subscription.tier].generationsPerMonth;

    const limit = 50; // Default free tier limit

    // Check bonus credits first, then monthly limit
    const totalAvailable = (limit - usage.generationsThisMonth) + usage.bonusCredits;

    if (totalAvailable <= 0) {
      return {
        allowed: false,
        remaining: 0,
        message: 'Monthly generation limit reached. Upgrade to Pro or purchase credits.'
      };
    }

    // Update usage
    const usageRef = doc(db, 'users', userId, 'usage', 'current');
    const newGenerations = usage.generationsThisMonth + 1;
    const newTokens = usage.tokensThisMonth + tokensUsed;

    // Use bonus credits if over monthly limit
    let newBonusCredits = usage.bonusCredits;
    if (newGenerations > limit && usage.bonusCredits > 0) {
      newBonusCredits = usage.bonusCredits - 1;
    }

    await setDoc(usageRef, {
      ...usage,
      generationsThisMonth: newGenerations,
      tokensThisMonth: newTokens,
      bonusCredits: newBonusCredits,
      lastGeneration: new Date().toISOString()
    });

    // TODO: Log for abuse detection
    // await logGeneration(userId, type, tokensUsed);

    return {
      allowed: true,
      remaining: Math.max(0, limit - newGenerations) + newBonusCredits
    };
  } catch (error) {
    console.error('Failed to record generation:', error);
    return { allowed: true, remaining: 999 }; // Fail open
  }
};

/**
 * TODO: Check for abuse patterns
 *
 * Run periodically or on each generation:
 * 1. Count generations in last hour
 * 2. Count generations in last day
 * 3. Check for unusual patterns
 * 4. Flag account if thresholds exceeded
 *
 * export const checkForAbuse = async (userId: string): Promise<boolean> => {
 *   const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
 *   const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
 *
 *   // Query generation logs
 *   // Count and compare to thresholds
 *   // Flag if exceeded
 * };
 */

/**
 * TODO: Add bonus credits after purchase
 *
 * Called by Stripe webhook after successful payment:
 *
 * export const addBonusCredits = async (userId: string, credits: number): Promise<void> => {
 *   const usage = await getUserUsage(userId);
 *   if (!usage) return;
 *
 *   const usageRef = doc(db, 'users', userId, 'usage', 'current');
 *   await setDoc(usageRef, {
 *     ...usage,
 *     bonusCredits: usage.bonusCredits + credits
 *   });
 * };
 */

/**
 * TODO: Create credit purchase checkout
 *
 * export const purchaseCredits = async (userId: string, packId: string) => {
 *   const pack = CREDIT_PACKS[packId];
 *   // Create Stripe checkout session for one-time payment
 *   // Redirect to Stripe
 * };
 */

// Placeholder exports
export const CREDITS_SERVICE_VERSION = '0.1.0-placeholder';
