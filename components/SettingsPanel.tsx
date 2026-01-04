import React, { useState, type FC } from 'react';
import { updateProfile } from 'firebase/auth';
import { auth } from '../services/firebase';
import { clearDatabase } from '../services/storage';

interface Props {
  user: any;
  onLogout: () => void;
}

export const SettingsPanel: FC<Props> = ({ user, onLogout }) => {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

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

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8 animate-fade-in">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">Settings</h2>
        <p className="text-slate-500 mt-1">Manage your account and preferences.</p>
      </header>

      {/* Account Section */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex items-center gap-4">
             <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl overflow-hidden">
                 {user.photoURL ? <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover"/> : <i className="fas fa-user text-slate-300"></i>}
             </div>
             <div>
                 <div className="font-bold text-lg text-slate-800">{user.email}</div>
                 <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Account Type: Student</div>
             </div>
         </div>
         
         <div className="p-6 space-y-4">
             <div>
                 <label className="block text-sm font-bold text-slate-600 mb-2">Display Name</label>
                 <div className="flex gap-2">
                     <input 
                        type="text" 
                        value={displayName} 
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="flex-1 p-3 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary outline-none"
                        placeholder="Your Name"
                     />
                     <button 
                        onClick={handleUpdateProfile} 
                        disabled={loading || displayName === user.displayName}
                        className="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
                     >
                         {loading ? <i className="fas fa-circle-notch fa-spin"></i> : 'Save'}
                     </button>
                 </div>
                 {message && (
                     <div className={`mt-3 text-sm font-bold ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                         {message.text}
                     </div>
                 )}
             </div>
         </div>
      </section>

      {/* Data Management */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
             <h3 className="font-bold text-slate-800"><i className="fas fa-database mr-2 text-slate-400"></i>Data Management</h3>
          </div>
          <div className="p-6 bg-red-50/50">
              <div className="flex items-start justify-between gap-4">
                  <div>
                      <h4 className="font-bold text-red-800 text-sm">Factory Reset</h4>
                      <p className="text-sm text-red-600 mt-1 max-w-sm">
                          Permanently delete all courses, PDFs, and generated materials stored in this browser. This action cannot be undone.
                      </p>
                  </div>
                  <button 
                    onClick={handleFactoryReset}
                    className="px-4 py-2 bg-white border border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors shadow-sm whitespace-nowrap"
                  >
                      Clear All Data
                  </button>
              </div>
          </div>
      </section>

      {/* App Info */}
      <div className="text-center text-xs text-slate-400 pt-8">
          <p className="mb-2">StudyAI v2.2.0 (Beta)</p>
          <button onClick={onLogout} className="text-slate-500 hover:text-slate-800 underline">Log Out</button>
      </div>
    </div>
  );
};