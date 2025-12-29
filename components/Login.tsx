import React, { useState } from 'react';
import { signInWithGoogle } from '../services/firebase';

interface Props {
  onLoginSuccess: (user: any) => void;
}

export const Login: React.FC<Props> = ({ onLoginSuccess }) => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const user = await signInWithGoogle();
      onLoginSuccess(user);
    } catch (e: any) {
      console.error("Login Error Details:", e.code, e.message);
      
      // Check for our custom missing config error
      if (e.message === "MISSING_CONFIG") {
         setError("Firebase config missing – check .env file");
         return; // Don't fallback to demo auto-login for config errors, let user fix it or choose demo manually
      }

      // Check for common misconfiguration error codes or messages
      const isConfigError = 
        e.code === 'auth/invalid-api-key' || 
        e.code === 'auth/configuration-not-found' ||
        e.message?.includes('api-key') ||
        e.message?.includes('valid-api-key');

      if (isConfigError) {
        setError("Invalid API Key configuration. Please check .env file.");
      } else {
        setError("Could not sign in with Google. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    onLoginSuccess({
      displayName: "Demo Student",
      email: "student@university.edu",
      photoURL: null
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in-up">
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white text-3xl mx-auto mb-6 shadow-lg transform rotate-3">
            <i className="fas fa-graduation-cap"></i>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Welcome to StudyAI</h1>
          <p className="text-slate-500 mb-8">Your AI-powered personalized study assistant.</p>

          <div className="space-y-4">
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-3 px-4 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-md active:scale-[0.98]"
            >
               {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fab fa-google text-red-500"></i>}
               Continue with Google
            </button>
            
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
              <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-slate-400">or</span></div>
            </div>

            <form className="space-y-3 opacity-50 pointer-events-none">
              <input type="email" placeholder="Email address" className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50" disabled />
              <input type="password" placeholder="Password" className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50" disabled />
              <button className="w-full py-3 bg-primary text-white font-bold rounded-xl" disabled>Sign In</button>
            </form>
            
            <button onClick={handleDemoLogin} className="text-xs text-slate-400 hover:text-slate-600 underline">
                Use Demo Account (Skip Auth)
            </button>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center justify-center gap-2">
                <i className="fas fa-exclamation-circle"></i> {error}
              </div>
            )}
          </div>
        </div>
        <div className="bg-slate-50 p-4 text-center text-xs text-slate-400 border-t border-slate-100">
           By continuing, you agree to our Terms and Privacy Policy.
        </div>
      </div>
    </div>
  );
};