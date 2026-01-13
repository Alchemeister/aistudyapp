import React, { useState, useEffect } from 'react';
import { Crown, User, Rocket, Coins, Loader2, Check, Info, Gift } from 'lucide-react';
import { Modal } from './Modal';
import { STRIPE_CONFIG, FEATURES } from '../services/stripeConfig';
import { upgradeToPro, buyCredits } from '../services/subscriptionService';
import { getUserReferralCredits, formatCentsAsDollars } from '../services/referralService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  currentStatus: 'free' | 'pro';
  currentPlan?: string;
  expiresAt?: string;
  creditsRemaining: number;
  onToast: (msg: string, type: 'success' | 'error') => void;
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
  const [referralCredits, setReferralCredits] = useState(0);
  const [applyCredits, setApplyCredits] = useState(true);

  // Load referral credits when modal opens
  useEffect(() => {
    if (isOpen && userId) {
      getUserReferralCredits(userId).then(credits => {
        setReferralCredits(credits.totalCredits);
      });
    }
  }, [isOpen, userId]);

  const handleUpgrade = async (plan: 'monthly' | 'semester' | 'annual') => {
    setLoading(plan);
    try {
      // SECURITY: Credits are verified and deducted server-side after successful payment
      // We just pass whether user wants to apply credits - server validates actual amount
      await upgradeToPro(plan, applyCredits && referralCredits > 0);
      // Will redirect to Stripe
    } catch (error: any) {
      onToast(error.message || 'Failed to start checkout', 'error');
      setLoading(null);
    }
  };

  const handleBuyCredits = async (pack: 'pack25' | 'pack50' | 'pack100') => {
    setLoading(pack);
    try {
      await buyCredits(pack);
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
                <Crown className="w-4 h-4" />
                Pro Member
              </>
            ) : (
              <>
                <User className="w-4 h-4" />
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
              <Rocket className="w-4 h-4 mr-2" />
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
              <Coins className="w-4 h-4 mr-2" />
              Buy Credits
            </button>
          </div>
        </div>

        {/* Plans Tab */}
        {activeTab === 'plans' && (
          <>
            {/* Referral Credits Banner */}
            {referralCredits > 0 && currentStatus === 'free' && (
              <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                      <Gift className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="font-bold text-green-700 dark:text-green-300">
                        {formatCentsAsDollars(referralCredits)} in referral credits!
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400">
                        Will be applied at checkout
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyCredits}
                      onChange={(e) => setApplyCredits(e.target.checked)}
                      className="w-4 h-4 rounded border-green-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-green-700 dark:text-green-300">Apply</span>
                  </label>
                </div>
              </div>
            )}

            {/* Pricing Cards */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              {/* Monthly */}
              {(() => {
                const monthlyPrice = 1499;
                const monthlyCreditsApplied = applyCredits ? Math.min(referralCredits, monthlyPrice) : 0;
                const monthlyFinal = monthlyPrice - monthlyCreditsApplied;
                const hasMonthlyDiscount = monthlyCreditsApplied > 0 && currentStatus === 'free';

                return (
                  <div className={`border rounded-xl p-4 hover:border-primary transition-colors ${
                    hasMonthlyDiscount
                      ? 'border-green-300 dark:border-green-600 bg-green-50/30 dark:bg-green-900/10'
                      : 'border-slate-200 dark:border-slate-600'
                  }`}>
                    <div className="text-center mb-4">
                      <h3 className="font-bold text-slate-700 dark:text-slate-200">Monthly</h3>
                      <div className="mt-2">
                        {hasMonthlyDiscount ? (
                          <>
                            <span className="text-lg text-slate-400 line-through mr-2">$14.99</span>
                            <span className="text-3xl font-bold text-green-600 dark:text-green-400">
                              {formatCentsAsDollars(monthlyFinal)}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">/mo</span>
                          </>
                        ) : (
                          <>
                            <span className="text-3xl font-bold text-slate-800 dark:text-white">$14.99</span>
                            <span className="text-slate-500 dark:text-slate-400">/mo</span>
                          </>
                        )}
                      </div>
                      {hasMonthlyDiscount && (
                        <div className="text-xs text-green-600 dark:text-green-400 font-bold mt-1">
                          {formatCentsAsDollars(monthlyCreditsApplied)} credit applied!
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleUpgrade('monthly')}
                      disabled={loading !== null || (currentStatus === 'pro' && currentPlan === 'monthly')}
                      className="w-full py-2.5 bg-primary text-white rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {loading === 'monthly' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : currentStatus === 'pro' && currentPlan === 'monthly' ? (
                        'Current Plan'
                      ) : (
                        'Subscribe'
                      )}
                    </button>
                  </div>
                );
              })()}

              {/* Semester - Most Popular */}
              {(() => {
                const semesterPrice = 4999;
                const semesterCreditsApplied = applyCredits ? Math.min(referralCredits, semesterPrice) : 0;
                const semesterFinal = semesterPrice - semesterCreditsApplied;
                const hasSemesterDiscount = semesterCreditsApplied > 0 && currentStatus === 'free';

                return (
                  <div className={`border-2 rounded-xl p-4 pt-6 relative ${
                    hasSemesterDiscount
                      ? 'border-green-400 dark:border-green-500 bg-green-50/50 dark:bg-green-900/20'
                      : 'border-primary bg-blue-50/50 dark:bg-blue-900/20'
                  }`}>
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${
                      hasSemesterDiscount ? 'bg-green-500' : 'bg-primary'
                    }`}>
                      {hasSemesterDiscount ? `${formatCentsAsDollars(semesterCreditsApplied)} OFF` : 'MOST POPULAR'}
                    </div>
                    <div className="text-center mb-4">
                      <h3 className="font-bold text-slate-700 dark:text-slate-200">Semester</h3>
                      <div className="mt-2">
                        {hasSemesterDiscount ? (
                          <>
                            <span className="text-lg text-slate-400 line-through mr-2">$49.99</span>
                            <span className="text-3xl font-bold text-green-600 dark:text-green-400">
                              {formatCentsAsDollars(semesterFinal)}
                            </span>
                          </>
                        ) : (
                          <span className="text-3xl font-bold text-slate-800 dark:text-white">$49.99</span>
                        )}
                        <span className="text-slate-500 dark:text-slate-400">/4mo</span>
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400 font-bold mt-1">
                        {hasSemesterDiscount ? `Credit applied!` : 'Save ~$10'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUpgrade('semester')}
                      disabled={loading !== null || (currentStatus === 'pro' && currentPlan === 'semester')}
                      className="w-full py-2.5 bg-primary text-white rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {loading === 'semester' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : currentStatus === 'pro' && currentPlan === 'semester' ? (
                        'Current Plan'
                      ) : (
                        'Subscribe'
                      )}
                    </button>
                  </div>
                );
              })()}

              {/* Annual - Best Value */}
              {(() => {
                const annualPrice = 9999;
                const annualCreditsApplied = applyCredits ? Math.min(referralCredits, annualPrice) : 0;
                const annualFinal = annualPrice - annualCreditsApplied;
                const hasAnnualDiscount = annualCreditsApplied > 0 && currentStatus === 'free';

                return (
                  <div className={`border rounded-xl p-4 pt-6 relative ${
                    hasAnnualDiscount
                      ? 'border-green-300 dark:border-green-600 bg-green-50/50 dark:bg-green-900/20'
                      : 'border-amber-300 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-900/20'
                  }`}>
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${
                      hasAnnualDiscount ? 'bg-green-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'
                    }`}>
                      {hasAnnualDiscount ? `${formatCentsAsDollars(annualCreditsApplied)} OFF` : 'BEST VALUE'}
                    </div>
                    <div className="text-center mb-4">
                      <h3 className="font-bold text-slate-700 dark:text-slate-200">Annual</h3>
                      <div className="mt-2">
                        {hasAnnualDiscount ? (
                          <>
                            <span className="text-lg text-slate-400 line-through mr-2">$99.99</span>
                            <span className="text-3xl font-bold text-green-600 dark:text-green-400">
                              {formatCentsAsDollars(annualFinal)}
                            </span>
                          </>
                        ) : (
                          <span className="text-3xl font-bold text-slate-800 dark:text-white">$99.99</span>
                        )}
                        <span className="text-slate-500 dark:text-slate-400">/yr</span>
                      </div>
                      <div className={`text-xs font-bold mt-1 ${
                        hasAnnualDiscount ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {hasAnnualDiscount ? 'Credit applied!' : 'Save ~$80 (5 months free!)'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUpgrade('annual')}
                      disabled={loading !== null || (currentStatus === 'pro' && currentPlan === 'annual')}
                      className={`w-full py-2.5 text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 ${
                        hasAnnualDiscount
                          ? 'bg-green-500 hover:bg-green-600'
                          : 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600'
                      }`}
                    >
                      {loading === 'annual' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : currentStatus === 'pro' && currentPlan === 'annual' ? (
                        'Current Plan'
                      ) : (
                        'Subscribe'
                      )}
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* Features Comparison */}
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
              <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-3 text-center">
                What's included in Pro
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Check className="w-4 h-4 text-green-500" />
                  1,000 generations/month
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Check className="w-4 h-4 text-green-500" />
                  Smart SRS Review
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Check className="w-4 h-4 text-green-500" />
                  Study Analytics
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Check className="w-4 h-4 text-green-500" />
                  AI Tutor
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Check className="w-4 h-4 text-green-500" />
                  Concept Maps
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Check className="w-4 h-4 text-green-500" />
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
                    <Coins className="w-5 h-5 text-green-500" />
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
                    <Loader2 className="w-4 h-4 animate-spin" />
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
                    <Coins className="w-5 h-5 text-green-500" />
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
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Buy Now'
                  )}
                </button>
              </div>

              {/* 100 Credits */}
              <div className="border border-slate-200 dark:border-slate-600 rounded-xl p-4 hover:border-green-400 transition-colors">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Coins className="w-5 h-5 text-green-500" />
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
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Buy Now'
                  )}
                </button>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <Info className="w-4 h-4 mr-2" />
                Credits are used after your monthly allowance runs out. They never expire!
              </p>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-600 text-center">
          <p className="text-xs text-slate-400">
            Secure payment powered by Stripe
          </p>
        </div>
      </div>
    </Modal>
  );
};
