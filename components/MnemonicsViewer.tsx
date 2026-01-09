import React, { useState, type FC } from 'react';
import { ChevronLeft, ChevronRight, Lightbulb, Tag, BookOpen, Sparkles } from 'lucide-react';
import { Mnemonic } from '../types';

interface Props {
  mnemonics: Mnemonic[];
}

const typeIcons: Record<Mnemonic['type'], string> = {
  acronym: 'ABC',
  acrostic: 'A-Z',
  rhyme: '~~',
  story: '...',
  visual: '>>',
};

const typeColors: Record<Mnemonic['type'], string> = {
  acronym: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
  acrostic: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  rhyme: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
  story: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  visual: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
};

export const MnemonicsViewer: FC<Props> = ({ mnemonics }) => {
  const [index, setIndex] = useState(0);

  if (!mnemonics || mnemonics.length === 0) {
    return (
      <div className="text-center py-10 px-4">
        <div className="text-slate-300 dark:text-slate-600 mb-4">
          <Lightbulb className="w-12 h-12 mx-auto" />
        </div>
        <p className="text-slate-500 dark:text-slate-400 font-bold">No mnemonics generated.</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          Try selecting content with lists, sequences, or categories.
        </p>
      </div>
    );
  }

  const safeIndex = index >= mnemonics.length ? 0 : index;
  const mnemonic = mnemonics[safeIndex];

  const handleNext = () => {
    setIndex(Math.min(mnemonics.length - 1, safeIndex + 1));
  };

  const handlePrev = () => {
    setIndex(Math.max(0, safeIndex - 1));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Mnemonic Card */}
      <div className="flex-1 overflow-y-auto">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${typeColors[mnemonic.type]}`}>
                {typeIcons[mnemonic.type]} {mnemonic.type.charAt(0).toUpperCase() + mnemonic.type.slice(1)}
              </span>
              {mnemonic.topic && (
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> {mnemonic.topic}
                </span>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="p-6">
            {/* The Mnemonic */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Memory Aid</span>
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 leading-tight">
                {mnemonic.mnemonic}
              </h2>
            </div>

            {/* Items to Remember */}
            <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">
                Items to Remember ({mnemonic.items.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {mnemonic.items.map((item, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm flex items-center gap-2"
                  >
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Explanation */}
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-5 h-5 text-green-600 dark:text-green-400" />
                <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase">How It Works</span>
              </div>
              <p className="text-sm text-green-800 dark:text-green-300 leading-relaxed">
                {mnemonic.explanation}
              </p>
            </div>
          </div>

          {/* Source */}
          {mnemonic.source && (
            <div className="px-6 pb-4 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> {mnemonic.source}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-none h-16 flex items-center justify-center gap-6 mt-4">
        <button
          onClick={handlePrev}
          disabled={safeIndex === 0}
          className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <span className="text-base font-bold text-slate-500 dark:text-slate-400">
          {safeIndex + 1} / {mnemonics.length}
        </span>
        <button
          onClick={handleNext}
          disabled={safeIndex === mnemonics.length - 1}
          className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
      </div>
    </div>
  );
};
