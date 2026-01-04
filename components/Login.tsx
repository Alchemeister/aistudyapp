import React, { useState, type FC, type FormEvent } from 'react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../services/firebase';

interface Props {
  onLoginSuccess: (user: any) => void;
}

export const Login: FC<Props> = ({ onLoginSuccess }) => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleDemoLogin = () => {
    onLoginSuccess({
      displayName: "Demo Student",
      email: "student@university.edu",
      photoURL: null
    });
  };

  const handleError = (e: any) => {
    console.error("Login Error Details:", e);
    setLoading(false);

    // Stop automatic redirect - Show explicit error for diagnosis
    if (e.message === "MISSING_CONFIG") {
       setError("Configuration Error: Firebase keys are missing. Check console for details.");
       return; 
    }

    // Specific check for the user's current error
    if (e.message?.includes("CONFIGURATION_NOT_FOUND") || JSON.stringify(e).includes("CONFIGURATION_NOT_FOUND")) {
        setError("Setup Error: Go to Firebase Console > Project Settings > General and ensure a 'Support Email' is set. Also enable Google Sign-In in Authentication.");
        return;
    }

    const isConfigError = 
      e.code === 'auth/invalid-api-key' || 
      e.code === 'auth/configuration-not-found' ||
      e.message?.includes('api-key');

    if (isConfigError) {
      setError(`Firebase Config Error: ${e.code || e.message}. Check Vercel Env Vars (must start with VITE_).`);
    } else if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
      setError("Invalid email or password.");
    } else if (e.code === 'auth/email-already-in-use') {
      setError("Email already in use. Please sign in.");
    } else if (e.code === 'auth/weak-password') {
      setError("Password should be at least 6 characters.");
    } else if (e.code === 'auth/popup-closed-by-user') {
      setError("Sign-in cancelled.");
    } else {
      setError(e.message || "Authentication failed.");
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const user = await signInWithGoogle();
      onLoginSuccess(user);
    } catch (e: any) {
      handleError(e);
    }
  };

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError('');
    try {
      let user;
      if (isSignUp) {
        user = await signUpWithEmail(email, password);
      } else {
        user = await signInWithEmail(email, password);
      }
      onLoginSuccess(user);
    } catch (e: any) {
      handleError(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in-up">
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
              className="w-full py-3 px-4 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-md active:scale-[0.98]"
            >
               {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fab fa-google text-red-500"></i>}
               Continue with Google
            </button>
            
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
              <div className="relative flex justify-center text-sm"><span className="px-3 bg-white text-slate-400 font-medium">or email</span></div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
              <div>
                <input 
                  type="email" 
                  placeholder="Email address" 
                  className="w-full p-3 border-2 border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <input 
                  type="password" 
                  placeholder="Password" 
                  className="w-full p-3 border-2 border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-medium"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <button 
                type="submit" 
                className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-blue-600 shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-70 flex justify-center items-center gap-2" 
                disabled={loading}
              >
                {loading && <i className="fas fa-circle-notch fa-spin"></i>}
                {isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <div className="text-sm text-slate-500 mt-4">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"} {' '}
              <button onClick={() => setIsSignUp(!isSignUp)} className="text-primary font-bold hover:underline">
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </div>
            
            <div className="pt-4 border-t border-slate-100 mt-4">
              <button onClick={handleDemoLogin} className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center gap-2 mx-auto px-4 py-2 hover:bg-slate-50 rounded-lg">
                  <i className="fas fa-user-secret"></i> Use Demo Account (Skip Auth)
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center justify-center gap-2 animate-fade-in border border-red-100 break-words text-center">
                <i className="fas fa-exclamation-circle flex-shrink-0"></i> 
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};