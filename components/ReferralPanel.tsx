import React, { useState, useEffect, useContext } from 'react';
import { Gift, Copy, Check, Users, Crown, DollarSign, Share2, Loader2 } from 'lucide-react';
import { User } from 'firebase/auth';
import { ToastContext } from '../App';
import {
  getUserReferralInfo,
  getReferralHistory,
  getUserReferralCredits,
  REFERRAL_CONFIG,
  UserReferralInfo,
  ReferralRecord,
  formatCentsAsDollars,
} from '../services/referralService';

interface ReferralPanelProps {
  user: User;
}

interface CreditInfo {
  totalCredits: number;
  referralCredits: number;
  refereeCredits: number;
  creditsUsed: number;
}

export const ReferralPanel: React.FC<ReferralPanelProps> = ({ user }) => {
  const { showToast } = useContext(ToastContext);
  const [referralInfo, setReferralInfo] = useState<UserReferralInfo | null>(null);
  const [creditInfo, setCreditInfo] = useState<CreditInfo>({ totalCredits: 0, referralCredits: 0, refereeCredits: 0, creditsUsed: 0 });
  const [history, setHistory] = useState<ReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  useEffect(() => {
    loadReferralData();
  }, [user.uid]);

  const loadReferralData = async () => {
    setLoading(true);
    try {
      const [info, records, credits] = await Promise.all([
        getUserReferralInfo(user.uid),
        getReferralHistory(user.uid),
        getUserReferralCredits(user.uid),
      ]);
      setReferralInfo(info);
      setHistory(records);
      setCreditInfo(credits);
    } catch (error) {
      console.error('Failed to load referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      showToast(`${type === 'code' ? 'Code' : 'Link'} copied!`, 'success');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  const shareReferral = async () => {
    if (!referralInfo) return;

    const creditAmount = formatCentsAsDollars(REFERRAL_CONFIG.refereeReward.creditsCents);
    const shareData = {
      title: 'Join StudyStack',
      text: `Use my referral code ${referralInfo.referralCode} to get ${creditAmount} off your first purchase of StudyStack Pro!`,
      url: referralInfo.referralLink,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await copyToClipboard(referralInfo.referralLink, 'link');
      }
    } catch (error) {
      // User cancelled share
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!referralInfo) {
    return (
      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
        <Gift className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Referral system unavailable</p>
        <p className="text-sm">Please sign in to access referrals</p>
      </div>
    );
  }

  const proConversions = referralInfo.proConversions || 0;
  const referralsRemaining = Math.max(0, REFERRAL_CONFIG.referrerReward.maxReferrals - proConversions);
  const hasHitCap = proConversions >= REFERRAL_CONFIG.referrerReward.maxReferrals;
  const maxCredits = REFERRAL_CONFIG.referrerReward.maxCreditsCents;
  const creditPerReferral = REFERRAL_CONFIG.referrerReward.creditsCents;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-blue-600 mb-4">
          <Gift className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
          Invite Friends, Earn Credits
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Refer {REFERRAL_CONFIG.referrerReward.maxReferrals} friends → get a free semester!
        </p>
      </div>

      {/* Current credits banner */}
      {creditInfo.totalCredits > 0 && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-4 text-center text-white">
          <div className="text-sm font-medium opacity-90">Your Available Credits</div>
          <div className="text-3xl font-bold">{formatCentsAsDollars(creditInfo.totalCredits)}</div>
          <div className="text-xs opacity-80 mt-1">Apply at checkout on any plan</div>
        </div>
      )}

      {/* Rewards explainer */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCentsAsDollars(creditPerReferral)}
          </div>
          <div className="text-xs text-green-700 dark:text-green-300">
            credit when friend goes Pro
          </div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {formatCentsAsDollars(REFERRAL_CONFIG.refereeReward.creditsCents)}
          </div>
          <div className="text-xs text-amber-700 dark:text-amber-300">
            credit for your friend too!
          </div>
        </div>
      </div>

      {/* Progress to free semester */}
      <div className="bg-gradient-to-r from-primary/10 to-blue-500/10 dark:from-primary/20 dark:to-blue-500/20 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Progress to Free Semester
          </span>
          <span className="text-sm font-bold text-primary">
            {formatCentsAsDollars(referralInfo.referralCredits || 0)} / {formatCentsAsDollars(maxCredits)}
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
          <div
            className="bg-gradient-to-r from-primary to-blue-500 h-2.5 rounded-full transition-all"
            style={{ width: `${((referralInfo.referralCredits || 0) / maxCredits) * 100}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
          {hasHitCap
            ? "You've maxed out your referral credits!"
            : `${referralsRemaining} more referral${referralsRemaining === 1 ? '' : 's'} to earn a free semester`
          }
        </p>
      </div>

      {/* Referral code */}
      <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Your Referral Code
        </label>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg px-4 py-3 font-mono text-lg font-bold text-slate-800 dark:text-slate-100 tracking-widest text-center border-2 border-dashed border-slate-300 dark:border-slate-600">
            {referralInfo.referralCode}
          </div>
          <button
            onClick={() => copyToClipboard(referralInfo.referralCode, 'code')}
            className="p-3 bg-primary hover:bg-primary/90 text-white rounded-lg transition-all"
            title="Copy code"
          >
            {copied === 'code' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Share buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => copyToClipboard(referralInfo.referralLink, 'link')}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-xl font-medium text-slate-700 dark:text-slate-200 transition-all"
        >
          {copied === 'link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          Copy Link
        </button>
        <button
          onClick={shareReferral}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-all"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>

      {/* Stats */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl p-4">
        <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Your Referral Stats
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {referralInfo.successfulReferrals}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Friends Joined</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {proConversions}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Went Pro</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCentsAsDollars(referralInfo.referralCredits || 0)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Credits Earned</div>
          </div>
        </div>
      </div>

      {/* Referral history */}
      {history.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Recent Referrals
          </h3>
          <div className="space-y-2">
            {history.slice(0, 5).map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    record.status === 'converted_pro'
                      ? 'bg-amber-100 dark:bg-amber-900/30'
                      : 'bg-green-100 dark:bg-green-900/30'
                  }`}>
                    {record.status === 'converted_pro' ? (
                      <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                      {record.refereeEmail.split('@')[0]}***
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(record.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                {record.status === 'converted_pro' && record.creditsAwarded > 0 && (
                  <div className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
                    <DollarSign className="w-3 h-3" />
                    {formatCentsAsDollars(record.creditsAwarded)} earned
                  </div>
                )}
                {record.status === 'signed_up' && (
                  <div className="text-xs text-slate-400 dark:text-slate-500">
                    Awaiting Pro
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friend's bonus */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <span className="font-semibold">Your friends get {formatCentsAsDollars(REFERRAL_CONFIG.refereeReward.creditsCents)} off</span>
          <br />
          their first purchase when they sign up with your code!
        </p>
      </div>

      {/* Referred by info */}
      {referralInfo.referredBy && (
        <div className="text-center text-xs text-slate-500 dark:text-slate-400">
          You were referred by a friend and got {formatCentsAsDollars(REFERRAL_CONFIG.refereeReward.creditsCents)} credit!
        </div>
      )}
    </div>
  );
};
