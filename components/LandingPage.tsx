import React, { useState, useEffect, type FC } from 'react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../services/firebase';
import {
  GraduationCap,
  Sun,
  Moon,
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
  Lightbulb,
  Calculator,
  Crown,
  Users,
  Zap,
  ChevronDown,
  Shield,
  Clock,
  BookOpen,
  Gift
} from 'lucide-react';

interface Props {
  onLoginSuccess: (user: any) => void;
}

// Typing animation hook
const useTypingEffect = (words: string[], typingSpeed = 100, deletingSpeed = 50, pauseTime = 2000) => {
  const [displayText, setDisplayText] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = words[wordIndex];

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (displayText.length < currentWord.length) {
          setDisplayText(currentWord.slice(0, displayText.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), pauseTime);
        }
      } else {
        if (displayText.length > 0) {
          setDisplayText(displayText.slice(0, -1));
        } else {
          setIsDeleting(false);
          setWordIndex((prev) => (prev + 1) % words.length);
        }
      }
    }, isDeleting ? deletingSpeed : typingSpeed);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, wordIndex, words, typingSpeed, deletingSpeed, pauseTime]);

  return displayText;
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

  // Animated typing effect for hero
  const typingWords = ['Flashcards', 'Quizzes', 'Study Guides', 'Summaries', 'Mock Exams', 'Mock Tests'];
  const typedText = useTypingEffect(typingWords, 80, 40, 1500);

  // Smooth scroll to section
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

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


  const features = [
    { icon: Sparkles, title: 'AI Flashcards', description: 'Auto-generate flashcards from any material' },
    { icon: Brain, title: 'Smart Quizzes', description: 'Adaptive quizzes that target your weak spots' },
    { icon: FileText, title: 'Summary Notes', description: 'Get concise summaries of long documents' },
    { icon: CalendarCheck, title: 'Spaced Repetition', description: 'Science-backed review scheduling' },
    { icon: Mic, title: 'Lecture Recording', description: 'Record and transcribe lectures automatically', pro: true },
    { icon: MessageSquare, title: 'AI Tutor Chat', description: 'Get instant answers to your questions', pro: true },
    { icon: Share2, title: 'Concept Connections', description: 'Visualize connections between concepts', pro: true },
    { icon: Lightbulb, title: 'Mnemonics', description: 'Memory aids to remember complex topics', pro: true },
    { icon: Calculator, title: 'Practice Problems', description: 'STEM practice with step-by-step solutions', pro: true },
  ];


  const pricingPlans = [
    { name: 'Free', price: '$0', period: '', features: ['25 generations', 'Basic features', 'Community support'] },
    { name: 'Pro Monthly', price: '$14.99', period: '/mo', features: ['1,000 generations', 'All features', 'Priority support', 'Export capabilities'] },
    { name: 'Pro Semester', price: '$49.99', period: '', badge: 'Save ~$10', popular: true, features: ['4 months access', '1,000 generations/mo', 'All features', 'Priority support'] },
    { name: 'Pro Annual', price: '$99.99', period: '/yr', badge: 'Save ~$80', highlighted: true, features: ['12 months access', '1,000 generations/mo', 'All features', 'Priority support', 'Best value'] },
  ];

  const faqs = [
    { q: 'What file types does StudyStack support?', a: 'StudyStack supports PDF files, audio recordings (MP3, WAV, M4A), and plain text notes. You can upload textbooks, lecture slides, or any study material in PDF format.' },
    { q: 'How does the AI generate flashcards?', a: 'Our AI analyzes your uploaded content, identifies key concepts, definitions, and important facts, then creates question-answer pairs optimized for learning and retention.' },
    { q: 'Is my data secure?', a: 'Yes! All uploads are encrypted and stored securely. We never share your study materials with third parties. Pro users get cloud backup with end-to-end encryption.' },
    { q: 'Can I use StudyStack offline?', a: 'Yes! StudyStack works offline for reviewing flashcards and taking quizzes. Your data syncs automatically when you reconnect to the internet.' },
    { q: 'What is spaced repetition?', a: 'Spaced repetition is a scientifically-proven learning technique that shows you flashcards at optimal intervals to maximize long-term retention. Our SM-2 algorithm adapts to your performance.' },
    { q: 'Can I cancel my subscription anytime?', a: 'Absolutely! You can cancel your Pro subscription at any time. You\'ll keep access until the end of your billing period with no hidden fees.' },
  ];

  const comparisonData = [
    { feature: 'AI-Generated Content', studystack: true, anki: false, quizlet: 'Limited' },
    { feature: 'PDF Upload & Processing', studystack: true, anki: false, quizlet: false },
    { feature: 'Lecture Recording', studystack: true, anki: false, quizlet: false },
    { feature: 'Spaced Repetition (SRS)', studystack: true, anki: true, quizlet: 'Basic' },
    { feature: 'AI Tutor Chat', studystack: true, anki: false, quizlet: false },
    { feature: 'Practice Problems', studystack: true, anki: false, quizlet: false },
    { feature: 'Concept Mind Maps', studystack: true, anki: false, quizlet: false },
    { feature: 'Quiz Generation', studystack: true, anki: false, quizlet: true },
    { feature: 'Free Tier', studystack: true, anki: true, quizlet: true },
    { feature: 'Mobile App', studystack: 'Web App', anki: true, quizlet: true },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#f8fafc] dark:bg-[#0f172a] transition-colors">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 dark:bg-[#1e293b]/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#2563eb] rounded-xl">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">StudyStack</span>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => scrollToSection('features')} className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Features</button>
            <button onClick={() => scrollToSection('how-it-works')} className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">How It Works</button>
            <button onClick={() => scrollToSection('pricing')} className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Pricing</button>
            <button onClick={() => scrollToSection('compare')} className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Compare</button>
            <button onClick={() => scrollToSection('faq')} className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">FAQ</button>
            <a href="#/blog" className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Blog</a>
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
              className="bg-[#2563eb] text-white px-6 py-2 rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all font-bold shadow-sm"
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Animated */}
      <section className="px-6 py-20 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            {/* Floating animated icons */}
            <div className="relative">
              <div className="inline-block p-4 bg-[#2563eb] rounded-2xl shadow-lg animate-bounce" style={{ animationDuration: '3s' }}>
                <GraduationCap className="w-12 h-12 text-white" />
              </div>
              <div
                className="absolute top-0 right-20 p-3 bg-green-500 rounded-xl shadow-lg"
                style={{ animation: 'slowBounce 3s ease-in-out infinite' }}
              >
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div
                className="absolute -bottom-4 left-20 p-3 bg-purple-500 rounded-xl shadow-lg"
                style={{ animation: 'slowBounce 3s ease-in-out infinite', animationDelay: '1.5s' }}
              >
                <Brain className="w-6 h-6 text-white" />
              </div>
              <style>{`
                @keyframes slowBounce {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-10px); }
                }
              `}</style>
            </div>

            <div className="space-y-4">
              <h1 className="text-5xl font-bold text-slate-900 dark:text-white">
                AI-Powered{' '}
                <span className="text-[#2563eb] inline-block min-w-[200px]">
                  {typedText}<span className="animate-pulse">|</span>
                </span>
              </h1>
              <p className="text-xl text-slate-500 dark:text-slate-400">
                Upload your PDFs, lectures, or notes. AI generates study materials instantly so you can focus on learning.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-[#2563eb] text-white px-8 py-4 rounded-xl shadow-md hover:bg-blue-700 active:scale-[0.98] transition-all font-bold group"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 inline ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
                <Shield className="w-4 h-4" />
                <span>No credit card required</span>
              </div>
            </div>

            {/* Value Props */}
            <div className="flex flex-wrap gap-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#2563eb]" />
                <span className="text-slate-600 dark:text-slate-400 text-sm">Built by students, for students</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-500" />
                <span className="text-slate-600 dark:text-slate-400 text-sm">AI-powered study tools</span>
              </div>
            </div>
          </div>

          <div className="relative">
            {/* Floating cards around main image */}
            <div className="absolute -top-4 -left-4 bg-white dark:bg-slate-800 p-3 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 animate-float" style={{ animationDelay: '0s' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Quiz Complete!</span>
              </div>
            </div>

            <div className="absolute -bottom-4 -right-4 bg-white dark:bg-slate-800 p-3 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 animate-float" style={{ animationDelay: '1.5s' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">25 Cards Created</span>
              </div>
            </div>

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
      <section id="features" className="px-6 py-20 max-w-7xl mx-auto scroll-mt-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Everything You Need to Study Smarter
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            AI-powered tools designed for student success
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {features.map((feature, i) => (
            <div key={i} className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 p-5 rounded-2xl shadow hover:shadow-lg transition-shadow relative">
              {(feature as any).pro && (
                <div className="absolute top-3 right-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Pro
                </div>
              )}
              <div className="mb-3">
                <feature.icon className="w-6 h-6 text-[#2563eb]" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">{feature.title}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs">{feature.description}</p>
            </div>
          ))}
          <div className="bg-white dark:bg-[#1e293b] border-2 border-dashed border-slate-200 dark:border-slate-700 p-5 rounded-2xl shadow flex items-center justify-center">
            <p className="text-slate-400 font-bold text-center text-sm">+ More Coming Soon</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="px-6 py-20 max-w-7xl mx-auto scroll-mt-20">
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

      {/* Best For Section */}
      <section className="px-6 py-20 bg-slate-100 dark:bg-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Perfect For Every Subject
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              Different tools for different learning needs
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { subject: 'Medical & Pre-Med', icon: '🩺', tools: ['Flashcards', 'Spaced Repetition', 'Mnemonics'], desc: 'Master anatomy, pharmacology, and medical terminology' },
              { subject: 'Law School', icon: '⚖️', tools: ['Summary Notes', 'Flashcards', 'AI Tutor'], desc: 'Case briefs, legal concepts, and exam prep' },
              { subject: 'STEM', icon: '🔬', tools: ['Practice Problems', 'Concept Maps', 'Quizzes'], desc: 'Math, physics, chemistry with step-by-step solutions' },
              { subject: 'Languages', icon: '🌍', tools: ['Flashcards', 'Spaced Repetition', 'Quizzes'], desc: 'Vocabulary, grammar, and pronunciation' },
            ].map((item, i) => (
              <div key={i} className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-2">{item.subject}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{item.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {item.tools.map((tool, j) => (
                    <span key={j} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-medium">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SRS Explainer Section */}
      <section className="px-6 py-20 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-4 py-2 rounded-full text-sm font-bold mb-6">
              <Brain className="w-4 h-4" />
              Science-Backed Learning
            </div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">
              What is Spaced Repetition?
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 text-lg">
              Spaced Repetition is a learning technique that shows you information at <strong className="text-slate-900 dark:text-white">scientifically-optimized intervals</strong> to maximize long-term memory retention.
            </p>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Optimal Timing</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Cards appear right before you'd forget them, strengthening memory pathways</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Adaptive Difficulty</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Hard cards appear more often, easy cards less - focusing your study time</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">80% Less Study Time</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Research shows SRS users retain more while studying less</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1e293b] p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-6">How It Works</h3>
            <div className="space-y-4">
              {[
                { day: 'Day 1', desc: 'Learn new card', interval: 'See again in 1 day', color: 'bg-red-500' },
                { day: 'Day 2', desc: 'Review & rate "Good"', interval: 'See again in 3 days', color: 'bg-orange-500' },
                { day: 'Day 5', desc: 'Review & rate "Good"', interval: 'See again in 7 days', color: 'bg-yellow-500' },
                { day: 'Day 12', desc: 'Review & rate "Easy"', interval: 'See again in 21 days', color: 'bg-green-500' },
                { day: 'Day 33+', desc: 'Card mastered!', interval: 'Long-term memory', color: 'bg-blue-500' },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${step.color}`}></div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">{step.day}</span>
                      <span className="text-xs text-slate-400">{step.interval}</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                💡 StudyStack uses the SM-2 algorithm, the same proven system used by medical students worldwide.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* Referral Program */}
      <section className="px-6 py-20 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-4 py-2 rounded-full text-sm font-bold mb-6">
              <Gift className="w-4 h-4" />
              Referral Program
            </div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Invite Friends, Earn a Free Semester
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              Share StudyStack with friends and both of you save money
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Share2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">Share Your Code</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Get a unique referral code when you sign up</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 text-center">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">Friends Get $7.50 Off</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Your friend saves on their first purchase</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 text-center">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Crown className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">You Earn $7.50 Credit</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">When they upgrade to Pro</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-lg text-slate-700 dark:text-slate-300 mb-2">
              <span className="font-bold text-2xl text-primary">Refer 6 friends</span>
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              Earn up to <span className="font-bold text-green-600 dark:text-green-400">$45 in credits</span> — that's basically a free semester!
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-20 max-w-7xl mx-auto scroll-mt-20">
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

      {/* Comparison Section */}
      <section id="compare" className="px-6 py-20 max-w-7xl mx-auto scroll-mt-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            How StudyStack Compares
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            See why students are switching to StudyStack
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full bg-white dark:bg-[#1e293b] rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800">
                <th className="px-6 py-4 text-left text-sm font-bold text-slate-600 dark:text-slate-300">Feature</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-[#2563eb]">
                  <div className="flex items-center justify-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    StudyStack
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-sm font-bold text-slate-600 dark:text-slate-300">Anki</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-slate-600 dark:text-slate-300">Quizlet</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, i) => (
                <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 font-medium">{row.feature}</td>
                  <td className="px-6 py-4 text-center">
                    {row.studystack === true ? (
                      <Check className="w-5 h-5 text-green-500 mx-auto" />
                    ) : row.studystack === false ? (
                      <X className="w-5 h-5 text-slate-300 mx-auto" />
                    ) : (
                      <span className="text-sm text-slate-500">{row.studystack}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {row.anki === true ? (
                      <Check className="w-5 h-5 text-green-500 mx-auto" />
                    ) : row.anki === false ? (
                      <X className="w-5 h-5 text-slate-300 mx-auto" />
                    ) : (
                      <span className="text-sm text-slate-500">{row.anki}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {row.quizlet === true ? (
                      <Check className="w-5 h-5 text-green-500 mx-auto" />
                    ) : row.quizlet === false ? (
                      <X className="w-5 h-5 text-slate-300 mx-auto" />
                    ) : (
                      <span className="text-sm text-slate-500">{row.quizlet}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="px-6 py-20 max-w-4xl mx-auto scroll-mt-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            Everything you need to know about StudyStack
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="font-bold text-slate-900 dark:text-white">{faq.q}</span>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
              </button>
              {openFaq === i && (
                <div className="px-6 pb-4 text-slate-600 dark:text-slate-400 animate-fade-in">
                  {faq.a}
                </div>
              )}
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
            Start studying smarter with AI-powered flashcards, quizzes, and more
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
