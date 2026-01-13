// Email Service - Client-side wrapper for Resend API
// Triggers transactional emails for user lifecycle events

type EmailType =
  | 'welcome'
  | 'creditsLow'
  | 'upgradeNudge'
  | 'referralReminder'
  | 'paymentReceipt'
  | 'subscriptionConfirmed'
  | 'referralSignup'
  | 'referralSuccess'
  | 'subscriptionExpiring';

interface EmailData {
  name?: string;
  remaining?: number;
  daysActive?: number;
  referralCode?: string;
  plan?: string;
  amount?: string;
  date?: string;
  expiresAt?: string;
  friendName?: string;
  totalCredits?: string;
  daysLeft?: number;
}

// Send email via our API endpoint
const sendEmail = async (to: string, type: EmailType, data?: EmailData): Promise<boolean> => {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, type, data }),
    });

    if (!response.ok) {
      console.error('Email send failed:', await response.text());
      return false;
    }

    console.log(`📧 Email sent: ${type} to ${to}`);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
};

// --- Public API ---

// Send welcome email when user signs up
export const sendWelcomeEmail = async (email: string, name?: string): Promise<boolean> => {
  return sendEmail(email, 'welcome', { name });
};

// Send credits low alert (when user has < 5 credits)
export const sendCreditsLowEmail = async (
  email: string,
  name: string | undefined,
  remaining: number
): Promise<boolean> => {
  // Only send if they have 5 or fewer credits
  if (remaining > 5) return false;

  // Check if we already sent this alert recently (use localStorage to debounce)
  const lastSentKey = `email_credits_low_${email}`;
  const lastSent = localStorage.getItem(lastSentKey);
  const now = Date.now();

  // Don't send more than once per week
  if (lastSent && now - parseInt(lastSent) < 7 * 24 * 60 * 60 * 1000) {
    return false;
  }

  const success = await sendEmail(email, 'creditsLow', { name, remaining });
  if (success) {
    localStorage.setItem(lastSentKey, now.toString());
  }
  return success;
};

// Send upgrade nudge (after X days as free user)
export const sendUpgradeNudgeEmail = async (
  email: string,
  name: string | undefined,
  signupDate: Date
): Promise<boolean> => {
  const daysActive = Math.floor((Date.now() - signupDate.getTime()) / (24 * 60 * 60 * 1000));

  // Only send at day 7
  if (daysActive !== 7) return false;

  // Debounce check
  const lastSentKey = `email_upgrade_nudge_${email}`;
  const lastSent = localStorage.getItem(lastSentKey);
  if (lastSent) return false; // Only send once ever

  const success = await sendEmail(email, 'upgradeNudge', { name, daysActive });
  if (success) {
    localStorage.setItem(lastSentKey, Date.now().toString());
  }
  return success;
};

// Send referral reminder (after first month as Pro)
export const sendReferralReminderEmail = async (
  email: string,
  name: string | undefined,
  referralCode: string,
  proSinceDate: Date
): Promise<boolean> => {
  const daysSincePro = Math.floor((Date.now() - proSinceDate.getTime()) / (24 * 60 * 60 * 1000));

  // Only send after 30 days as Pro
  if (daysSincePro !== 30) return false;

  // Debounce check
  const lastSentKey = `email_referral_reminder_${email}`;
  const lastSent = localStorage.getItem(lastSentKey);
  if (lastSent) return false; // Only send once ever

  const success = await sendEmail(email, 'referralReminder', { name, referralCode });
  if (success) {
    localStorage.setItem(lastSentKey, Date.now().toString());
  }
  return success;
};

// Send payment receipt
export const sendPaymentReceiptEmail = async (
  email: string,
  name: string | undefined,
  plan: string,
  amount: string
): Promise<boolean> => {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return sendEmail(email, 'paymentReceipt', { name, plan, amount, date });
};

// Send subscription confirmed (welcome to Pro)
export const sendSubscriptionConfirmedEmail = async (
  email: string,
  name: string | undefined,
  plan: string,
  expiresAt: string
): Promise<boolean> => {
  return sendEmail(email, 'subscriptionConfirmed', { name, plan, expiresAt });
};

// Send referral signup notification (when friend signs up)
export const sendReferralSignupEmail = async (
  email: string,
  name: string | undefined,
  friendName: string
): Promise<boolean> => {
  return sendEmail(email, 'referralSignup', { name, friendName });
};

// Send referral success notification (when friend goes Pro)
export const sendReferralSuccessEmail = async (
  email: string,
  name: string | undefined,
  friendName: string,
  totalCredits: string
): Promise<boolean> => {
  return sendEmail(email, 'referralSuccess', { name, friendName, totalCredits });
};

// Send subscription expiring reminder
export const sendSubscriptionExpiringEmail = async (
  email: string,
  name: string | undefined,
  expiresAt: Date
): Promise<boolean> => {
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  // Only send at 7, 3, and 1 days before expiration
  if (![7, 3, 1].includes(daysLeft)) return false;

  // Debounce check - don't send same reminder twice
  const lastSentKey = `email_expiring_${email}_${daysLeft}`;
  const lastSent = localStorage.getItem(lastSentKey);
  if (lastSent) return false;

  const expiresAtStr = expiresAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const success = await sendEmail(email, 'subscriptionExpiring', {
    name,
    expiresAt: expiresAtStr,
    daysLeft,
  });

  if (success) {
    localStorage.setItem(lastSentKey, Date.now().toString());
  }
  return success;
};
