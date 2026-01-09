import React, { type FC, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  loading?: boolean;
  status?: string;
  disabled?: boolean;
  badge?: string;
  fullWidth?: boolean;
}

export const GenBtn: FC<Props> = ({ icon, label, onClick, loading, status, disabled, badge, fullWidth }) => (
  <button
    onClick={onClick}
    disabled={loading || disabled}
    className={`relative flex flex-col items-center justify-center p-4 border rounded-xl transition-all group h-24 ${fullWidth ? 'col-span-2 md:col-span-3 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' : ''} ${
      disabled
        ? 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 opacity-60 cursor-not-allowed'
        : 'border-slate-200 dark:border-slate-600 hover:border-primary hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer'
    }`}
  >
    {loading && fullWidth ? (
       <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <span className="text-slate-600 dark:text-slate-300 font-bold">{status}</span>
       </div>
    ) : loading ? (
      <>
        <Loader2 className="w-5 h-5 text-primary mb-2 animate-spin" />
        <span className="text-[10px] text-slate-500 dark:text-slate-400 animate-pulse text-center leading-tight px-1">{status}</span>
      </>
    ) : (
      <>
        <div className={`mb-2 ${disabled ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400 group-hover:text-primary'}`}>{icon}</div>
        <span className={`text-xs font-bold ${disabled ? 'text-slate-400' : 'text-slate-600 dark:text-slate-300 group-hover:text-primary'}`}>{label}</span>
      </>
    )}
    {badge && (
      <span className="absolute top-2 right-2 text-[8px] font-bold bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
        {badge}
      </span>
    )}
  </button>
);
