import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Course, ContentType, Flashcard, QuizResult } from '../types';
import { getCreditsInfo } from '../services/subscriptionService';

interface Props {
  courses: Course[];
  user: any;
}

export const AnalyticsDashboard: React.FC<Props> = ({ courses, user }) => {
  const navigate = useNavigate();
  const [userStatus, setUserStatus] = useState<'free' | 'pro' | 'loading'>('loading');

  // Check subscription status
  useEffect(() => {
    if (user?.uid) {
      getCreditsInfo(user.uid).then(info => {
        setUserStatus(info.status);
      }).catch(() => setUserStatus('free'));
    } else {
      setUserStatus('free');
    }
  }, [user?.uid]);

  // Calculate all stats
  const stats = useMemo(() => {
    const now = new Date();
    let totalCards = 0;
    let masteredCards = 0;
    let dueToday = 0;
    let learnedCards = 0;
    let totalEase = 0;
    let easeCount = 0;
    let totalLapses = 0;
    const allQuizResults: (QuizResult & { courseTitle: string })[] = [];
    const cardsByInterval: Record<string, number> = { 'New': 0, '1-3 days': 0, '4-7 days': 0, '1-2 weeks': 0, '2+ weeks': 0 };

    for (const course of courses) {
      // Collect quiz history
      course.quizHistory.forEach(q => {
        allQuizResults.push({ ...q, courseTitle: course.title });
      });

      // Collect flashcard stats
      course.materials.forEach(m => {
        if (m.type === ContentType.FLASHCARDS) {
          const cards = m.content as Flashcard[];
          cards.forEach(card => {
            if (!card.front?.trim() || !card.back?.trim()) return;
            totalCards++;

            if (card.interval && card.interval > 21) masteredCards++;
            if (card.dueDate && new Date(card.dueDate) <= now) dueToday++;
            if (card.reps && card.reps > 0) learnedCards++;
            if (card.easeFactor) {
              totalEase += card.easeFactor;
              easeCount++;
            }
            if (card.lapses) totalLapses += card.lapses;

            // Categorize by interval
            const interval = card.interval || 0;
            if (interval === 0) cardsByInterval['New']++;
            else if (interval <= 3) cardsByInterval['1-3 days']++;
            else if (interval <= 7) cardsByInterval['4-7 days']++;
            else if (interval <= 14) cardsByInterval['1-2 weeks']++;
            else cardsByInterval['2+ weeks']++;
          });
        }
      });
    }

    // Quiz stats
    const totalQuizzes = allQuizResults.length;
    const avgQuizScore = totalQuizzes > 0
      ? Math.round(allQuizResults.reduce((sum, q) => sum + (q.score / q.total) * 100, 0) / totalQuizzes)
      : 0;

    // Sort quiz results by date for chart
    const quizChartData = [...allQuizResults]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-10)
      .map(q => ({
        date: new Date(q.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: Math.round((q.score / q.total) * 100),
        course: q.courseTitle,
      }));

    // Interval distribution for chart
    const intervalChartData = Object.entries(cardsByInterval).map(([name, value]) => ({ name, value }));

    // Course breakdown
    const courseStats = courses.map(c => {
      let cards = 0;
      let mastered = 0;
      c.materials.forEach(m => {
        if (m.type === ContentType.FLASHCARDS) {
          const fc = m.content as Flashcard[];
          fc.forEach(card => {
            if (!card.front?.trim() || !card.back?.trim()) return;
            cards++;
            if (card.interval && card.interval > 21) mastered++;
          });
        }
      });
      return {
        name: c.code || c.title.substring(0, 10),
        title: c.title,
        cards,
        mastered,
        masteryPercent: cards > 0 ? Math.round((mastered / cards) * 100) : 0,
        quizzes: c.quizHistory.length,
        materials: c.materials.length,
      };
    }).filter(c => c.cards > 0 || c.quizzes > 0);

    return {
      totalCards,
      masteredCards,
      dueToday,
      learnedCards,
      avgEase: easeCount > 0 ? (totalEase / easeCount).toFixed(2) : '2.50',
      totalLapses,
      totalQuizzes,
      avgQuizScore,
      quizChartData,
      intervalChartData,
      courseStats,
      totalCourses: courses.length,
      masteryPercent: totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0,
    };
  }, [courses]);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

  // Loading state
  if (userStatus === 'loading') {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <i className="fas fa-circle-notch fa-spin text-3xl text-primary"></i>
      </div>
    );
  }

  // Pro gate
  if (userStatus !== 'pro') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900">
        <div className="max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center text-4xl mb-6 mx-auto shadow-lg">
            <i className="fas fa-chart-line text-white"></i>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">Analytics is a Pro Feature</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Get detailed insights into your study habits, track your progress, and optimize your learning with data-driven analytics.
          </p>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 mb-6 text-left border border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3 text-sm">What you get with Pro:</h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2"><i className="fas fa-check text-green-500"></i> Mastery tracking over time</li>
              <li className="flex items-center gap-2"><i className="fas fa-check text-green-500"></i> Quiz performance trends</li>
              <li className="flex items-center gap-2"><i className="fas fa-check text-green-500"></i> Course-by-course breakdown</li>
              <li className="flex items-center gap-2"><i className="fas fa-check text-green-500"></i> Card retention insights</li>
              <li className="flex items-center gap-2"><i className="fas fa-check text-green-500"></i> Smart Review & AI Tutor</li>
            </ul>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/settings')}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold hover:from-purple-600 hover:to-indigo-700 transition-all shadow-md"
            >
              <i className="fas fa-crown mr-2"></i> Upgrade to Pro
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">Study Analytics</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Track your progress and optimize your learning</p>
        </div>
        <Link to="/" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          <i className="fas fa-times text-xl"></i>
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon="fa-layer-group"
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
          label="Total Cards"
          value={stats.totalCards}
        />
        <StatCard
          icon="fa-trophy"
          iconBg="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-600 dark:text-green-400"
          label="Mastered"
          value={`${stats.masteredCards} (${stats.masteryPercent}%)`}
        />
        <StatCard
          icon="fa-clock"
          iconBg="bg-orange-100 dark:bg-orange-900/30"
          iconColor="text-orange-600 dark:text-orange-400"
          label="Due Today"
          value={stats.dueToday}
        />
        <StatCard
          icon="fa-clipboard-check"
          iconBg="bg-purple-100 dark:bg-purple-900/30"
          iconColor="text-purple-600 dark:text-purple-400"
          label="Avg Quiz Score"
          value={`${stats.avgQuizScore}%`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Quiz Performance Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
            <i className="fas fa-chart-line text-primary mr-2"></i>
            Quiz Performance
          </h3>
          {stats.quizChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={stats.quizChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Line type="monotone" dataKey="score" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-400">
              <p>Take some quizzes to see your progress!</p>
            </div>
          )}
        </div>

        {/* Card Retention Distribution */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
            <i className="fas fa-chart-pie text-green-500 mr-2"></i>
            Card Retention
          </h3>
          {stats.totalCards > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={stats.intervalChartData.filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {stats.intervalChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-400">
              <p>Create some flashcards to track retention!</p>
            </div>
          )}
        </div>
      </div>

      {/* Course Breakdown */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm mb-8">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
          <i className="fas fa-book-open text-amber-500 mr-2"></i>
          Course Breakdown
        </h3>
        {stats.courseStats.length > 0 ? (
          <div className="space-y-4">
            {stats.courseStats.map((course, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-16 text-right">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{course.name}</span>
                </div>
                <div className="flex-1">
                  <div className="h-6 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${course.masteryPercent}%` }}
                    />
                  </div>
                </div>
                <div className="w-20 text-right">
                  <span className="text-sm font-bold text-slate-800 dark:text-white">{course.masteryPercent}%</span>
                </div>
                <div className="w-24 text-right text-xs text-slate-400">
                  {course.mastered}/{course.cards} cards
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">
            <p>No course data to display yet.</p>
          </div>
        )}
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStatCard label="Courses" value={stats.totalCourses} icon="fa-graduation-cap" />
        <MiniStatCard label="Cards Learned" value={stats.learnedCards} icon="fa-brain" />
        <MiniStatCard label="Quizzes Taken" value={stats.totalQuizzes} icon="fa-clipboard-list" />
        <MiniStatCard label="Total Lapses" value={stats.totalLapses} icon="fa-redo" />
      </div>
    </div>
  );
};

const StatCard = ({ icon, iconBg, iconColor, label, value }: { icon: string; iconBg: string; iconColor: string; label: string; value: string | number }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center`}>
        <i className={`fas ${icon} ${iconColor}`}></i>
      </div>
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wide font-bold">{label}</p>
        <p className="text-xl font-bold text-slate-800 dark:text-white">{value}</p>
      </div>
    </div>
  </div>
);

const MiniStatCard = ({ label, value, icon }: { label: string; value: number; icon: string }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm text-center">
    <i className={`fas ${icon} text-slate-400 mb-2`}></i>
    <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
    <p className="text-xs text-slate-400 uppercase tracking-wide font-bold">{label}</p>
  </div>
);
