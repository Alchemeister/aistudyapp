// Referral Service - In-app referral system for user growth
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, increment } from 'firebase/firestore';
import { db, isConfigured } from './firebase';
import { getUserProfile } from './friendsService';
import { sendReferralSignupEmail } from './emailService';

// Referral configuration
export const REFERRAL_CONFIG = {
  // Rewards for referrer (the person sharing)
  referrerReward: {
    creditsCents: 750,   // $7.50 credit per successful referral (50% of monthly)
    maxReferrals: 6,     // Cap at 6 referrals ($45 total = ~free semester)
    maxCreditsCents: 4500, // 6 × $7.50 = $45.00
  },
  // Rewards for referee (the new user)
  refereeReward: {
    creditsCents: 750,   // $7.50 off first purchase (50% of monthly)
  },
  // Pricing reference (for display purposes)
  pricing: {
    monthlyCents: 1499,   // $14.99
    semesterCents: 4999,  // $49.99
    annualCents: 9999,    // $99.99
  },
  // Code settings
  codeLength: 8,
  codePrefix: 'SS', // StudyStack
};

// User's referral info
export interface UserReferralInfo {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  successfulReferrals: number; // Signed up
  proConversions: number;      // Upgraded to Pro (awards credits, capped at maxReferrals)
  referralCredits: number;     // Credits earned in cents (e.g., 750 = $7.50)
  creditsUsed: number;         // Credits already applied in cents
  refereeCredits: number;      // Credits for being referred (one-time $7.50)
  referredBy?: string;         // User ID who referred this user
  referredByCode?: string;     // Code used when signing up
  createdAt: string;
}

// Individual referral record
export interface ReferralRecord {
  id: string;
  referrerId: string;         // Who shared the code
  refereeId: string;          // Who used the code
  refereeEmail: string;
  status: 'signed_up' | 'converted_pro';
  creditsAwarded: number;     // Credits awarded to referrer in cents (0 or 750)
  createdAt: string;
  convertedAt?: string;
}

// Generate a unique referral code
const generateReferralCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O, 0, I, 1 to avoid confusion
  let code = REFERRAL_CONFIG.codePrefix;
  for (let i = 0; i < REFERRAL_CONFIG.codeLength - REFERRAL_CONFIG.codePrefix.length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Get or create user's referral info
export const getUserReferralInfo = async (userId: string): Promise<UserReferralInfo | null> => {
  if (!isConfigured || !db) return null;

  try {
    const docRef = doc(db, 'users', userId, 'referral', 'info');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as UserReferralInfo;
    }

    // Create new referral info for this user
    let referralCode = generateReferralCode();

    // Ensure code is unique
    let attempts = 0;
    while (attempts < 10) {
      const codeRef = doc(db, 'referralCodes', referralCode);
      const codeSnap = await getDoc(codeRef);
      if (!codeSnap.exists()) break;
      referralCode = generateReferralCode();
      attempts++;
    }

    const baseUrl = window.location.origin;
    const referralInfo: UserReferralInfo = {
      referralCode,
      referralLink: `${baseUrl}/?ref=${referralCode}`,
      totalReferrals: 0,
      successfulReferrals: 0,
      proConversions: 0,
      referralCredits: 0,
      creditsUsed: 0,
      refereeCredits: 0,
      createdAt: new Date().toISOString(),
    };

    // Save referral info
    await setDoc(docRef, referralInfo);

    // Register code in lookup table
    await setDoc(doc(db, 'referralCodes', referralCode), {
      userId,
      createdAt: new Date().toISOString(),
    });

    return referralInfo;
  } catch (error) {
    console.error('Error getting referral info:', error);
    return null;
  }
};

// Look up who owns a referral code
export const getReferrerByCode = async (code: string): Promise<string | null> => {
  if (!isConfigured || !db) return null;

  try {
    const codeRef = doc(db, 'referralCodes', code.toUpperCase());
    const codeSnap = await getDoc(codeRef);

    if (codeSnap.exists()) {
      return codeSnap.data().userId;
    }
    return null;
  } catch (error) {
    console.error('Error looking up referral code:', error);
    return null;
  }
};

// Apply referral code when a new user signs up
// Returns hasReferral flag so checkout can apply 50% off coupon
export const applyReferralCode = async (
  newUserId: string,
  newUserEmail: string,
  referralCode: string
): Promise<{ success: boolean; message: string; refereeCredits?: number }> => {
  if (!isConfigured || !db) {
    return { success: false, message: 'Service unavailable' };
  }

  try {
    const code = referralCode.toUpperCase().trim();

    // Look up the referrer
    const referrerId = await getReferrerByCode(code);
    if (!referrerId) {
      return { success: false, message: 'Invalid referral code' };
    }

    // Can't refer yourself
    if (referrerId === newUserId) {
      return { success: false, message: 'Cannot use your own referral code' };
    }

    // Check if user already used a referral code
    const newUserRefDoc = doc(db, 'users', newUserId, 'referral', 'info');
    const newUserRefSnap = await getDoc(newUserRefDoc);
    if (newUserRefSnap.exists() && newUserRefSnap.data().referredBy) {
      return { success: false, message: 'You have already used a referral code' };
    }

    // Create referral record (credits awarded when they convert to Pro)
    const recordId = `${referrerId}_${newUserId}`;
    const recordRef = doc(db, 'users', referrerId, 'referralHistory', recordId);

    const record: ReferralRecord = {
      id: recordId,
      referrerId,
      refereeId: newUserId,
      refereeEmail: newUserEmail,
      status: 'signed_up',
      creditsAwarded: 0, // Credits awarded when they convert to Pro
      createdAt: new Date().toISOString(),
    };
    await setDoc(recordRef, record);

    // Update referrer's stats (no discount yet - that comes when friend goes Pro)
    const referrerDocRef = doc(db, 'users', referrerId, 'referral', 'info');
    await updateDoc(referrerDocRef, {
      totalReferrals: increment(1),
      successfulReferrals: increment(1),
    });

    // Notify referrer that a friend signed up using their code
    const referrerProfile = await getUserProfile(referrerId);
    if (referrerProfile?.email) {
      const newUserName = newUserEmail.split('@')[0]; // Use email prefix as name
      sendReferralSignupEmail(
        referrerProfile.email,
        referrerProfile.displayName || undefined,
        newUserName
      );
    }

    // Update new user's referral info with who referred them
    const baseUrl = window.location.origin;
    let newUserCode = generateReferralCode();
    // Ensure unique
    let attempts = 0;
    while (attempts < 10) {
      const codeSnap = await getDoc(doc(db, 'referralCodes', newUserCode));
      if (!codeSnap.exists()) break;
      newUserCode = generateReferralCode();
      attempts++;
    }

    const newUserReferralInfo: UserReferralInfo = {
      referralCode: newUserCode,
      referralLink: `${baseUrl}/?ref=${newUserCode}`,
      totalReferrals: 0,
      successfulReferrals: 0,
      proConversions: 0,
      referralCredits: 0,
      creditsUsed: 0,
      refereeCredits: REFERRAL_CONFIG.refereeReward.creditsCents, // $7.50 off first purchase
      referredBy: referrerId,
      referredByCode: code,
      createdAt: new Date().toISOString(),
    };
    await setDoc(newUserRefDoc, newUserReferralInfo);

    // Register new user's code
    await setDoc(doc(db, 'referralCodes', newUserCode), {
      userId: newUserId,
      createdAt: new Date().toISOString(),
    });

    const creditsDollars = (REFERRAL_CONFIG.refereeReward.creditsCents / 100).toFixed(2);
    return {
      success: true,
      message: `Welcome! You have $${creditsDollars} credit to use on your first purchase!`,
      refereeCredits: REFERRAL_CONFIG.refereeReward.creditsCents,
    };
  } catch (error) {
    console.error('Error applying referral code:', error);
    return { success: false, message: 'Failed to apply referral code' };
  }
};

// Get user's total available credits (referral credits + referee credits - used)
export const getUserReferralCredits = async (userId: string): Promise<{
  totalCredits: number;      // Total available credits in cents
  referralCredits: number;   // Credits from referring others
  refereeCredits: number;    // Credits from being referred
  creditsUsed: number;       // Credits already used
}> => {
  const defaultResult = { totalCredits: 0, referralCredits: 0, refereeCredits: 0, creditsUsed: 0 };
  if (!isConfigured || !db) return defaultResult;

  try {
    const userRefDoc = doc(db, 'users', userId, 'referral', 'info');
    const userRefSnap = await getDoc(userRefDoc);

    if (!userRefSnap.exists()) return defaultResult;

    const userRef = userRefSnap.data() as UserReferralInfo;
    const referralCredits = userRef.referralCredits || 0;
    const refereeCredits = userRef.refereeCredits || 0;
    const creditsUsed = userRef.creditsUsed || 0;
    const totalCredits = Math.max(0, referralCredits + refereeCredits - creditsUsed);

    return { totalCredits, referralCredits, refereeCredits, creditsUsed };
  } catch (error) {
    console.error('Error getting user referral credits:', error);
    return defaultResult;
  }
};

// Get referrer's credit status (for checking if they can still earn credits)
export const getReferrerCreditStatus = async (userId: string): Promise<{
  canEarnMore: boolean;
  proConversions: number;       // How many referrals converted to Pro
  referralsRemaining: number;   // How many more can earn credits
  maxReferrals: number;
  creditsEarned: number;        // Total credits earned in cents
  maxCreditsCents: number;      // Max possible credits
}> => {
  const defaultStatus = {
    canEarnMore: true,
    proConversions: 0,
    referralsRemaining: REFERRAL_CONFIG.referrerReward.maxReferrals,
    maxReferrals: REFERRAL_CONFIG.referrerReward.maxReferrals,
    creditsEarned: 0,
    maxCreditsCents: REFERRAL_CONFIG.referrerReward.maxCreditsCents,
  };

  if (!isConfigured || !db) return defaultStatus;

  try {
    const userRefDoc = doc(db, 'users', userId, 'referral', 'info');
    const userRefSnap = await getDoc(userRefDoc);

    if (!userRefSnap.exists()) return defaultStatus;

    const userRef = userRefSnap.data() as UserReferralInfo;
    const proConversions = userRef.proConversions || 0;
    const maxReferrals = REFERRAL_CONFIG.referrerReward.maxReferrals;
    const creditsEarned = userRef.referralCredits || 0;

    return {
      canEarnMore: proConversions < maxReferrals,
      proConversions,
      referralsRemaining: Math.max(0, maxReferrals - proConversions),
      maxReferrals,
      creditsEarned,
      maxCreditsCents: REFERRAL_CONFIG.referrerReward.maxCreditsCents,
    };
  } catch (error) {
    console.error('Error getting referrer credit status:', error);
    return defaultStatus;
  }
};

// Get user's referral history
export const getReferralHistory = async (userId: string): Promise<ReferralRecord[]> => {
  if (!isConfigured || !db) return [];

  try {
    const historyRef = collection(db, 'users', userId, 'referralHistory');
    const snapshot = await getDocs(historyRef);

    return snapshot.docs.map(doc => doc.data() as ReferralRecord);
  } catch (error) {
    console.error('Error getting referral history:', error);
    return [];
  }
};

// Check for referral code in URL and store it in sessionStorage
export const checkAndStoreReferralFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;

  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');

  if (refCode) {
    sessionStorage.setItem('pendingReferralCode', refCode.toUpperCase());
    // Clean the URL
    const url = new URL(window.location.href);
    url.searchParams.delete('ref');
    window.history.replaceState({}, '', url.toString());
    return refCode.toUpperCase();
  }

  return sessionStorage.getItem('pendingReferralCode');
};

// Get pending referral code from session
export const getPendingReferralCode = (): string | null => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('pendingReferralCode');
};

// Clear pending referral code
export const clearPendingReferralCode = (): void => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('pendingReferralCode');
};

// Use credits at checkout - returns amount actually used
export const useReferralCredits = async (
  userId: string,
  amountCents: number
): Promise<{ creditsUsed: number; remaining: number }> => {
  if (!isConfigured || !db || amountCents <= 0) {
    return { creditsUsed: 0, remaining: 0 };
  }

  try {
    const credits = await getUserReferralCredits(userId);
    const creditsToUse = Math.min(amountCents, credits.totalCredits);

    if (creditsToUse <= 0) {
      return { creditsUsed: 0, remaining: credits.totalCredits };
    }

    const userRefDoc = doc(db, 'users', userId, 'referral', 'info');
    await updateDoc(userRefDoc, {
      creditsUsed: (credits.creditsUsed || 0) + creditsToUse,
    });

    return {
      creditsUsed: creditsToUse,
      remaining: credits.totalCredits - creditsToUse,
    };
  } catch (error) {
    console.error('Error using referral credits:', error);
    return { creditsUsed: 0, remaining: 0 };
  }
};

// Award credits to referrer when their referral converts to Pro
// Called by webhook when a referred user upgrades
export const awardReferrerCredits = async (
  refereeId: string
): Promise<{ success: boolean; referrerId?: string; creditsAwarded?: number }> => {
  if (!isConfigured || !db) {
    return { success: false };
  }

  try {
    // Get the referee's referral info to find who referred them
    const refereeRefDoc = doc(db, 'users', refereeId, 'referral', 'info');
    const refereeRefSnap = await getDoc(refereeRefDoc);

    if (!refereeRefSnap.exists()) {
      return { success: false }; // User wasn't referred
    }

    const refereeRef = refereeRefSnap.data() as UserReferralInfo;
    const referrerId = refereeRef.referredBy;

    if (!referrerId) {
      return { success: false }; // User wasn't referred
    }

    // Check if referrer can still earn credits (hasn't hit cap)
    const referrerStatus = await getReferrerCreditStatus(referrerId);
    if (!referrerStatus.canEarnMore) {
      return { success: true, referrerId, creditsAwarded: 0 }; // At cap, no credits
    }

    // Check if we already awarded credits for this referral
    const recordId = `${referrerId}_${refereeId}`;
    const recordRef = doc(db, 'users', referrerId, 'referralHistory', recordId);
    const recordSnap = await getDoc(recordRef);

    if (recordSnap.exists()) {
      const record = recordSnap.data() as ReferralRecord;
      if (record.creditsAwarded > 0) {
        return { success: true, referrerId, creditsAwarded: 0 }; // Already awarded
      }
    }

    const creditsToAward = REFERRAL_CONFIG.referrerReward.creditsCents;

    // Update referrer's credits
    const referrerDocRef = doc(db, 'users', referrerId, 'referral', 'info');
    await updateDoc(referrerDocRef, {
      proConversions: increment(1),
      referralCredits: increment(creditsToAward),
    });

    // Update the referral record
    await updateDoc(recordRef, {
      status: 'converted_pro',
      creditsAwarded: creditsToAward,
      convertedAt: new Date().toISOString(),
    });

    return { success: true, referrerId, creditsAwarded: creditsToAward };
  } catch (error) {
    console.error('Error awarding referrer credits:', error);
    return { success: false };
  }
};

// Helper to format cents as dollars
export const formatCentsAsDollars = (cents: number): string => {
  return `$${(cents / 100).toFixed(2)}`;
};
