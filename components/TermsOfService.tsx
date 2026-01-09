import React from 'react';
import { Link } from 'react-router-dom';

export const TermsOfService: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-primary hover:text-blue-600 mb-8 font-medium">
          <i className="fas fa-arrow-left"></i>
          Back to App
        </Link>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">Terms of Service</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8">Last updated: January 2026</p>

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">1. Acceptance of Terms</h2>
              <p className="text-slate-600 dark:text-slate-300">
                By accessing or using StudyStack ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">2. Description of Service</h2>
              <p className="text-slate-600 dark:text-slate-300">
                StudyStack is an AI-powered study application that helps users create and manage study materials including flashcards, quizzes, notes, and more. The Service includes both free and paid subscription tiers.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">3. User Accounts</h2>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>You must provide accurate and complete information when creating an account.</li>
                <li>You are responsible for maintaining the security of your account credentials.</li>
                <li>You must notify us immediately of any unauthorized access to your account.</li>
                <li>You may not share your account with others or create multiple accounts.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">4. Subscription and Payments</h2>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li><strong>Free Tier:</strong> Includes limited AI generations per month and basic features.</li>
                <li><strong>Pro Subscription:</strong> Provides access to all features including AI Tutor, Concept Maps, and Mock Tests.</li>
                <li><strong>Billing:</strong> Subscriptions are billed in advance on a monthly, semester, or annual basis.</li>
                <li><strong>Credit Packs:</strong> One-time credit purchases do not expire and can be used after monthly allowances are exhausted.</li>
                <li><strong>Refunds:</strong> Refund requests are handled on a case-by-case basis. Contact support within 7 days of purchase.</li>
                <li><strong>Cancellation:</strong> You may cancel your subscription at any time. Access continues until the end of the billing period.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">5. Acceptable Use</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">You agree NOT to:</p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>Use the Service for any illegal purpose or in violation of any laws</li>
                <li>Upload content that infringes on intellectual property rights</li>
                <li>Attempt to gain unauthorized access to the Service or its systems</li>
                <li>Use automated scripts or bots to access the Service</li>
                <li>Share or resell your account access</li>
                <li>Use the Service to generate harmful, abusive, or inappropriate content</li>
                <li>Circumvent any usage limits or restrictions</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">6. Intellectual Property</h2>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li><strong>Your Content:</strong> You retain ownership of content you create or upload. By using the Service, you grant us a license to store, process, and display your content as needed to provide the Service.</li>
                <li><strong>Our Content:</strong> The StudyStack name, logo, and all related intellectual property are owned by us. You may not use our trademarks without permission.</li>
                <li><strong>AI-Generated Content:</strong> Content generated by our AI features is provided for your personal educational use.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">7. Privacy</h2>
              <p className="text-slate-600 dark:text-slate-300">
                Your use of the Service is also governed by our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>, which describes how we collect, use, and protect your information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">8. Disclaimers</h2>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>The Service is provided "as is" without warranties of any kind.</li>
                <li>AI-generated content may contain errors and should be verified for accuracy.</li>
                <li>We do not guarantee that the Service will be uninterrupted or error-free.</li>
                <li>StudyStack is a study aid and should not replace traditional learning methods or professional educational guidance.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">9. Limitation of Liability</h2>
              <p className="text-slate-600 dark:text-slate-300">
                To the maximum extent permitted by law, StudyStack and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data, profits, or business opportunities.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">10. Termination</h2>
              <p className="text-slate-600 dark:text-slate-300">
                We reserve the right to suspend or terminate your account at any time for violations of these Terms or for any other reason at our discretion. You may delete your account at any time from the Settings page.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">11. Changes to Terms</h2>
              <p className="text-slate-600 dark:text-slate-300">
                We may modify these Terms at any time. We will notify users of significant changes via email or in-app notification. Continued use of the Service after changes constitutes acceptance of the new Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">12. Contact</h2>
              <p className="text-slate-600 dark:text-slate-300">
                For questions about these Terms of Service, please contact us at support@studystack.ai
              </p>
            </section>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-slate-400">
          <Link to="/privacy" className="hover:text-primary">Privacy Policy</Link>
          <span className="mx-2">|</span>
          <Link to="/" className="hover:text-primary">Return to App</Link>
        </div>
      </div>
    </div>
  );
};
