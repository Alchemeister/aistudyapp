import React, { useState, useEffect, type FC } from 'react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../services/firebase';
import {
  GraduationCap,
  Sun,
  Moon,
  Play,
  Sparkles,
  Brain,
  FileText,
  Mic,
  CalendarCheck,
  MessageSquare,
  Share2,
  Upload,
  TrendingUp,
  Check,
  ArrowRight,
  X,
  Loader2,
  AlertCircle,
  UserX
} from 'lucide-react';

interface Props {
  onLoginSuccess: (user: any) => void;
}

export const LandingPage: FC<Props> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('studystack_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('studystack_theme', 'light');
    }
  }, [darkMode]);

  const handleError = (e: any) => {
    setLoading(false);
    if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = isSignUp ? await signUpWithEmail(authEmail, password) : await signInWithEmail(authEmail, password);
      onLoginSuccess(user);
    } catch (e: any) {
      handleError(e);
    }
  };

  const handleDemoLogin = () => {
    onLoginSuccess({
      displayName: "Demo Student",
      email: "student@university.edu",
      photoURL: null
    });
  };

  const features = [
    { icon: Sparkles, title: 'AI Flashcards', description: 'Auto-generate flashcards from any material' },
    { icon: Brain, title: 'Smart Quizzes', description: 'Adaptive quizzes that target your weak spots' },
    { icon: FileText, title: 'Summary Notes', description: 'Get concise summaries of long documents' },
    { icon: Mic, title: 'Lecture Recording', description: 'Record and transcribe lectures automatically' },
    { icon: CalendarCheck, title: 'Spaced Repetition', description: 'Science-backed review scheduling' },
    { icon: MessageSquare, title: 'AI Tutor Chat', description: 'Get instant answers to your questions' },
    { icon: Share2, title: 'Concept Connections', description: 'Visualize connections between concepts' },
  ];

  const testimonials = [
    { quote: "StudyStack turned my 50-page PDF into flashcards in seconds. Saved me hours before finals.", name: "Sarah M.", title: "Pre-Med Student", avatar: "SM" },
    { quote: "The spaced repetition actually works. I went from C's to A's in organic chemistry.", name: "James K.", title: "Chemistry Major", avatar: "JK" },
    { quote: "I record all my lectures now. The AI summaries are better than my own notes.", name: "Priya R.", title: "Law Student", avatar: "PR" },
  ];

  const pricingPlans = [
    { name: 'Free', price: '$0', period: '', features: ['25 generations', 'Basic features', 'Community support'] },
    { name: 'Pro Monthly', price: '$14.99', period: '/mo', features: ['1,000 generations', 'All features', 'Priority support', 'Export capabilities'] },
    { name: 'Pro Semester', price: '$49.99', period: '', badge: 'Save ~$10', popular: true, features: ['4 months access', '1,000 generations/mo', 'All features', 'Priority support'] },
    { name: 'Pro Annual', price: '$99.99', period: '/yr', badge: 'Save ~$80', highlighted: true, features: ['12 months access', '1,000 generations/mo', 'All features', 'Priority support', 'Best value'] },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#f8fafc] dark:bg-[#0f172a] transition-colors">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#2563eb] rounded-xl">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">StudyStack</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.98] transition-all"
            >
              {darkMode ? <Sun className="w-5 h-5 text-slate-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>

            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-white dark:bg-[#1e293b] border-2 border-slate-200 dark:border-slate-700 px-6 py-2 rounded-xl hover:border-slate-300 dark:hover:border-slate-600 active:scale-[0.98] transition-all font-bold text-slate-900 dark:text-white"
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 py-20 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-block p-4 bg-[#2563eb] rounded-2xl shadow-lg rotate-3 hover:rotate-6 transition-transform">
              <GraduationCap className="w-12 h-12 text-white" />
            </div>

            <div className="space-y-4">
              <h1 className="text-5xl font-bold text-slate-900 dark:text-white">
                Master Your Coursework
              </h1>
              <p className="text-xl text-slate-500 dark:text-slate-400">
                Upload your PDFs, lectures, or notes. AI generates flashcards, quizzes, and study guides instantly.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-[#2563eb] text-white px-8 py-4 rounded-xl shadow-md hover:bg-blue-700 active:scale-[0.98] transition-all font-bold"
              >
                Get Started Free
              </button>
              <button className="bg-white dark:bg-[#1e293b] border-2 border-slate-200 dark:border-slate-700 px-8 py-4 rounded-xl hover:border-slate-300 dark:hover:border-slate-600 active:scale-[0.98] transition-all font-bold text-slate-900 dark:text-white flex items-center justify-center gap-2">
                <Play className="w-5 h-5" />
                Watch Demo
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700">
              <img
                src="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop"
                alt="StudyStack App Screenshot"
                className="rounded-xl w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Everything You Need to Study Smarter
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            AI-powered tools designed for student success
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <div key={i} className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow hover:shadow-lg transition-shadow">
              <div className="mb-4">
                <feature.icon className="w-6 h-6 text-[#2563eb]" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">{feature.description}</p>
            </div>
          ))}
          <div className="bg-white dark:bg-[#1e293b] border-2 border-dashed border-slate-200 dark:border-slate-700 p-6 rounded-2xl shadow flex items-center justify-center">
            <p className="text-slate-400 font-bold text-center">+ More Coming Soon</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-20 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            How It Works
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            From upload to mastery in three simple steps
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            { number: '1', icon: Upload, title: 'Upload PDF, lecture, or notes', description: 'Import your study materials in seconds' },
            { number: '2', icon: Sparkles, title: 'AI generates study materials', description: 'Get flashcards, quizzes, and summaries instantly' },
            { number: '3', icon: TrendingUp, title: 'Review and track progress', description: 'Master your coursework with spaced repetition' },
          ].map((step, i) => (
            <div key={i} className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 p-8 rounded-2xl shadow-lg relative">
              <div className="absolute -top-4 -left-4 w-12 h-12 bg-[#2563eb] text-white rounded-xl shadow-lg flex items-center justify-center font-bold text-xl">
                {step.number}
              </div>
              <div className="mb-4 mt-4">
                <step.icon className="w-8 h-8 text-[#2563eb]" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-2 text-lg">{step.title}</h3>
              <p className="text-slate-500 dark:text-slate-400">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 py-20 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Loved by Students
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            Join thousands of students studying smarter
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 p-8 rounded-2xl shadow-lg">
              <p className="text-slate-700 dark:text-slate-300 italic mb-6">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#2563eb] text-white flex items-center justify-center font-bold">
                  {t.avatar}
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{t.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t.title}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-20 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            Choose the plan that fits your study needs
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pricingPlans.map((plan, i) => (
            <div
              key={i}
              className={`bg-white dark:bg-[#1e293b] p-8 rounded-2xl shadow-lg relative ${
                plan.highlighted ? 'border-2 border-[#2563eb] shadow-2xl' : 'border border-slate-200 dark:border-slate-700'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 right-6 bg-[#2563eb] text-white px-4 py-1 rounded-full text-sm font-bold">
                  {plan.badge}
                </div>
              )}
              {(plan as any).popular && (
                <div className="absolute -top-3 left-6 bg-green-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                  Most Popular
                </div>
              )}
              {plan.highlighted && (
                <div className="absolute -top-3 left-6 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-1 rounded-full text-sm font-bold">
                  Best Value
                </div>
              )}
              <h3 className="font-bold text-slate-900 dark:text-white text-xl mb-2">{plan.name}</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-slate-900 dark:text-white">{plan.price}</span>
                <span className="text-slate-500 dark:text-slate-400">{plan.period}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                    <Check className="w-5 h-5 text-[#2563eb] flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setShowAuthModal(true)}
                className={`w-full py-3 rounded-xl font-bold transition-all active:scale-[0.98] ${
                  plan.highlighted
                    ? 'bg-[#2563eb] text-white shadow-md hover:bg-blue-700'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                Choose Plan
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20 max-w-4xl mx-auto">
        <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg p-12 text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Ready to ace your exams?
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg mb-8">
            Join thousands of students who are studying smarter with StudyStack
          </p>

          <form className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto" onSubmit={(e) => { e.preventDefault(); setShowAuthModal(true); }}>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-6 py-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#2563eb] text-slate-900 dark:text-white bg-white dark:bg-[#0f172a] placeholder:text-slate-400"
            />
            <button className="bg-[#2563eb] text-white px-8 py-4 rounded-xl shadow-md hover:bg-blue-700 active:scale-[0.98] transition-all font-bold flex items-center justify-center gap-2">
              Get Started
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-100 dark:bg-[#1e293b] px-6 py-12 mt-20 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#2563eb] rounded-xl">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">StudyStack</span>
            </div>

            <div className="flex gap-8 text-slate-600 dark:text-slate-400">
              <a href="#/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy</a>
              <a href="#/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms</a>
              <a href="mailto:support@studystack.app" className="hover:text-slate-900 dark:hover:text-white transition-colors">Contact</a>
            </div>
          </div>

          <div className="text-center mt-8 text-slate-500 dark:text-slate-500 text-sm">
            © {new Date().getFullYear()} StudyStack. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowAuthModal(false)}>
          <div className="w-full max-w-md bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="p-8 relative">
              <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-6 h-6" />
              </button>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-[#2563eb] rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg transform rotate-3">
                  <GraduationCap className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Sign in to start studying smarter</p>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-3 px-4 bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-md active:scale-[0.98] mb-4"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                Continue with Google
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-600"></div></div>
                <div className="relative flex justify-center text-sm"><span className="px-3 bg-white dark:bg-[#1e293b] text-slate-400 font-medium">or email</span></div>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-4">
                <input
                  type="email"
                  placeholder="Email address"
                  className="w-full p-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-600 focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb] outline-none transition-all font-medium"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  disabled={loading}
                />
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full p-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-600 focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb] outline-none transition-all font-medium"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="w-full py-3 bg-[#2563eb] text-white font-bold rounded-xl hover:bg-blue-700 shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-70 flex justify-center items-center gap-2"
                  disabled={loading}
                >
                  {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </button>
              </form>

              <div className="text-sm text-slate-500 dark:text-slate-400 mt-4 text-center">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button onClick={() => setIsSignUp(!isSignUp)} className="text-[#2563eb] font-bold hover:underline">
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 mt-4">
                <button onClick={handleDemoLogin} className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors flex items-center justify-center gap-2 mx-auto px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg">
                  <UserX className="w-4 h-4" /> Use Demo Account
                </button>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center justify-center gap-2 animate-fade-in border border-red-100 dark:border-red-800">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
