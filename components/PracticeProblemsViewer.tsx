import React, { useState, useEffect, useRef, type FC } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Calculator, CheckCircle, Tag, BookOpen } from 'lucide-react';
import { PracticeProblem } from '../types';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface Props {
  problems: PracticeProblem[];
}

// Render LaTeX math expressions
const MathDisplay: FC<{ math: string; display?: boolean }> = ({ math, display = false }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current && math) {
      try {
        katex.render(math, containerRef.current, {
          throwOnError: false,
          displayMode: display,
          trust: true,
        });
      } catch (e) {
        // If KaTeX fails, just show the raw text
        if (containerRef.current) {
          containerRef.current.textContent = math;
        }
      }
    }
  }, [math, display]);

  return <span ref={containerRef} className="katex-container" />;
};

// Parse text and render inline LaTeX (text between $ signs)
const RenderWithMath: FC<{ text: string }> = ({ text }) => {
  if (!text) return null;

  // Split by $ for inline math
  const parts = text.split(/(\$[^$]+\$)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1);
          return <MathDisplay key={i} math={math} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

export const PracticeProblemsViewer: FC<Props> = ({ problems }) => {
  const [index, setIndex] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [revealedSteps, setRevealedSteps] = useState<number>(0);

  if (!problems || problems.length === 0) {
    return (
      <div className="text-center py-10 px-4">
        <div className="text-slate-300 dark:text-slate-600 mb-4">
          <Calculator className="w-12 h-12 mx-auto" />
        </div>
        <p className="text-slate-500 dark:text-slate-400 font-bold">No practice problems generated.</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          Try selecting STEM content with formulas or equations.
        </p>
      </div>
    );
  }

  const safeIndex = index >= problems.length ? 0 : index;
  const problem = problems[safeIndex];

  const handleNext = () => {
    setShowSolution(false);
    setRevealedSteps(0);
    setIndex(Math.min(problems.length - 1, safeIndex + 1));
  };

  const handlePrev = () => {
    setShowSolution(false);
    setRevealedSteps(0);
    setIndex(Math.max(0, safeIndex - 1));
  };

  const revealNextStep = () => {
    if (revealedSteps < problem.steps.length) {
      setRevealedSteps(revealedSteps + 1);
    }
  };

  const toggleSolution = () => {
    if (!showSolution) {
      setShowSolution(true);
      setRevealedSteps(problem.steps.length); // Show all steps
    } else {
      setShowSolution(false);
      setRevealedSteps(0);
    }
  };

  const difficultyColor = {
    easy: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    medium: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    hard: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Problem Card */}
      <div className="flex-1 overflow-y-auto">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${difficultyColor[problem.difficulty]}`}>
                {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
              </span>
              {problem.topic && (
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> {problem.topic}
                </span>
              )}
            </div>
            {problem.formula && (
              <div className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded font-mono">
                <MathDisplay math={problem.formula} />
              </div>
            )}
          </div>

          {/* Problem Statement */}
          <div className="p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 leading-relaxed">
              <RenderWithMath text={problem.problem} />
            </h3>

            {/* Givens */}
            {problem.givens && problem.givens.length > 0 && (
              <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Given:</div>
                <ul className="space-y-1">
                  {problem.givens.map((given, i) => (
                    <li key={i} className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                      <RenderWithMath text={given} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Find */}
            {problem.find && (
              <div className="mb-6 p-3 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-lg">
                <div className="text-xs font-bold text-primary uppercase mb-1">Find:</div>
                <div className="text-sm text-slate-800 dark:text-slate-200 font-mono font-bold">
                  <RenderWithMath text={problem.find} />
                </div>
              </div>
            )}

            {/* Solution Steps */}
            {(showSolution || revealedSteps > 0) && (
              <div className="mt-6 border-t border-slate-200 dark:border-slate-600 pt-6">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-4 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Step-by-Step Solution
                </div>
                <div className="space-y-4">
                  {problem.steps.slice(0, revealedSteps).map((step, i) => (
                    <div
                      key={i}
                      className="flex gap-4 animate-fade-in"
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">
                          {step.explanation}
                        </p>
                        {step.math && (
                          <div className="text-lg font-mono text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg overflow-x-auto">
                            <MathDisplay math={step.math} display={true} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Final Answer */}
                {revealedSteps >= problem.steps.length && (
                  <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl animate-fade-in">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase">Final Answer</span>
                    </div>
                    <div className="text-xl font-bold text-green-800 dark:text-green-300 font-mono">
                      <RenderWithMath text={problem.answer} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reveal Buttons */}
            <div className="mt-6 flex gap-3">
              {!showSolution && revealedSteps < problem.steps.length && (
                <button
                  onClick={revealNextStep}
                  className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Reveal Step {revealedSteps + 1} of {problem.steps.length}
                </button>
              )}
              <button
                onClick={toggleSolution}
                className={`flex-1 px-4 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${
                  showSolution
                    ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                    : 'bg-primary text-white hover:bg-blue-600'
                }`}
              >
                {showSolution ? (
                  <>
                    <EyeOff className="w-4 h-4" /> Hide Solution
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" /> Show Full Solution
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Source */}
          {problem.source && (
            <div className="px-6 pb-4 text-xs text-slate-400 dark:text-slate-500">
              Source: {problem.source}
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
          {safeIndex + 1} / {problems.length}
        </span>
        <button
          onClick={handleNext}
          disabled={safeIndex === problems.length - 1}
          className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
      </div>
    </div>
  );
};
