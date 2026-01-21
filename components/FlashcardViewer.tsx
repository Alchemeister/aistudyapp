import React, { useState, type FC } from 'react';
import { Layers, Copy, AlertTriangle, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { Flashcard } from '../types';

interface Props {
  cards: Flashcard[];
  onFixCard?: (card: Flashcard) => void;
}

export const FlashcardViewer: FC<Props> = ({ cards, onFixCard }) => {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!cards || cards.length === 0) return (
    <div className="text-center py-10 px-4">
      <div className="text-slate-300 mb-4"><Layers className="w-12 h-12 mx-auto" /></div>
      <p className="text-slate-500 font-bold">No flashcards generated.</p>
      <p className="text-xs text-slate-400 mt-2">Try selecting more content or different source material.</p>
    </div>
  );

  // Safety check: if index out of bounds (e.g. after filter), reset to 0
  const safeIndex = index >= cards.length ? 0 : index;
  const card = cards[safeIndex];
  const isBroken = !card || !card.front || !card.back || !card.front.trim() || !card.back.trim();

  return (
    <div className="flex flex-col w-full h-full">
      {/* Card Area - Flex 1 ensures it fills all available space */}
      <div
        className="flex-1 w-full relative cursor-pointer group perspective"
        style={{ perspective: '1000px' }}
        onClick={() => !isBroken && setFlipped(!flipped)}
      >
        <div
          className="relative w-full h-full transition-transform duration-500"
          style={{ transformStyle: 'preserve-3d', transform: flipped && !isBroken ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          {/* Front */}
          <div
            className={`absolute inset-0 backface-hidden bg-white dark:bg-slate-800 border shadow-sm rounded-xl flex flex-col items-center justify-center p-8 text-center overflow-hidden ${card.isDuplicate ? 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/20' : 'border-slate-200 dark:border-slate-700'}`}
            style={{ backfaceVisibility: 'hidden' }}
          >
            {card.isDuplicate && (
                <div className="absolute top-3 right-3 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1 z-10">
                    <Copy className="w-3 h-3" /> Duplicate Skipped
                </div>
            )}

            {isBroken ? (
               <div className="flex flex-col items-center text-amber-500">
                  <AlertTriangle className="w-8 h-8 mb-2" />
                  <h4 className="font-bold">Empty Card</h4>
                  <p className="text-xs text-slate-400 mt-1 mb-4">Content could not be generated.</p>
               </div>
            ) : (
               <>
                 <div className="overflow-y-auto w-full max-h-full flex flex-col items-center justify-center">
                    <h4 className={`text-2xl font-bold leading-relaxed ${card.isDuplicate ? 'text-slate-500 opacity-70' : 'text-slate-800 dark:text-slate-100'}`}>{card.front}</h4>
                 </div>
                 <span className="absolute bottom-6 text-sm text-slate-400 font-medium uppercase tracking-wider">Tap to Flip</span>
               </>
            )}
          </div>

          {/* Back */}
          <div
            className={`absolute inset-0 backface-hidden border shadow-sm rounded-xl flex flex-col items-center justify-center p-8 text-center ${card.isDuplicate ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800' : 'bg-blue-50 dark:bg-slate-700 border-blue-200 dark:border-slate-600'}`}
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
             <div className="overflow-y-auto w-full max-h-full">
                <h4 className={`text-xl font-medium leading-relaxed ${card.isDuplicate ? 'text-slate-600 dark:text-slate-400 opacity-80' : 'text-blue-900 dark:text-slate-100'}`}>{card.back}</h4>
                {card.source && (
                    <div className="mt-6 pt-4 border-t border-blue-100 dark:border-slate-600 w-full">
                        <p className={`text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1 ${card.isDuplicate ? 'text-slate-400' : 'text-blue-400 dark:text-slate-400'}`}>
                            <MapPin className="w-3 h-3" /> {card.source}
                        </p>
                    </div>
                )}
             </div>
          </div>
        </div>
      </div>

      {/* Controls - Fixed height to prevent shifting */}
      <div className="flex-none h-16 flex items-center justify-center gap-6 mt-2">
        <button
          onClick={(e) => { e.stopPropagation(); setFlipped(false); setIndex(Math.max(0, safeIndex - 1)); }}
          disabled={safeIndex === 0}
          className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </button>
        <span className="text-base font-bold text-slate-500 dark:text-slate-400">{safeIndex + 1} / {cards.length}</span>
        <button
          onClick={(e) => { e.stopPropagation(); setFlipped(false); setIndex(Math.min(cards.length - 1, safeIndex + 1)); }}
          disabled={safeIndex === cards.length - 1}
          className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </button>
      </div>
    </div>
  );
};
