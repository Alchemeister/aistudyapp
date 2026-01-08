import React, { useState } from 'react';
import { Modal } from './Modal';
import { STRIPE_CONFIG, FEATURES } from '../services/stripeConfig';
import { upgradeToPro, buyCredits } from '../services/subscriptionService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  currentStatus: 'free' | 'pro';
  currentPlan?: string;
  expiresAt?: string;
  creditsRemaining: number;
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const PricingModal: React.FC<Props> = ({
  isOpen,
  onClose,
  userId,
  userEmail,
  currentStatus,
  currentPlan,
  expiresAt,
  creditsRemaining,
  onToast,
}) => {
  const [loading, setLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'plans' | 'credits'>('plans');

  const handleUpgrade = async (plan: 'monthly' | 'semester' | 'annual') => {
    setLoading(plan);
    try {
      await upgradeToPro(userId, userEmail, plan);
      // Will redirect to Stripe
    } catch (error: any) {
      onToast(error.message || 'Failed to start checkout', 'error');
      setLoading(null);
    }
  };

  const handleBuyCredits = async (pack: 'pack25' | 'pack50' | 'pack100') => {
    setLoading(pack);
    try {
      await buyCredits(userId, userEmail, pack);
      // Will redirect to Stripe
    } catch (error: any) {
      onToast(error.message || 'Failed to start checkout', 'error');
      setLoading(null);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" maxWidth="max-w-2xl">
      <div className="p-2">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
            {currentStatus === 'pro' ? 'Manage Your Plan' : 'Upgrade to Pro'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            {currentStatus === 'pro'
              ? `You're on the ${currentPlan} plan${expiresAt ? ` until ${formatDate(expiresAt)}` : ''}`
              : 'Unlock all features and supercharge your studying'
            }
          </p>
        </div>

        {/* Current Status Badge */}
        <div className="flex justify-center mb-6">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
            currentStatus === 'pro'
              ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
          }`}>
            {currentStatus === 'pro' ? (
              <>
                <i className="fas fa-crown"></i>
                Pro Member
              </>
            ) : (
              <>
                <i className="fas fa-user"></i>
                Free Plan • {creditsRemaining} credits left
              </>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('plans')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
                activeTab === 'plans'
                  ? 'bg-white dark:bg-slate-600 text-primary shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }`}
            >
              <i className="fas fa-rocket mr-2"></i>
              Subscription Plans
            </button>
            <button
              onClick={() => setActiveTab('credits')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
                activeTab === 'credits'
                  ? 'bg-white dark:bg-slate-600 text-green-600 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }`}
            >
              <i className="fas fa-coins mr-2"></i>
              Buy Credits
            </button>
          </div>
        </div>

        {/* Plans Tab */}
        {activeTab === 'plans' && (
          <>
            {/* Pricing Cards */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {/* Monthly */}
              <div className="border border-slate-200 dark:border-slate-600 rounded-xl p-4 hover:border-primary transition-colors">
                <div className="text-center mb-4">
                  <h3 className="font-bold text-slate-700 dark:text-slate-200">Monthly</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-slate-800 dark:text-white">$14.99</span>
                    <span className="text-slate-500 dark:text-slate-400">/mo</span>
                  </div>
                </div>
                <button
                  onClick={() => handleUpgrade('monthly')}
                  disabled={loading !== null || (currentStatus === 'pro' && currentPlan === 'monthly')}
                  className="w-full py-2.5 bg-primary text-white rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading === 'monthly' ? (
                    <i className="fas fa-circle-notch fa-spin"></i>
                  ) : currentStatus === 'pro' && currentPlan === 'monthly' ? (
                    'Current Plan'
                  ) : (
                    'Subscribe'
                  )}
                </button>
              </div>

              {/* Semester - Most Popular */}
              <div className="border-2 border-primary rounded-xl p-4 pt-6 relative bg-blue-50/50 dark:bg-blue-900/20">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  MOST POPULAR
                </div>
                <div className="text-center mb-4">
                  <h3 className="font-bold text-slate-700 dark:text-slate-200">Semester</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-slate-800 dark:text-white">$49.99</span>
                    <span className="text-slate-500 dark:text-slate-400">/4mo</span>
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400 font-bold mt-1">
                    Save ~$10
                  </div>
                </div>
                <button
                  onClick={() => handleUpgrade('semester')}
                  disabled={loading !== null || (currentStatus === 'pro' && currentPlan === 'semester')}
                  className="w-full py-2.5 bg-primary text-white rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading === 'semester' ? (
                    <i className="fas fa-circle-notch fa-spin"></i>
                  ) : currentStatus === 'pro' && currentPlan === 'semester' ? (
                    'Current Plan'
                  ) : (
                    'Subscribe'
                  )}
                </button>
              </div>

              {/* Annual - Best Value */}
              <div className="border border-amber-300 dark:border-amber-600 rounded-xl p-4 pt-6 relative bg-amber-50/50 dark:bg-amber-900/20">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  BEST VALUE
                </div>
                <div className="text-center mb-4">
                  <h3 className="font-bold text-slate-700 dark:text-slate-200">Annual</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-slate-800 dark:text-white">$99.99</span>
                    <span className="text-slate-500 dark:text-slate-400">/yr</span>
                  </div>
                  <div className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-1">
                    Save ~$80 (5 months free!)
                  </div>
                </div>
                <button
                  onClick={() => handleUpgrade('annual')}
                  disabled={loading !== null || (currentStatus === 'pro' && currentPlan === 'annual')}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-lg font-bold hover:from-amber-500 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading === 'annual' ? (
                    <i className="fas fa-circle-notch fa-spin"></i>
                  ) : currentStatus === 'pro' && currentPlan === 'annual' ? (
                    'Current Plan'
                  ) : (
                    'Subscribe'
                  )}
                </button>
              </div>
            </div>

            {/* Features Comparison */}
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
              <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-3 text-center">
                What's included in Pro
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <i className="fas fa-check text-green-500"></i>
                  1,000 generations/month
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <i className="fas fa-check text-green-500"></i>
                  Smart SRS Review
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <i className="fas fa-check text-green-500"></i>
                  Study Analytics
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <i className="fas fa-check text-green-500"></i>
                  AI Tutor
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <i className="fas fa-check text-green-500"></i>
                  Concept Maps
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <i className="fas fa-check text-green-500"></i>
                  Mock Tests
                </div>
              </div>
            </div>
          </>
        )}

        {/* Credits Tab */}
        {activeTab === 'credits' && (
          <>
            <p className="text-center text-slate-500 dark:text-slate-400 mb-4">
              Need more generations? Buy credit packs that never expire.
            </p>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {/* 25 Credits */}
              <div className="border border-slate-200 dark:border-slate-600 rounded-xl p-4 hover:border-green-400 transition-colors">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                    <i className="fas fa-coins text-green-500 text-xl"></i>
                  </div>
                  <h3 className="font-bold text-slate-700 dark:text-slate-200">25 Credits</h3>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-slate-800 dark:text-white">$2.99</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">$0.12 per credit</div>
                </div>
                <button
                  onClick={() => handleBuyCredits('pack25')}
                  disabled={loading !== null}
                  className="w-full py-2.5 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading === 'pack25' ? (
                    <i className="fas fa-circle-notch fa-spin"></i>
                  ) : (
                    'Buy Now'
                  )}
                </button>
              </div>

              {/* 50 Credits */}
              <div className="border-2 border-green-400 rounded-xl p-4 relative bg-green-50/50 dark:bg-green-900/20">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  POPULAR
                </div>
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                    <i className="fas fa-coins text-green-500 text-xl"></i>
                  </div>
                  <h3 className="font-bold text-slate-700 dark:text-slate-200">50 Credits</h3>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-slate-800 dark:text-white">$4.99</span>
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400 font-bold mt-1">$0.10 per credit</div>
                </div>
                <button
                  onClick={() => handleBuyCredits('pack50')}
                  disabled={loading !== null}
                  className="w-full py-2.5 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading === 'pack50' ? (
                    <i className="fas fa-circle-notch fa-spin"></i>
                  ) : (
                    'Buy Now'
                  )}
                </button>
              </div>

              {/* 100 Credits */}
              <div className="border border-slate-200 dark:border-slate-600 rounded-xl p-4 hover:border-green-400 transition-colors">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                    <i className="fas fa-coins text-green-500 text-xl"></i>
                  </div>
                  <h3 className="font-bold text-slate-700 dark:text-slate-200">100 Credits</h3>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-slate-800 dark:text-white">$7.99</span>
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400 font-bold mt-1">$0.08 per credit - Best deal!</div>
                </div>
                <button
                  onClick={() => handleBuyCredits('pack100')}
                  disabled={loading !== null}
                  className="w-full py-2.5 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading === 'pack100' ? (
                    <i className="fas fa-circle-notch fa-spin"></i>
                  ) : (
                    'Buy Now'
                  )}
                </button>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <i className="fas fa-info-circle mr-2"></i>
                Credits are used after your monthly allowance runs out. They never expire!
              </p>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-600 text-center">
          <p className="text-xs text-slate-400">
            Secure payment powered by <i className="fab fa-stripe text-indigo-500"></i> Stripe
          </p>
        </div>
      </div>
    </Modal>
  );
};
