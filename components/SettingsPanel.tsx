import React, { useState, useEffect, type FC } from 'react';
import { updateProfile } from 'firebase/auth';
import { auth } from '../services/firebase';
import { clearDatabase, loadCourses } from '../services/storage';

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

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('studyai_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('studyai_theme', 'light');
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
      a.download = `studyai-backup-${new Date().toISOString().split('T')[0]}.json`;
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
                 {user.photoURL ? <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover"/> : <i className="fas fa-user text-slate-300 dark:text-slate-500"></i>}
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
                         {loading ? <i className="fas fa-circle-notch fa-spin"></i> : 'Save'}
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

      {/* Appearance */}
      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700">
             <h3 className="font-bold text-slate-800 dark:text-slate-100"><i className="fas fa-palette mr-2 text-slate-400"></i>Appearance</h3>
          </div>
          <div className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                        <i className={`fas ${darkMode ? 'fa-moon text-indigo-400' : 'fa-sun text-amber-500'}`}></i>
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
                      <i className={`fas ${darkMode ? 'fa-moon text-indigo-600' : 'fa-sun text-amber-500'} text-xs`}></i>
                    </div>
                  </button>
              </div>
          </div>
      </section>

      {/* Backup & Export */}
      <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700">
             <h3 className="font-bold text-slate-800 dark:text-slate-100"><i className="fas fa-cloud-download-alt mr-2 text-slate-400"></i>Backup & Export</h3>
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
                        <><i className="fas fa-circle-notch fa-spin"></i> Exporting...</>
                      ) : (
                        <><i className="fas fa-download"></i> Export JSON</>
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
             <h3 className="font-bold text-slate-800 dark:text-slate-100"><i className="fas fa-database mr-2 text-slate-400"></i>Data Management</h3>
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
          <p className="mb-2">StudyAI v2.2.0 (Beta)</p>
          <button onClick={onLogout} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline">Log Out</button>
      </div>
    </div>
  );
};