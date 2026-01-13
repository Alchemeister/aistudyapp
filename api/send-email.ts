import type { VercelRequest, VercelResponse } from '@vercel/node';

// Resend API endpoint for sending transactional emails
// Get your API key at https://resend.com/api-keys

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'StudyStack <hello@send.studystack.ai>';

// Email templates
const templates = {
  welcome: (name: string) => ({
    subject: 'Welcome to StudyStack! 🎓',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3b82f6; margin: 0;">StudyStack</h1>
        </div>

        <h2 style="color: #1e293b;">Welcome${name ? `, ${name}` : ''}! 👋</h2>

        <p style="color: #475569; line-height: 1.6;">
          You just unlocked the smartest way to study. Here's what you can do:
        </p>

        <ul style="color: #475569; line-height: 1.8;">
          <li><strong>Upload a PDF</strong> - textbooks, slides, notes</li>
          <li><strong>Generate flashcards</strong> - AI creates them in seconds</li>
          <li><strong>Take quizzes</strong> - test your knowledge</li>
          <li><strong>Review with SRS</strong> - remember everything long-term</li>
        </ul>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://studystack.app" style="background: linear-gradient(to right, #3b82f6, #2563eb); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Start Studying
          </a>
        </div>

        <p style="color: #475569; font-size: 14px;">
          You have <strong>25 free generations</strong> this month. Make them count!
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />

        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          StudyStack - Study smarter, not harder
        </p>
      </div>
    `,
  }),

  creditsLow: (name: string, remaining: number) => ({
    subject: `You have ${remaining} credits left 📊`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3b82f6; margin: 0;">StudyStack</h1>
        </div>

        <h2 style="color: #1e293b;">Running low on credits${name ? `, ${name}` : ''}</h2>

        <p style="color: #475569; line-height: 1.6;">
          You have <strong>${remaining} generation${remaining === 1 ? '' : 's'}</strong> remaining this month.
        </p>

        <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="color: #92400e; margin: 0;">
            <strong>Pro tip:</strong> Upgrade to Pro for 1,000 generations/month, plus AI Tutor, lecture recording, and more.
          </p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://studystack.app/#/settings" style="background: linear-gradient(to right, #f59e0b, #d97706); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Upgrade to Pro - 50% off first month
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />

        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          StudyStack - Study smarter, not harder
        </p>
      </div>
    `,
  }),

  upgradeNudge: (name: string, daysActive: number) => ({
    subject: 'Unlock your full potential 🚀',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3b82f6; margin: 0;">StudyStack</h1>
        </div>

        <h2 style="color: #1e293b;">You've been studying for ${daysActive} days! 🎉</h2>

        <p style="color: #475569; line-height: 1.6;">
          Hey${name ? ` ${name}` : ''}, you're building great study habits. Ready to take it to the next level?
        </p>

        <div style="background: #eff6ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #1e40af; margin-top: 0;">Pro features you're missing:</h3>
          <ul style="color: #1e40af; line-height: 1.8; margin-bottom: 0;">
            <li>🎙️ Lecture recording & transcription</li>
            <li>💬 AI Tutor - ask questions about your material</li>
            <li>🧠 Concept maps & connections</li>
            <li>📊 1,000 generations per month</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://studystack.app/#/settings" style="background: linear-gradient(to right, #3b82f6, #2563eb); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Try Pro - First month 50% off
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />

        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          StudyStack - Study smarter, not harder
        </p>
      </div>
    `,
  }),

  referralReminder: (name: string, referralCode: string) => ({
    subject: 'Earn a free semester 🎁',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3b82f6; margin: 0;">StudyStack</h1>
        </div>

        <h2 style="color: #1e293b;">Share the love, get rewarded 💝</h2>

        <p style="color: #475569; line-height: 1.6;">
          Hey${name ? ` ${name}` : ''}, enjoying StudyStack Pro? Share it with friends and earn credits!
        </p>

        <div style="background: #f0fdf4; border: 2px dashed #22c55e; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
          <p style="color: #166534; margin: 0 0 10px 0; font-size: 14px;">Your referral code:</p>
          <p style="color: #166534; font-size: 24px; font-weight: bold; font-family: monospace; margin: 0; letter-spacing: 2px;">
            ${referralCode}
          </p>
        </div>

        <div style="background: #faf5ff; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="color: #7c3aed; margin: 0;">
            <strong>How it works:</strong><br/>
            • Your friend gets <strong>$7.50 off</strong> their first purchase<br/>
            • You earn <strong>$7.50 credit</strong> when they go Pro<br/>
            • Refer 6 friends = <strong>free semester!</strong> ($45 in credits)
          </p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://studystack.app/?ref=${referralCode}" style="background: linear-gradient(to right, #22c55e, #16a34a); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Share Your Link
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />

        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          StudyStack - Study smarter, not harder
        </p>
      </div>
    `,
  }),

  // Payment receipt email
  paymentReceipt: (name: string, plan: string, amount: string, date: string) => ({
    subject: 'Your StudyStack receipt 🧾',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3b82f6; margin: 0;">StudyStack</h1>
        </div>

        <h2 style="color: #1e293b;">Payment Received ✓</h2>

        <p style="color: #475569; line-height: 1.6;">
          Thanks${name ? `, ${name}` : ''}! Here's your receipt:
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; color: #475569;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Plan</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">StudyStack Pro (${plan})</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Amount</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">${amount}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Date</strong></td>
              <td style="padding: 8px 0; text-align: right;">${date}</td>
            </tr>
          </table>
        </div>

        <p style="color: #475569; font-size: 14px;">
          Your Pro features are now active. Time to study smarter!
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://studystack.app" style="background: linear-gradient(to right, #3b82f6, #2563eb); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Start Studying
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />

        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          Questions? Reply to this email or visit studystack.app<br/>
          StudyStack - Study smarter, not harder
        </p>
      </div>
    `,
  }),

  // Subscription confirmed (welcome to Pro)
  subscriptionConfirmed: (name: string, plan: string, expiresAt: string) => ({
    subject: 'Welcome to StudyStack Pro! 🚀',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3b82f6; margin: 0;">StudyStack</h1>
        </div>

        <div style="text-align: center; margin-bottom: 20px;">
          <span style="background: linear-gradient(to right, #f59e0b, #d97706); color: white; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: bold;">
            ⭐ PRO MEMBER
          </span>
        </div>

        <h2 style="color: #1e293b; text-align: center;">You're all set${name ? `, ${name}` : ''}!</h2>

        <p style="color: #475569; line-height: 1.6; text-align: center;">
          Your ${plan} plan is now active. Here's what you unlocked:
        </p>

        <div style="background: #eff6ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <ul style="color: #1e40af; line-height: 2; margin: 0; padding-left: 20px;">
            <li>🎙️ <strong>Lecture Recording</strong> - Record & transcribe automatically</li>
            <li>💬 <strong>AI Tutor</strong> - Ask questions about your material</li>
            <li>🧠 <strong>Concept Maps</strong> - Visualize connections</li>
            <li>📝 <strong>1,000 generations/month</strong> - Flashcards, quizzes & more</li>
            <li>🎯 <strong>Practice Problems</strong> - STEM problems with solutions</li>
          </ul>
        </div>

        <p style="color: #64748b; font-size: 14px; text-align: center;">
          Your plan renews on <strong>${expiresAt}</strong>
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://studystack.app" style="background: linear-gradient(to right, #3b82f6, #2563eb); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Start Exploring Pro Features
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />

        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          StudyStack - Study smarter, not harder
        </p>
      </div>
    `,
  }),

  // Referral signup - when a friend signs up using your code
  referralSignup: (name: string, friendName: string) => ({
    subject: 'Your friend just joined StudyStack! 🎉',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3b82f6; margin: 0;">StudyStack</h1>
        </div>

        <h2 style="color: #1e293b;">Great news${name ? `, ${name}` : ''}! 🎉</h2>

        <p style="color: #475569; line-height: 1.6;">
          <strong>${friendName || 'Someone'}</strong> just signed up using your referral code!
        </p>

        <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="color: #92400e; margin: 0;">
            <strong>Next step:</strong> When they upgrade to Pro, you'll earn <strong>$7.50 in credits</strong> automatically!
          </p>
        </div>

        <p style="color: #475569; line-height: 1.6;">
          Keep sharing your code — 6 referrals = a free semester ($45 in credits).
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://studystack.app/#/settings" style="background: linear-gradient(to right, #22c55e, #16a34a); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            View Your Referrals
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />

        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          StudyStack - Study smarter, not harder
        </p>
      </div>
    `,
  }),

  // Referral success - when a friend goes Pro
  referralSuccess: (name: string, friendName: string, totalCredits: string) => ({
    subject: 'You earned $7.50! 💰',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3b82f6; margin: 0;">StudyStack</h1>
        </div>

        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 48px;">🎊</span>
        </div>

        <h2 style="color: #1e293b; text-align: center;">Cha-ching${name ? `, ${name}` : ''}!</h2>

        <p style="color: #475569; line-height: 1.6; text-align: center;">
          <strong>${friendName || 'Your friend'}</strong> just upgraded to Pro!
        </p>

        <div style="background: linear-gradient(to right, #22c55e, #16a34a); border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center; color: white;">
          <p style="margin: 0 0 8px 0; font-size: 14px; opacity: 0.9;">You earned</p>
          <p style="margin: 0; font-size: 36px; font-weight: bold;">$7.50</p>
          <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">Total credits: ${totalCredits}</p>
        </div>

        <p style="color: #475569; line-height: 1.6; text-align: center;">
          Your credits will automatically apply to your next purchase.
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://studystack.app/#/settings" style="background: linear-gradient(to right, #3b82f6, #2563eb); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            View Your Credits
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />

        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          StudyStack - Study smarter, not harder
        </p>
      </div>
    `,
  }),

  // Subscription expiring soon
  subscriptionExpiring: (name: string, expiresAt: string, daysLeft: number) => ({
    subject: `Your Pro subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'} ⏰`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3b82f6; margin: 0;">StudyStack</h1>
        </div>

        <h2 style="color: #1e293b;">Hey${name ? ` ${name}` : ''}, heads up! ⏰</h2>

        <p style="color: #475569; line-height: 1.6;">
          Your StudyStack Pro subscription expires on <strong>${expiresAt}</strong> (${daysLeft} day${daysLeft === 1 ? '' : 's'} from now).
        </p>

        <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="color: #92400e; margin: 0;">
            <strong>After expiration:</strong> You'll lose access to lecture recording, AI tutor, and your generation limit drops to 25/month.
          </p>
        </div>

        <p style="color: #475569; line-height: 1.6;">
          Renew now to keep your Pro features and study streak going!
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="https://studystack.app/#/settings" style="background: linear-gradient(to right, #f59e0b, #d97706); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Renew Pro Subscription
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />

        <p style="color: #94a3b8; font-size: 12px; text-align: center;">
          StudyStack - Study smarter, not harder
        </p>
      </div>
    `,
  }),
};

type EmailType = keyof typeof templates;

interface SendEmailRequest {
  to: string;
  type: EmailType;
  data?: {
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
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    const { to, type, data = {} } = req.body as SendEmailRequest;

    if (!to || !type) {
      return res.status(400).json({ error: 'Missing required fields: to, type' });
    }

    if (!templates[type]) {
      return res.status(400).json({ error: `Invalid email type: ${type}` });
    }

    // Generate email content based on type
    let emailContent;
    switch (type) {
      case 'welcome':
        emailContent = templates.welcome(data.name || '');
        break;
      case 'creditsLow':
        emailContent = templates.creditsLow(data.name || '', data.remaining || 0);
        break;
      case 'upgradeNudge':
        emailContent = templates.upgradeNudge(data.name || '', data.daysActive || 7);
        break;
      case 'referralReminder':
        emailContent = templates.referralReminder(data.name || '', data.referralCode || 'XXXXXXXX');
        break;
      case 'paymentReceipt':
        emailContent = templates.paymentReceipt(
          data.name || '',
          data.plan || 'Monthly',
          data.amount || '$0.00',
          data.date || new Date().toLocaleDateString()
        );
        break;
      case 'subscriptionConfirmed':
        emailContent = templates.subscriptionConfirmed(
          data.name || '',
          data.plan || 'Monthly',
          data.expiresAt || 'N/A'
        );
        break;
      case 'referralSignup':
        emailContent = templates.referralSignup(data.name || '', data.friendName || 'Someone');
        break;
      case 'referralSuccess':
        emailContent = templates.referralSuccess(
          data.name || '',
          data.friendName || 'Your friend',
          data.totalCredits || '$7.50'
        );
        break;
      case 'subscriptionExpiring':
        emailContent = templates.subscriptionExpiring(
          data.name || '',
          data.expiresAt || 'soon',
          data.daysLeft || 3
        );
        break;
      default:
        return res.status(400).json({ error: 'Unknown email type' });
    }

    // Send via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Resend API error:', error);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    const result = await response.json();
    return res.status(200).json({ success: true, id: result.id });

  } catch (error: any) {
    console.error('Email send error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send email' });
  }
}
