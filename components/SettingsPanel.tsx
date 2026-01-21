import React, { useState, useEffect, type FC } from 'react';
import {
  User, Loader2, Crown, Coins, Palette, Moon, Sun, CloudDownload, Download, Database, Gift, MessageSquare, Send
} from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { auth } from '../services/firebase';
import { clearDatabase, loadCourses } from '../services/storage';
import { getCreditsInfo } from '../services/subscriptionService';
import { submitFeedback, FeedbackType } from '../services/feedbackService';
import { PricingModal } from './PricingModal';
import { STRIPE_CONFIG } from '../services/stripeConfig';
import { ReferralPanel } from './ReferralPanel';
import { getUserReferralInfo } from '../services/referralService';

interface Props {
  user: any;
  onLogout: () => void;
}

export const SettingsPanel: FC<Props> = ({ user, onLogout }) => {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [autoBackup, setAutoBackup] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Subscription state
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [creditsInfo, setCreditsInfo] = useState<{
    status: 'free' | 'pro';
    monthlyRemaining: number;
    monthlyLimit: number;
    purchased: number;
    total: number;
    plan?: string;
    expiresAt?: string;
  } | null>(null);
  const [hasReferralDiscount, setHasReferralDiscount] = useState(false);

  // Feedback state
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('suggestion');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // Check URL for payment status
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const paymentStatus = params.get('payment');
    if (paymentStatus === 'success') {
      setMessage({ type: 'success', text: 'Payment successful! Your account has been upgraded.' });
      // Remove the query param
      window.history.replaceState({}, '', window.location.pathname + '#/settings');
      // Refresh credits info
      loadCreditsInfo();
    } else if (paymentStatus === 'cancelled') {
      setMessage({ type: 'error', text: 'Payment was cancelled.' });
      window.history.replaceState({}, '', window.location.pathname + '#/settings');
    }
  }, []);

  // Load subscription info
  const loadCreditsInfo = async () => {
    if (user?.uid) {
      const info = await getCreditsInfo(user.uid);
      setCreditsInfo(info);
    }
  };

  // Check for referral discount
  const checkReferralDiscount = async () => {
    if (user?.uid) {
      const referralInfo = await getUserReferralInfo(user.uid);
      setHasReferralDiscount(!!referralInfo?.referredBy);
    }
  };

  useEffect(() => {
    loadCreditsInfo();
    checkReferralDiscount();
  }, [user?.uid]);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('studystack_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('studystack_theme', 'light');
    }
  };

  const handleUpdateProfile = async () => {
    // FIX: Guard against auth being undefined.
    // We capture currentUser in a variable to ensure TS knows it's defined during the call.
    const currentUser = auth?.currentUser;
    
    if (!currentUser) {
        setMessage({ type: 'error', text: 'Authentication service not ready.' });
        return;
    }

    setLoading(true);
    setMessage(null);
    try {
      await updateProfile(currentUser, { displayName });
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (e: any) {
      setMessage({ type: 'error', text: 'Failed to update profile: ' + e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleFactoryReset = async () => {
    if (confirm("DANGER: This will delete ALL your courses, flashcards, and notes stored on this device. This cannot be undone. Are you sure?")) {
        await clearDatabase();
        window.location.reload();
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const courses = await loadCourses();

      // Strip blob URLs (they won't work after export anyway)
      const exportData = courses.map(course => {
        const { pdfUrl, pdfThumbnail, ...rest } = course;
        return {
          ...rest,
          lectures: rest.lectures.map(l => {
            const { audioUrl, ...lRest } = l;
            return lRest;
          })
        };
      });

      const exportPayload = {
        version: '2.2.0',
        exportDate: new Date().toISOString(),
        courses: exportData
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studystack-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: 'Data exported successfully!' });
    } catch (e: any) {
      setMessage({ type: 'error', text: 'Export failed: ' + e.message });
    } finally {
      setExporting(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackMessage.trim()) {
      setMessage({ type: 'error', text: 'Please enter a message' });
      return;
    }

    setFeedbackSubmitting(true);
    setMessage(null);

    const result = await submitFeedback(user.uid, user.email, {
      type: feedbackType,
      message: feedbackMessage,
    });

    if (result.success) {
      setMessage({ type: 'success', text: 'Thanks for your feedback!' });
      setFeedbackMessage('');
      setFeedbackType('suggestion');
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to submit feedback' });
    }

    setFeedbackSubmitting(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6 md:space-y-8 animate-fade-in">
      <header>
        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Settings</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your account and preferences.</p>
      </header>

      {/* Account Section */}
      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
         <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center gap-4">
             <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-3xl overflow-hidden">
                 {user.photoURL ? <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover"/> : <User className="w-8 h-8 text-slate-300 dark:text-slate-500" />}
             </div>
             <div>
                 <div className="font-bold text-lg text-slate-800 dark:text-slate-100">{user.email}</div>
                 <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Account Type: Student</div>
             </div>
         </div>

         <div className="p-6 space-y-4">
             <div>
                 <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">Display Name</label>
                 <div className="flex flex-col sm:flex-row gap-2">
                     <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="flex-1 p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary outline-none bg-white dark:bg-slate-700 dark:text-slate-100"
                        placeholder="Your Name"
                     />
                     <button
                        onClick={handleUpdateProfile}
                        disabled={loading || displayName === user.displayName}
                        className="px-6 py-3 sm:py-2 bg-slate-800 dark:bg-slate-600 text-white font-bold rounded-lg hover:bg-slate-700 dark:hover:bg-slate-500 disabled:opacity-50 transition-colors"
                     >
                         {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                     </button>
                 </div>
                 {message && (
                     <div className={`mt-3 text-sm font-bold ${message.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                         {message.text}
                     </div>
                 )}
             </div>
         </div>
      </section>

      {/* Subscription & Billing */}
      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700">
             <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center"><Crown className="w-4 h-4 mr-2 text-amber-500" />Subscription & Billing</h3>
          </div>
          <div className="p-4 md:p-6 space-y-6">
              {/* Current Plan */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${
                        creditsInfo?.status === 'pro'
                          ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                      }`}>
                          {creditsInfo?.status === 'pro' ? <Crown className="w-6 h-6" /> : <User className="w-6 h-6" />}
                      </div>
                      <div>
                          <h4 className="font-bold text-slate-800 dark:text-slate-100">
                              {creditsInfo?.status === 'pro' ? 'Pro Plan' : 'Free Plan'}
                          </h4>
                          {creditsInfo?.status === 'pro' && creditsInfo?.plan && (
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {creditsInfo.plan.charAt(0).toUpperCase() + creditsInfo.plan.slice(1)} billing
                              {creditsInfo.expiresAt && ` • Renews ${new Date(creditsInfo.expiresAt).toLocaleDateString()}`}
                            </p>
                          )}
                          {creditsInfo?.status === 'free' && (
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Upgrade to unlock all features
                            </p>
                          )}
                      </div>
                  </div>
                  <button
                    onClick={() => setShowPricingModal(true)}
                    className={`px-5 py-2.5 font-bold rounded-lg transition-colors shadow-sm whitespace-nowrap ${
                      creditsInfo?.status === 'pro'
                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                        : 'bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:from-amber-500 hover:to-orange-600'
                    }`}
                  >
                      {creditsInfo?.status === 'pro' ? 'Manage Plan' : 'Upgrade to Pro'}
                  </button>
              </div>

              {/* Credits Display */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">AI Generation Credits</h4>
                      <span className="text-xs font-bold text-slate-400">Resets monthly</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                      <div className="flex items-end gap-2 mb-3">
                          <span className="text-3xl font-bold text-primary">{creditsInfo?.total ?? '...'}</span>
                          <span className="text-slate-400 mb-1">credits available</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden mb-3">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full transition-all duration-500"
                            style={{ width: `${creditsInfo ? Math.min(100, (creditsInfo.total / creditsInfo.monthlyLimit) * 100) : 0}%` }}
                          />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>{creditsInfo?.monthlyRemaining ?? 0} / {creditsInfo?.monthlyLimit ?? 0} monthly</span>
                          {(creditsInfo?.purchased ?? 0) > 0 && (
                            <span className="text-green-600 dark:text-green-400">+{creditsInfo?.purchased} purchased</span>
                          )}
                      </div>
                  </div>
                  <button
                    onClick={() => setShowPricingModal(true)}
                    className="mt-3 w-full py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm font-bold rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors border border-green-200 dark:border-green-800"
                  >
                      <Coins className="w-4 h-4 mr-2 inline" />Buy More Credits
                  </button>
              </div>
          </div>
      </section>

      {/* Referral Program */}
      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700">
             <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center"><Gift className="w-4 h-4 mr-2 text-green-500" />Invite Friends</h3>
          </div>
          <div className="p-4 md:p-6">
              <ReferralPanel user={user} />
          </div>
      </section>

      {/* Feedback & Suggestions */}
      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700">
             <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center"><MessageSquare className="w-4 h-4 mr-2 text-blue-500" />Feedback & Suggestions</h3>
          </div>
          <div className="p-4 md:p-6 space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                  Found a bug? Have an idea? Let us know and we'll make it happen.
              </p>

              {/* Feedback Type */}
              <div className="flex flex-wrap gap-2">
                  {(['suggestion', 'bug', 'question', 'other'] as FeedbackType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFeedbackType(type)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                        feedbackType === type
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
              </div>

              {/* Message */}
              <textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="Tell us what's on your mind..."
                rows={4}
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-primary focus:border-primary outline-none bg-white dark:bg-slate-700 dark:text-slate-100 resize-none"
              />

              {/* Submit */}
              <button
                onClick={handleSubmitFeedback}
                disabled={feedbackSubmitting || !feedbackMessage.trim()}
                className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {feedbackSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="w-4 h-4" /> Send Feedback</>
                )}
              </button>
          </div>
      </section>

      {/* Appearance */}
      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700">
             <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center"><Palette className="w-4 h-4 mr-2 text-slate-400" />Appearance</h3>
          </div>
          <div className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                        {darkMode ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                        {darkMode ? 'Dark Mode' : 'Light Mode'}
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          {darkMode ? 'Easy on the eyes at night' : 'Bright and clean for daytime'}
                      </p>
                  </div>
                  <button
                    onClick={toggleDarkMode}
                    className={`relative w-14 h-8 rounded-full transition-colors ${darkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform flex items-center justify-center ${darkMode ? 'translate-x-7' : 'translate-x-1'}`}>
                      {darkMode ? <Moon className="w-3 h-3 text-indigo-600" /> : <Sun className="w-3 h-3 text-amber-500" />}
                    </div>
                  </button>
              </div>
          </div>
      </section>

      {/* Backup & Export */}
      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700">
             <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center"><CloudDownload className="w-4 h-4 mr-2 text-slate-400" />Backup & Export</h3>
          </div>
          <div className="p-4 md:p-6 space-y-6">
              {/* Export Data */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Export Data</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                          Download all your courses, flashcards, and study materials as a JSON file you can re-import later.
                      </p>
                  </div>
                  <button
                    onClick={handleExportData}
                    disabled={exporting}
                    className="px-4 py-3 sm:py-2 bg-primary text-white font-bold rounded-lg hover:bg-blue-600 transition-colors shadow-sm whitespace-nowrap w-full sm:w-auto disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                      {exporting ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Exporting...</>
                      ) : (
                        <><Download className="w-4 h-4" /> Export JSON</>
                      )}
                  </button>
              </div>

              {/* Auto Backup (Placeholder) */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                        Auto-Backup
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">Coming Soon</span>
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                          Automatically backup your data daily to keep it safe.
                      </p>
                  </div>
                  <button
                    onClick={() => setAutoBackup(!autoBackup)}
                    className={`relative w-14 h-8 rounded-full transition-colors ${autoBackup ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-600'} opacity-50 cursor-not-allowed`}
                    disabled
                  >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${autoBackup ? 'translate-x-7' : 'translate-x-1'}`}></div>
                  </button>
              </div>
          </div>
      </section>

      {/* Data Management */}
      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700">
             <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center"><Database className="w-4 h-4 mr-2 text-slate-400" />Data Management</h3>
          </div>
          <div className="p-4 md:p-6 bg-red-50/50 dark:bg-red-900/20">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                      <h4 className="font-bold text-red-800 dark:text-red-400 text-sm">Factory Reset</h4>
                      <p className="text-sm text-red-600 dark:text-red-300 mt-1 max-w-sm">
                          Permanently delete all courses, PDFs, and generated materials stored in this browser. This action cannot be undone.
                      </p>
                  </div>
                  <button
                    onClick={handleFactoryReset}
                    className="px-4 py-3 sm:py-2 bg-white dark:bg-slate-700 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-bold rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-300 transition-colors shadow-sm whitespace-nowrap w-full sm:w-auto"
                  >
                      Clear All Data
                  </button>
              </div>
          </div>
      </section>

      {/* App Info */}
      <div className="text-center text-xs text-slate-400 pt-8">
          <p className="mb-2">StudyStack v2.2.0 (Beta)</p>
          <button onClick={onLogout} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline">Log Out</button>
      </div>

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        userId={user.uid}
        userEmail={user.email || ''}
        currentStatus={creditsInfo?.status || 'free'}
        currentPlan={creditsInfo?.plan}
        expiresAt={creditsInfo?.expiresAt}
        creditsRemaining={creditsInfo?.total || 0}
        onToast={(msg, type) => setMessage({ type, text: msg })}
      />
    </div>
  );
};