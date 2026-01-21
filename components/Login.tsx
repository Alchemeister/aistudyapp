import React, { useState, type FC, type FormEvent } from 'react';
import { GraduationCap, Loader2, UserRoundX, AlertCircle } from 'lucide-react';
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
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Welcome to StudyStack</h1>
          <p className="text-slate-500 mb-8">Your AI-powered personalized study assistant.</p>

          <div className="space-y-4">
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-3 px-4 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-md active:scale-[0.98]"
            >
               {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#EA4335" d="M5.26620003,9.76452941 C6.19878754,6.93863203 8.85444915,4.90909091 12,4.90909091 C13.6909091,4.90909091 15.2181818,5.50909091 16.4181818,6.49090909 L19.9090909,3 C17.7818182,1.14545455 15.0545455,0 12,0 C7.27006974,0 3.1977497,2.69829785 1.23999023,6.65002441 L5.26620003,9.76452941 Z"/><path fill="#34A853" d="M16.0407269,18.0125889 C14.9509167,18.7163016 13.5660892,19.0909091 12,19.0909091 C8.86648613,19.0909091 6.21911939,17.076871 5.27698177,14.2678769 L1.23746264,17.3349879 C3.19279051,21.2936293 7.26500293,24 12,24 C14.9328362,24 17.7353462,22.9573905 19.834192,20.9995801 L16.0407269,18.0125889 Z"/><path fill="#4A90E2" d="M19.834192,20.9995801 C22.0291676,18.9520994 23.4545455,15.903663 23.4545455,12 C23.4545455,11.2909091 23.3454545,10.5272727 23.1818182,9.81818182 L12,9.81818182 L12,14.4545455 L18.4363636,14.4545455 C18.1187732,16.013626 17.2662994,17.2212117 16.0407269,18.0125889 L19.834192,20.9995801 Z"/><path fill="#FBBC05" d="M5.27698177,14.2678769 C5.03832634,13.556323 4.90909091,12.7937589 4.90909091,12 C4.90909091,11.2182781 5.03443647,10.4668121 5.26620003,9.76452941 L1.23999023,6.65002441 C0.43658717,8.26043162 0,10.0753848 0,12 C0,13.9195484 0.444780743,15.7## L1.23746264,17.3349879 L5.27698177,14.2678769 Z"/></svg>}
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
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
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
                  <UserRoundX className="w-4 h-4" /> Use Demo Account (Skip Auth)
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center justify-center gap-2 animate-fade-in border border-red-100 break-words text-center">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> 
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};