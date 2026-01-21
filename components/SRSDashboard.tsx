import React, { useMemo, useState, type FC } from 'react';
import { Flame, AlertTriangle, Calendar, Clock, Zap, HelpCircle } from 'lucide-react';
import { Course, Flashcard } from '../types';

interface Props {
  courses: Course[];
  onNavigateToReview?: () => void;
}

// Storage key for activity tracking
const ACTIVITY_KEY = 'srs_daily_activity';

interface DailyActivity {
  [date: string]: number; // date -> number of cards reviewed
}

// Get activity data from localStorage
const getActivityData = (): DailyActivity => {
  try {
    const stored = localStorage.getItem(ACTIVITY_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

// Record a review (called from ReviewSession)
export const recordReviewActivity = (count: number = 1) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const activity = getActivityData();
    activity[today] = (activity[today] || 0) + count;
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity));
  } catch (e) {
    console.error('Failed to record activity:', e);
  }
};

// Calculate current streak
const calculateStreak = (activity: DailyActivity): number => {
  const today = new Date();
  let streak = 0;
  let currentDate = new Date(today);

  // Check today first
  const todayStr = today.toISOString().split('T')[0];
  if (activity[todayStr] && activity[todayStr] > 0) {
    streak = 1;
  }

  // Go back day by day
  currentDate.setDate(currentDate.getDate() - 1);

  while (true) {
    const dateStr = currentDate.toISOString().split('T')[0];
    if (activity[dateStr] && activity[dateStr] > 0) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      // If today has no activity, check if yesterday started a streak
      if (streak === 0 && activity[dateStr]) {
        streak = 1;
        currentDate.setDate(currentDate.getDate() - 1);
        continue;
      }
      break;
    }

    // Safety: don't go back more than 365 days
    if (streak > 365) break;
  }

  return streak;
};

// Generate heat map data for last 8 weeks (more compact)
const generateHeatMapData = (activity: DailyActivity): { date: string; count: number; level: number }[] => {
  const data: { date: string; count: number; level: number }[] = [];
  const today = new Date();

  for (let i = 55; i >= 0; i--) { // 8 weeks = 56 days
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const count = activity[dateStr] || 0;

    // Calculate intensity level (0-4)
    let level = 0;
    if (count > 0) level = 1;
    if (count >= 5) level = 2;
    if (count >= 10) level = 3;
    if (count >= 20) level = 4;

    data.push({ date: dateStr, count, level });
  }

  return data;
};

// Find cards at risk (overdue or about to be overdue with low ease)
const findCardsAtRisk = (courses: Course[]): { card: Flashcard; courseTitle: string; reason: string }[] => {
  const atRisk: { card: Flashcard; courseTitle: string; reason: string }[] = [];
  const now = new Date();

  for (const course of courses) {
    for (const material of course.materials) {
      if (Array.isArray(material.content)) {
        for (const item of material.content) {
          const card = item as Flashcard;
          if (!card.front || !card.back) continue;

          const dueDate = card.dueDate ? new Date(card.dueDate) : null;
          const daysPastDue = dueDate ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
          const ease = card.easeFactor || 2.5;
          const lapses = card.lapses || 0;

          // High risk: significantly overdue
          if (daysPastDue > 7) {
            atRisk.push({
              card,
              courseTitle: course.title,
              reason: `Overdue by ${daysPastDue} days`
            });
            continue;
          }

          // Medium risk: low ease factor with lapses
          if (ease < 1.8 && lapses >= 2) {
            atRisk.push({
              card,
              courseTitle: course.title,
              reason: `Struggling (${lapses} lapses)`
            });
            continue;
          }

          // Cards due very soon with history of lapses
          if (daysPastDue >= 0 && daysPastDue <= 1 && lapses >= 3) {
            atRisk.push({
              card,
              courseTitle: course.title,
              reason: 'Frequent lapses'
            });
          }
        }
      }
    }
  }

  // Sort by urgency (most overdue first, then by lapses)
  return atRisk.sort((a, b) => {
    const aOverdue = a.card.dueDate ? (now.getTime() - new Date(a.card.dueDate).getTime()) : 0;
    const bOverdue = b.card.dueDate ? (now.getTime() - new Date(b.card.dueDate).getTime()) : 0;
    return bOverdue - aOverdue;
  }).slice(0, 5); // Show top 5 at-risk cards
};

export const SRSDashboard: FC<Props> = ({ courses }) => {
  const [showAtRiskTooltip, setShowAtRiskTooltip] = useState(false);
  const activity = useMemo(() => getActivityData(), []);
  const streak = useMemo(() => calculateStreak(activity), [activity]);
  const heatMapData = useMemo(() => generateHeatMapData(activity), [activity]);
  const cardsAtRisk = useMemo(() => findCardsAtRisk(courses), [courses]);

  // Calculate total cards due
  const totalDue = useMemo(() => {
    let count = 0;
    const now = new Date();
    for (const course of courses) {
      for (const material of course.materials) {
        if (Array.isArray(material.content)) {
          for (const item of material.content) {
            const card = item as Flashcard;
            if (card.front && card.dueDate) {
              const dueDate = new Date(card.dueDate);
              if (dueDate <= now && !card.mastered) {
                count++;
              }
            }
          }
        }
      }
    }
    return count;
  }, [courses]);

  // Calculate total reviewed today
  const reviewedToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return activity[today] || 0;
  }, [activity]);

  const levelColors = [
    'bg-slate-100 dark:bg-slate-700',
    'bg-green-200 dark:bg-green-900',
    'bg-green-400 dark:bg-green-700',
    'bg-green-500 dark:bg-green-600',
    'bg-green-600 dark:bg-green-500'
  ];

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Compact Stats Row */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {/* Streak */}
        <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30 border border-orange-200 dark:border-orange-800 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2">
          <div className="flex items-center gap-1">
            <Flame className="w-3 sm:w-4 h-3 sm:h-4 text-orange-500" />
            <span className="text-[9px] sm:text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase">Streak</span>
          </div>
          <div className="text-lg sm:text-xl font-black text-orange-600 dark:text-orange-400">{streak}<span className="text-[10px] sm:text-xs font-medium ml-0.5">d</span></div>
        </div>

        {/* Due */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-800 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2">
          <div className="flex items-center gap-1">
            <Clock className="w-3 sm:w-4 h-3 sm:h-4 text-blue-500" />
            <span className="text-[9px] sm:text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Due</span>
          </div>
          <div className="text-lg sm:text-xl font-black text-blue-600 dark:text-blue-400">{totalDue}</div>
        </div>

        {/* Today */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-800 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2">
          <div className="flex items-center gap-1">
            <Zap className="w-3 sm:w-4 h-3 sm:h-4 text-green-500" />
            <span className="text-[9px] sm:text-[10px] font-bold text-green-600 dark:text-green-400 uppercase">Today</span>
          </div>
          <div className="text-lg sm:text-xl font-black text-green-600 dark:text-green-400">{reviewedToday}</div>
        </div>

        {/* At Risk with tooltip */}
        <div
          className={`relative bg-gradient-to-br ${cardsAtRisk.length > 0 ? 'from-red-50 to-pink-50 dark:from-red-900/30 dark:to-pink-900/30 border-red-200 dark:border-red-800' : 'from-slate-50 to-gray-50 dark:from-slate-800 dark:to-gray-800 border-slate-200 dark:border-slate-700'} border rounded-lg px-2 sm:px-3 py-1.5 sm:py-2`}
          onMouseEnter={() => setShowAtRiskTooltip(true)}
          onMouseLeave={() => setShowAtRiskTooltip(false)}
          onClick={() => setShowAtRiskTooltip(!showAtRiskTooltip)}
        >
          <div className="flex items-center gap-1">
            <AlertTriangle className={`w-3 sm:w-4 h-3 sm:h-4 ${cardsAtRisk.length > 0 ? 'text-red-500' : 'text-slate-400'}`} />
            <span className={`text-[9px] sm:text-[10px] font-bold uppercase ${cardsAtRisk.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>Risk</span>
            <HelpCircle className={`w-2.5 sm:w-3 h-2.5 sm:h-3 ${cardsAtRisk.length > 0 ? 'text-red-400' : 'text-slate-400'}`} />
          </div>
          <div className={`text-lg sm:text-xl font-black ${cardsAtRisk.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>{cardsAtRisk.length}</div>

          {/* Tooltip - appears below */}
          {showAtRiskTooltip && (
            <div className="absolute top-full right-0 mt-2 w-56 p-2 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg shadow-lg z-50">
              <div className="absolute bottom-full right-4 border-4 border-transparent border-b-slate-900 dark:border-b-slate-700"></div>
              <p className="font-bold mb-1">What are "At Risk" cards?</p>
              <ul className="space-y-0.5 text-slate-300">
                <li>• Cards overdue by 7+ days</li>
                <li>• Cards you've struggled with (low ease, multiple lapses)</li>
                <li>• Cards with frequent "Again" ratings</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Compact Heat Map */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Activity</span>
          </div>
          <div className="flex items-center gap-0.5 text-[10px] text-slate-400">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map(level => (
              <div key={level} className={`w-2.5 h-2.5 rounded-sm ${levelColors[level]}`} />
            ))}
            <span>More</span>
          </div>
        </div>
        <div className="flex gap-0.5 flex-wrap">
          {heatMapData.map((day) => (
            <div
              key={day.date}
              className={`w-2.5 h-2.5 rounded-sm ${levelColors[day.level]} cursor-default`}
              title={`${day.date}: ${day.count} cards reviewed`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
