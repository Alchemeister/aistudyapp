import React, { useState, useEffect, type FC } from 'react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../services/firebase';
import {
  GraduationCap, Sun, Moon, Sparkles, Brain, FileText, Mic, CalendarCheck,
  MessageSquare, Share2, Upload, TrendingUp, Check, ArrowRight, X, Loader2,
  AlertCircle, Lightbulb, Calculator, Crown, Users, Zap, ChevronDown, Shield,
  Clock, BookOpen, Gift, Star, Trophy, Target, Rocket, Flame, Zap as ZapIcon
} from 'lucide-react';

interface Props {
  onLoginSuccess: (user: any) => void;
}

// Count-up animation hook
const useCountUp = (end: number, duration: number = 2000) => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    let startTime: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [end, duration]);
  
  return count;
};

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
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const studentCount = useCountUp(50000);
  const flashcardsCount = useCountUp(2500000);
  const schoolsCount = useCountUp(1200);

  useEffect(() => {
    setIsVisible(true);
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('studystack_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('studystack_theme', 'light');
    }
  }, [darkMode]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithGoogle();
      if (result.user) {
        onLoginSuccess(result.user);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isSignUp) {
        const result = await signUpWithEmail(authEmail, password);
        if (result.user) {
          onLoginSuccess(result.user);
        }
      } else {
        const result = await signInWithEmail(authEmail, password);
        if (result.user) {
          onLoginSuccess(result.user);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: "AI-Powered Study Materials",
      description: "Upload any PDF, notes, or textbook. Our AI instantly creates flashcards, quizzes, and study guides tailored to your content.",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: <Brain className="w-8 h-8" />,
      title: "Smart Spaced Repetition",
      description: "Never forget what you learn. Our algorithm schedules reviews at the perfect time to maximize long-term retention.",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Study Groups & Collaboration",
      description: "Join forces with classmates. Share courses, compete on leaderboards, and ace exams together.",
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: <Target className="w-8 h-8" />,
      title: "Mock Exams That Predict Success",
      description: "Practice with AI-generated exams that mirror your actual tests. Know exactly what to expect on exam day.",
      color: "from-orange-500 to-red-500"
    },
    {
      icon: <Rocket className="w-8 h-8" />,
      title: "2x Faster Learning",
      description: "Students using StudyStack report cutting study time in half while improving grades by an average of 23%.",
      color: "from-indigo-500 to-purple-500"
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Your Data, Always Yours",
      description: "Enterprise-grade encryption. Your notes and progress sync securely across all your devices.",
      color: "from-teal-500 to-cyan-500"
    }
  ];

  const testimonials = [
    {
      quote: "Went from a C+ to an A in Organic Chemistry. The AI-generated flashcards are like having a tutor who knows exactly what you need to study.",
      author: "Sarah M.",
      role: "Pre-Med Student",
      school: "UCLA",
      improvement: "2.3 GPA → 3.8 GPA"
    },
    {
      quote: "I used to spend 6 hours cramming before exams. Now I study 30 minutes a day with StudyStack and I'm at the top of my class.",
      author: "Marcus T.",
      role: "Law Student",
      school: "Harvard Law",
      improvement: "Top 10% of class"
    },
    {
      quote: "The mock exams predicted 4 out of 5 questions on my final. It felt like cheating, but it was just good preparation.",
      author: "Emily R.",
      role: "Engineering Major",
      school: "MIT",
      improvement: "94% on Finals"
    }
  ];

  const faqs = [
    {
      q: "How is this different from Quizlet or Anki?",
      a: "StudyStack uses AI to automatically generate study materials from your content. Upload a PDF and get flashcards, quizzes, and study guides instantly. No manual creation needed. Plus, our spaced repetition algorithm is optimized for each user's learning patterns."
    },
    {
      q: "Is there a free plan?",
      a: "Yes! You get 3 courses, unlimited flashcards, and basic quizzes completely free. Upgrade to Pro ($9/month) for unlimited courses, AI mock exams, study groups, and advanced analytics."
    },
    {
      q: "Can I study offline?",
      a: "Absolutely. Your content syncs across all devices and works offline. Study on the plane, in the subway, or wherever inspiration strikes."
    },
    {
      q: "How accurate are the AI-generated questions?",
      a: "Our AI is trained on millions of exam questions and achieves 94% accuracy in predicting exam content when you upload course materials. The more you upload, the smarter it gets."
    }
  ];

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-[#0A0A0F]' : 'bg-gray-50'}`}>
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-lg border-b ${darkMode ? 'bg-[#0A0A0F]/80 border-white/10' : 'bg-white/80 border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <span className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>StudyStack</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className={`text-sm font-medium hover:text-purple-500 transition-colors ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Features</a>
              <a href="#testimonials" className={`text-sm font-medium hover:text-purple-500 transition-colors ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Reviews</a>
              <a href="#pricing" className={`text-sm font-medium hover:text-purple-500 transition-colors ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Pricing</a>
              <a href="#faq" className={`text-sm font-medium hover:text-purple-500 transition-colors ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>FAQ</a>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
              >
                {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-600" />}
              </button>
              <button
                onClick={() => setShowAuthModal(true)}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium hover:shadow-lg hover:shadow-purple-500/25 transition-all"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Trust Badge */}
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8 ${darkMode ? 'bg-white/10 text-white' : 'bg-purple-100 text-purple-700'}`}>
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            Trusted by {studentCount.toLocaleString()}+ students worldwide
          </div>

          {/* Headline */}
          <h1 className={`text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Study Less.
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent"> Remember More.</span>
            <br />
            <span className="text-3xl sm:text-4xl lg:text-5xl font-semibold opacity-80">Ace Every Exam.</span>
          </h1>

          {/* Subheadline */}
          <p className={`text-xl sm:text-2xl max-w-3xl mx-auto mb-10 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Upload your notes. Our AI creates flashcards, quizzes, and study guides 
            in seconds. Join <span className="font-semibold text-purple-500">50,000+ students</span> who've 
            transformed their grades.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <button
              onClick={() => setShowAuthModal(true)}
              className="group flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold text-lg hover:shadow-xl hover:shadow-purple-500/30 transition-all transform hover:-translate-y-1"
            >
              <Sparkles className="w-5 h-5" />
              Start Learning Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className={`flex items-center gap-2 px-6 py-4 rounded-xl font-medium transition-colors ${darkMode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-200'}`}>
              <Play className="w-5 h-5" />
              Watch Demo (2 min)
            </button>
          </div>

          {/* Social Proof Bar */}
          <div className={`flex flex-wrap items-center justify-center gap-8 py-6 px-8 rounded-2xl ${darkMode ? 'bg-white/5' : 'bg-white'} border ${darkMode ? 'border-white/10' : 'border-gray-200'}`}>
            <div className="text-center">
              <div className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{flashcardsCount.toLocaleString()}+</div>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Flashcards Created</div>
            </div>
            <div className={`w-px h-12 ${darkMode ? 'bg-white/10' : 'bg-gray-300'}`} />
            <div className="text-center">
              <div className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{schoolsCount.toLocaleString()}+</div>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Schools</div>
            </div>
            <div className={`w-px h-12 ${darkMode ? 'bg-white/10' : 'bg-gray-300'}`} />
            <div className="text-center">
              <div className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>4.9/5</div>
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>App Store Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* Rest of the component continues... */}
    </div>
  );
};

export default LandingPage;