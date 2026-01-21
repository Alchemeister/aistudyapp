import { Flashcard } from '../types';

export type Rating = 'again' | 'hard' | 'good' | 'easy';

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

export const calculateReview = (card: Flashcard, rating: Rating): Flashcard => {
  let { 
    interval = 0, 
    easeFactor = DEFAULT_EASE, 
    reps = 0, 
    lapses = 0 
  } = card;

  let newInterval = interval;
  let newEase = easeFactor;
  let newReps = reps;
  let newLapses = lapses;

  // New card or Reset logic
  if (rating === 'again') {
    newReps = 0;
    newInterval = 1;
    newEase = Math.max(MIN_EASE, easeFactor - 0.2);
    newLapses += 1;
  } else {
    // Success handling
    if (newInterval === 0) {
      // First successful review of a new card
      switch (rating) {
        case 'hard': newInterval = 1; break;
        case 'good': newInterval = 1; break; // Standard day 1
        case 'easy': newInterval = 4; break; // Bonus for easy
      }
    } else {
      // Standard SM-2 progression
      switch (rating) {
        case 'hard':
          newInterval = Math.ceil(interval * 1.2);
          newEase = Math.max(MIN_EASE, easeFactor - 0.15);
          break;
        case 'good':
          newInterval = Math.ceil(interval * easeFactor);
          break; // ease stays same
        case 'easy':
          newInterval = Math.ceil(interval * easeFactor * 1.3); // 1.3 bonus
          newEase += 0.15;
          break;
      }
    }
    newReps += 1;
  }

  // Calculate new due date
  const now = new Date();
  const dueDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000).toISOString();

  return {
    ...card,
    interval: newInterval,
    easeFactor: newEase,
    reps: newReps,
    lapses: newLapses,
    dueDate,
    mastered: newInterval > 21 // Visual flag for "Mastered" if interval > 3 weeks
  };
};

export const getInitialCardState = (isMissedFromQuiz = false) => ({
  interval: 0,
  reps: 0,
  lapses: 0,
  easeFactor: isMissedFromQuiz ? 2.0 : DEFAULT_EASE,
  dueDate: new Date().toISOString(), // Due immediately
  mastered: false
});