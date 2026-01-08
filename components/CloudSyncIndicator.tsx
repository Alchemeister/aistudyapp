import React from 'react';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface Props {
  status: SyncStatus;
  onClick?: () => void;
}

export const CloudSyncIndicator: React.FC<Props> = ({ status, onClick }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'syncing':
        return {
          icon: 'fa-cloud',
          containerClass: 'animate-pulse',
          iconClass: 'text-blue-500',
          bgClass: 'bg-blue-100 dark:bg-blue-900/30',
          ringClass: 'ring-2 ring-blue-400/50 ring-offset-1',
          title: 'Syncing to cloud...',
        };
      case 'synced':
        return {
          icon: 'fa-cloud',
          containerClass: 'cloud-synced',
          iconClass: 'text-green-500',
          bgClass: 'bg-green-100 dark:bg-green-900/30',
          ringClass: 'ring-2 ring-green-400/50 ring-offset-1',
          title: 'Synced to cloud',
        };
      case 'error':
        return {
          icon: 'fa-cloud-exclamation',
          containerClass: '',
          iconClass: 'text-red-500',
          bgClass: 'bg-red-100 dark:bg-red-900/30',
          ringClass: 'ring-2 ring-red-400/50 ring-offset-1',
          title: 'Sync failed - click to retry',
        };
      default: // idle
        return {
          icon: 'fa-cloud',
          containerClass: '',
          iconClass: 'text-slate-400 dark:text-slate-500',
          bgClass: 'bg-slate-100 dark:bg-slate-700',
          ringClass: '',
          title: 'Cloud sync ready',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <>
      {/* CSS for synced animation */}
      <style>{`
        @keyframes syncedPulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
          }
        }
        .cloud-synced {
          animation: syncedPulse 2s ease-out;
        }
      `}</style>

      <button
        onClick={onClick}
        className={`
          relative flex items-center justify-center w-8 h-8 rounded-full
          transition-all duration-300 hover:scale-110
          ${config.bgClass} ${config.ringClass} ${config.containerClass}
        `}
        title={config.title}
      >
        <i className={`fas ${config.icon} text-sm ${config.iconClass}`}></i>

        {/* Syncing spinner overlay */}
        {status === 'syncing' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute w-full h-full rounded-full border-2 border-transparent border-t-blue-500 animate-spin"></div>
          </div>
        )}

        {/* Synced checkmark */}
        {status === 'synced' && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
            <i className="fas fa-check text-white text-[8px]"></i>
          </div>
        )}

        {/* Error indicator */}
        {status === 'error' && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center shadow-sm">
            <i className="fas fa-exclamation text-white text-[8px]"></i>
          </div>
        )}
      </button>
    </>
  );
};
