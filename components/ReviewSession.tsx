
import React, { useState, useEffect, useCallback, type FC } from 'react';
import { Flashcard } from '../types';
import { calculateReview, Rating } from '../services/srs';

export interface ReviewItem {
  courseId: string;
  materialId: string;
  card: Flashcard;
  courseTitle: string; // Context
}

interface Props {
  queue: ReviewItem[];
  onUpdateCard: (courseId: string, materialId: string, updatedCard: Flashcard) => void;
  onExit: () => void;
}

export const ReviewSession: FC<Props> = ({ queue, onUpdateCard, onExit }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionQueue, setSessionQueue] = useState<ReviewItem[]>(queue);

  const currentItem = sessionQueue[currentIndex];

  const handleRate = useCallback((rating: Rating) => {
    if (!currentItem) return;

    // 1. Calculate new state
    const updatedCard = calculateReview(currentItem.card, rating);

    // 2. Persist up
    onUpdateCard(currentItem.courseId, currentItem.materialId, updatedCard);

    // 3. Move next
    setIsFlipped(false);
    
    // If 'again', strictly speaking in SRS we might re-queue it in the same session.
    // For this MVP, we just mark it as done for today's queue but with interval=1 (due tomorrow)
    // To make it truly robust, we could append it to the end of `sessionQueue` if `rating === 'again'`.
    if (rating === 'again') {
        // Optional: Re-queue for same-session drilling
        // setSessionQueue(prev => [...prev, { ...currentItem, card: updatedCard }]);
    }
    
    if (currentIndex < sessionQueue.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Session complete
      onExit(); 
    }
  }, [currentItem, currentIndex, sessionQueue.length, onUpdateCard, onExit]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFlipped) {
        if (e.code === 'Space' || e.code === 'Enter') {
          setIsFlipped(true);
        }
        return;
      }

      switch (e.key) {
        case '1': handleRate('again'); break;
        case '2': handleRate('hard'); break;
        case '3': handleRate('good'); break;
        case '4': handleRate('easy'); break;
        case ' ': handleRate('good'); break; // Space defaults to Good on back
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, handleRate]);

  if (!currentItem) {
    return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in bg-slate-100 dark:bg-slate-900">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center text-4xl mb-6 shadow-sm">
                <i className="fas fa-check"></i>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">All Caught Up!</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8">No more cards due for review right now.</p>
            <button onClick={onExit} className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-md">
                Back to Dashboard
            </button>
        </div>
    );
  }

  const progress = Math.round(((currentIndex) / sessionQueue.length) * 100);

  return (
    <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex justify-between items-center shadow-sm z-10">
         <div className="flex items-center gap-4">
            <button onClick={onExit} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold text-sm">
                <i className="fas fa-times mr-2"></i>Exit
            </button>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-600"></div>
            <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Course</span>
                <span className="text-sm font-bold text-slate-800 dark:text-white">{currentItem.courseTitle}</span>
            </div>
         </div>
         <div className="flex items-center gap-4">
             <div className="text-right">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Progress</span>
                <span className="text-sm font-bold text-slate-800 dark:text-white">{currentIndex + 1} / {sessionQueue.length}</span>
             </div>
             <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                 <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }}></div>
             </div>
         </div>
      </div>

      {/* Card Area */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
         <div
           className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden transition-all duration-300 min-h-[400px]"
           onClick={() => !isFlipped && setIsFlipped(true)}
         >
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 md:p-12 text-center cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
               <h3 className="text-2xl font-bold text-slate-800 dark:text-white leading-relaxed">
                 {currentItem.card.front}
               </h3>
               {!isFlipped && (
                   <div className="mt-8 text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                       Tap to Show Answer
                   </div>
               )}
            </div>

            {isFlipped && (
                <div className="flex-1 border-t border-slate-100 dark:border-slate-700 bg-blue-50/30 dark:bg-blue-900/20 flex flex-col items-center justify-center p-4 sm:p-8 md:p-12 text-center animate-fade-in-up w-full">
                    <div className="prose prose-slate dark:prose-invert max-w-none w-full">
                        <p className="text-xl text-slate-700 dark:text-slate-200 whitespace-pre-wrap font-medium">{currentItem.card.back}</p>
                        {currentItem.card.source && (
                            <p className="mt-6 text-xs text-slate-400 font-bold uppercase tracking-wide flex items-center justify-center gap-1">
                                <i className="fas fa-map-marker-alt"></i> {currentItem.card.source}
                            </p>
                        )}
                    </div>
                </div>
            )}
         </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-6 z-10">
         {!isFlipped ? (
             <button
               onClick={() => setIsFlipped(true)}
               className="w-full max-w-md mx-auto block py-4 bg-primary text-white rounded-xl font-bold text-lg shadow-md hover:bg-blue-600 hover:shadow-lg transition-all active:transform active:scale-[0.98]"
             >
                 Show Answer <span className="text-blue-200 text-sm ml-2 font-normal">(Space)</span>
             </button>
         ) : (
             <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                 <RateBtn label="Again" sub="< 1m" color="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/60" onClick={() => handleRate('again')} shortcut="1" />
                 <RateBtn label="Hard" sub="2d" color="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800 hover:bg-orange-200 dark:hover:bg-orange-900/60" onClick={() => handleRate('hard')} shortcut="2" />
                 <RateBtn label="Good" sub="3d" color="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-200 dark:hover:bg-blue-900/60" onClick={() => handleRate('good')} shortcut="3" />
                 <RateBtn label="Easy" sub="4d" color="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-200 dark:hover:bg-green-900/60" onClick={() => handleRate('easy')} shortcut="4" />
             </div>
         )}
      </div>
    </div>
  );
};

const RateBtn = ({ label, sub, color, onClick, shortcut }: any) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-3 min-h-[56px] rounded-xl border-b-4 active:border-b-0 active:translate-y-1 transition-all ${color}`}
    >
        <span className="font-bold text-base sm:text-lg">{label}</span>
        <span className="text-[10px] sm:text-xs opacity-75 font-medium">{sub} • {shortcut}</span>
    </button>
);
