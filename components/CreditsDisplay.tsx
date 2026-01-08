import React from 'react';

interface Props {
  status: 'free' | 'pro';
  creditsRemaining: number;
  monthlyLimit: number;
  onClick: () => void;
}

export const CreditsDisplay: React.FC<Props> = ({
  status,
  creditsRemaining,
  monthlyLimit,
  onClick,
}) => {
  const percentage = Math.round((creditsRemaining / monthlyLimit) * 100);
  const isLow = percentage < 20;
  const isEmpty = creditsRemaining === 0;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105 ${
        status === 'pro'
          ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm'
          : isEmpty
          ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
          : isLow
          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
      }`}
      title={status === 'pro' ? 'Pro Member - Click to manage' : 'Click to upgrade or buy credits'}
    >
      {status === 'pro' ? (
        <>
          <i className="fas fa-crown text-xs"></i>
          <span>Pro</span>
        </>
      ) : (
        <>
          <i className={`fas fa-bolt text-xs ${isEmpty ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-blue-500'}`}></i>
          <span>{creditsRemaining}</span>
          <span className="text-slate-400 dark:text-slate-500">/ {monthlyLimit}</span>
        </>
      )}
    </button>
  );
};

// Compact version for mobile
export const CreditsDisplayCompact: React.FC<Props> = ({
  status,
  creditsRemaining,
  monthlyLimit,
  onClick,
}) => {
  const isEmpty = creditsRemaining === 0;
  const isLow = creditsRemaining / monthlyLimit < 0.2;

  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center w-8 h-8 rounded-full transition-all hover:scale-110 ${
        status === 'pro'
          ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white'
          : isEmpty
          ? 'bg-red-100 dark:bg-red-900/30 text-red-500'
          : isLow
          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-500'
          : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
      }`}
      title={status === 'pro' ? 'Pro Member' : `${creditsRemaining} credits remaining`}
    >
      {status === 'pro' ? (
        <i className="fas fa-crown text-xs"></i>
      ) : (
        <i className="fas fa-bolt text-xs"></i>
      )}
    </button>
  );
};
