import React from 'react';
import { Link } from 'react-router-dom';

export const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-primary hover:text-blue-600 mb-8 font-medium">
          <i className="fas fa-arrow-left"></i>
          Back to App
        </Link>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 md:p-12">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">Privacy Policy</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8">Last updated: January 2026</p>

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">1. Information We Collect</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                When you use StudyAI, we collect the following types of information:
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li><strong>Account Information:</strong> Email address, display name, and profile picture when you create an account using Google OAuth or email/password.</li>
                <li><strong>Study Content:</strong> Courses, chapters, flashcards, quizzes, notes, and other study materials you create within the app.</li>
                <li><strong>Usage Data:</strong> Information about how you interact with the app, including quiz scores, study progress, and feature usage.</li>
                <li><strong>Payment Information:</strong> When you subscribe or purchase credits, payment processing is handled by Stripe. We do not store your credit card information.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">2. How We Use Your Information</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Process your transactions and manage your subscription</li>
                <li>Sync your study materials across devices</li>
                <li>Generate AI-powered study content based on your materials</li>
                <li>Send you important updates about the service</li>
                <li>Respond to your questions and support requests</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">3. Data Storage</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                Your data is stored in the following ways:
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li><strong>Local Storage:</strong> PDFs, audio files, and study materials are stored locally in your browser's IndexedDB for offline access.</li>
                <li><strong>Cloud Storage:</strong> Course metadata and account information are synced to Firebase Firestore for cross-device access.</li>
                <li><strong>Third-Party Services:</strong> We use Google's Gemini AI to generate study content. Your text content is sent to Google's API for processing but is not stored by Google beyond the API call.</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">4. Data Sharing</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                We do not sell your personal information. We may share your information with:
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li><strong>Service Providers:</strong> Firebase (authentication, database), Stripe (payments), Google Gemini (AI content generation)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                <li><strong>Friends Feature:</strong> If you use the friends feature, your display name and email may be visible to users searching for friends</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">5. Your Rights</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                You have the right to:
              </p>
              <ul className="list-disc pl-6 text-slate-600 dark:text-slate-300 space-y-2">
                <li>Access and export your data at any time from the Settings page</li>
                <li>Delete your account and associated data</li>
                <li>Update your profile information</li>
                <li>Opt out of promotional communications</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">6. Data Security</h2>
              <p className="text-slate-600 dark:text-slate-300">
                We implement appropriate security measures to protect your data, including encryption in transit (HTTPS) and at rest. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">7. Children's Privacy</h2>
              <p className="text-slate-600 dark:text-slate-300">
                StudyAI is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">8. Changes to This Policy</h2>
              <p className="text-slate-600 dark:text-slate-300">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">9. Contact Us</h2>
              <p className="text-slate-600 dark:text-slate-300">
                If you have any questions about this Privacy Policy, please contact us at support@studyai.app
              </p>
            </section>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-slate-400">
          <Link to="/terms" className="hover:text-primary">Terms of Service</Link>
          <span className="mx-2">|</span>
          <Link to="/" className="hover:text-primary">Return to App</Link>
        </div>
      </div>
    </div>
  );
};
