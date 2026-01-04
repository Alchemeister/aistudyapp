
import React, { useState, type FC } from 'react';
import { Question } from '../types';

interface Props {
  questions: Question[];
  onComplete?: (score: number) => void; // Call to record score
  onExit?: () => void; // Call to close/leave
  onSaveMissed?: (missed: Question[]) => void; // Call to save flashcards
  mode?: 'take' | 'preview';
}

type InternalState = 'active' | 'summary' | 'review';

export const QuizTaker: FC<Props> = ({ questions, onComplete, onExit, onSaveMissed, mode = 'take' }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [internalState, setInternalState] = useState<InternalState>('active');
  const [savedMissed, setSavedMissed] = useState(false);

  // --- Preview Mode (Generator) ---
  if (mode === 'preview') {
    return (
      <div className="p-4 space-y-6 h-full overflow-y-auto">
        {questions.map((q, i) => (
          <div key={q.id} className="p-5 border border-slate-200 rounded-xl bg-white shadow-sm">
            <p className="font-bold text-slate-800 mb-3 text-lg flex gap-3">
              <span className="text-slate-400 font-mono text-base pt-0.5">{i + 1}.</span> 
              <span className="flex-1">{q.text || "Question Text Missing"}</span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded h-fit whitespace-nowrap">{(q.type || 'UNKNOWN').replace('_', ' ')}</span>
            </p>
            {q.type === 'MATCHING' && (
               <div className="pl-9 mb-3">
                  <div className="text-xs font-bold text-slate-500 uppercase mb-1">Word Bank:</div>
                  <div className="flex flex-wrap gap-2">
                    {q.options?.map(opt => (
                       <span key={opt} className="px-2 py-1 bg-slate-100 rounded text-sm border border-slate-200">{opt}</span>
                    ))}
                  </div>
               </div>
            )}
            {(q.type === 'MC' || q.type === 'TF') && (
                <div className="space-y-2 pl-9">
                {q.options?.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded border border-transparent hover:bg-slate-50 transition-colors">
                    <div className="w-4 h-4 rounded-full border border-slate-300 flex-shrink-0"></div>
                    <span className="text-slate-600">{opt}</span>
                    </div>
                ))}
                </div>
            )}
            {q.type === 'FILL_BLANK' && <div className="ml-9 p-2 border border-slate-300 rounded bg-slate-50 text-slate-400 text-sm italic">Text Input Field</div>}
            {q.type === 'SHORT_ANSWER' && <div className="ml-9 p-2 border border-slate-300 rounded bg-slate-50 text-slate-400 text-sm italic h-16">Essay Text Area</div>}
            
            {q.source && (
                <div className="ml-9 mt-4 text-xs text-slate-400 font-bold uppercase tracking-wide flex items-center gap-1">
                    <i className="fas fa-book"></i> Source: {q.source}
                </div>
            )}
          </div>
        ))}
        <div className="text-center text-xs text-slate-400 italic pt-4">
          Answers hidden in preview mode.
        </div>
      </div>
    );
  }

  // --- Take / Review Logic ---

  const handleAnswer = (val: string) => {
    if (internalState !== 'active') return;
    setAnswers({ ...answers, [questions[currentIndex].id]: val });
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      finishQuiz();
    }
  };

  const prevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const checkAnswer = (q: Question, userAnswer: string) => {
      if (!userAnswer) return false;
      
      const normalize = (s: string) => s.trim().toLowerCase();

      if (q.type === 'MC' || q.type === 'TF' || q.type === 'MATCHING') {
          return normalize(userAnswer) === normalize(q.correctAnswer || '');
      }
      
      if (q.type === 'FILL_BLANK') {
          return normalize(userAnswer) === normalize(q.correctAnswer || '');
      }

      // Simplistic check for Short Answer in MVP (requires keywords)
      if (q.type === 'SHORT_ANSWER') {
          if (q.keywords && q.keywords.length > 0) {
              return q.keywords.some(k => normalize(userAnswer).includes(normalize(k)));
          }
          // Fallback: If answer is long enough, count as 'submitted' but user must verify.
          // For scoring purposes, we'll just count it correct if it's > 10 chars for now.
          return userAnswer.length > 10;
      }

      return false;
  };

  const finishQuiz = () => {
    setInternalState('summary');
    if (onComplete) {
      const score = questions.reduce((acc, q) => acc + (checkAnswer(q, answers[q.id]) ? 1 : 0), 0);
      onComplete(score);
    }
  };

  const handleRetake = () => {
    setAnswers({});
    setCurrentIndex(0);
    setInternalState('active');
    setSavedMissed(false);
  };

  const handleCreateFlashcards = (subset: 'all' | 'missed') => {
    if (onSaveMissed) {
      let subsetQuestions = questions;
      if (subset === 'missed') {
         subsetQuestions = questions.filter(q => !checkAnswer(q, answers[q.id]));
      }
      
      if (subsetQuestions.length > 0) {
          onSaveMissed(subsetQuestions);
          setSavedMissed(true);
      }
    }
  };

  const currentQ = questions[currentIndex];
  const score = questions.reduce((acc, q) => acc + (checkAnswer(q, answers[q.id]) ? 1 : 0), 0);
  const percentage = Math.round((score / questions.length) * 100);
  const missedCount = questions.length - score;

  // --- Summary View ---
  if (internalState === 'summary') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold mb-6 shadow-lg ${percentage >= 80 ? 'bg-green-100 text-green-600' : percentage >= 60 ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
          {percentage}%
        </div>
        
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          {percentage >= 90 ? 'Excellent Work!' : percentage >= 70 ? 'Good Job!' : 'Keep Practicing'}
        </h2>
        <p className="text-slate-500 mb-8 text-lg">You scored {score} out of {questions.length}</p>

        <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-8">
           <div className="bg-green-50 p-4 rounded-xl border border-green-100">
             <div className="text-2xl font-bold text-green-600">{score}</div>
             <div className="text-xs font-bold text-green-800 uppercase tracking-wide">Correct</div>
           </div>
           <div className="bg-red-50 p-4 rounded-xl border border-red-100">
             <div className="text-2xl font-bold text-red-600">{questions.length - score}</div>
             <div className="text-xs font-bold text-red-800 uppercase tracking-wide">Incorrect</div>
           </div>
        </div>

        <div className="space-y-3 w-full max-w-xs">
           
          {/* Flashcard Creation Options */}
          {onSaveMissed && !savedMissed && (
             <div className="grid grid-cols-2 gap-2">
                 {missedCount > 0 && (
                     <button 
                       onClick={() => handleCreateFlashcards('missed')}
                       className="py-3 px-2 bg-amber-100 text-amber-800 rounded-lg font-bold text-xs hover:bg-amber-200 transition-colors"
                     >
                       <i className="fas fa-plus-circle mr-1"></i> Missed to Flashcards
                     </button>
                 )}
                 <button 
                    onClick={() => handleCreateFlashcards('all')}
                    className={`py-3 px-2 bg-blue-100 text-blue-800 rounded-lg font-bold text-xs hover:bg-blue-200 transition-colors ${missedCount === 0 ? 'col-span-2' : ''}`}
                  >
                    <i className="fas fa-layer-group mr-1"></i> All to Flashcards
                  </button>
             </div>
          )}
          
          {savedMissed && (
              <div className="w-full py-3 px-4 rounded-lg font-bold shadow-sm bg-slate-100 text-slate-400 cursor-default flex items-center justify-center gap-2">
                 <i className="fas fa-check"></i> Flashcards Created
              </div>
          )}

          <button 
            onClick={() => setInternalState('review')}
            className="w-full py-3 px-4 bg-white border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-50 transition-colors"
          >
            Review Answers
          </button>
          
          <div className="flex gap-3">
             <button onClick={handleRetake} className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200 transition-colors">Retake</button>
             <button onClick={onExit} className="flex-1 py-3 px-4 bg-primary text-white rounded-lg font-bold hover:bg-blue-600 shadow-md transition-colors">Finish</button>
          </div>
        </div>
      </div>
    );
  }

  // --- Review View (List with answers) ---
  if (internalState === 'review') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 p-4 bg-white border-b border-slate-200 flex justify-between items-center z-10">
           <h3 className="font-bold text-slate-800">Review Quiz</h3>
           <button onClick={() => setInternalState('summary')} className="text-sm font-bold text-primary hover:underline">Back to Summary</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          {questions.map((q, i) => {
            const userAns = answers[q.id];
            const isCorrect = checkAnswer(q, userAns);
            return (
              <div key={q.id} className={`p-5 rounded-xl border shadow-sm bg-white ${isCorrect ? 'border-green-200 ring-1 ring-green-100' : 'border-red-200 ring-1 ring-red-100'}`}>
                <div className="flex gap-3">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {isCorrect ? <i className="fas fa-check"></i> : <i className="fas fa-times"></i>}
                  </span>
                  <div className="flex-1">
                     <p className="font-bold text-slate-800 mb-3 text-lg">{q.text}</p>
                     
                     <div className="text-sm mb-2">
                        <span className="text-slate-500 font-medium uppercase text-xs mr-2">Your Answer:</span>
                        <span className={`font-bold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>{userAns || "Skipped"}</span>
                     </div>
                     
                     {!isCorrect && (
                       <div className="text-sm mb-3 bg-green-50 p-2 rounded border border-green-100 inline-block">
                          <span className="text-green-800 font-medium uppercase text-xs mr-2">Correct Answer:</span>
                          <span className="font-bold text-green-700">{q.correctAnswer}</span>
                       </div>
                     )}

                     {q.explanation && (
                       <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-600 border-l-4 border-slate-300">
                         <span className="font-bold text-slate-700 block mb-1">Explanation</span>
                         {q.explanation}
                       </div>
                     )}

                     {q.source && (
                        <div className="mt-3 text-xs text-slate-400 font-bold uppercase tracking-wide flex items-center gap-1">
                            <i className="fas fa-book"></i> Source: {q.source}
                        </div>
                     )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-4 bg-white border-t border-slate-200 text-center">
            <button onClick={onExit} className="px-8 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700">Close Review</button>
        </div>
      </div>
    );
  }

  // --- Active Take View (Render logic split by type) ---
  const renderQuestionContent = () => {
      const q = currentQ;
      
      // 1. Multiple Choice & True False
      if (q.type === 'MC' || q.type === 'TF') {
          // Safety Fallback for bad data (missing options)
          const options = (q.options && q.options.length > 0) 
              ? q.options 
              : q.type === 'TF' 
                  ? ['True', 'False'] 
                  : ['Error: No Options Provided'];

          return (
            <div className="space-y-3">
            {options.map((opt) => (
                <button
                key={opt}
                onClick={() => handleAnswer(opt)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    answers[q.id] === opt 
                    ? 'bg-blue-50 border-primary text-primary shadow-sm' 
                    : 'border-transparent bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
                >
                <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${answers[q.id] === opt ? 'border-primary bg-primary' : 'border-slate-300 bg-white'}`}>
                        {answers[q.id] === opt && <div className="w-2 h-2 rounded-full bg-white"></div>}
                    </div>
                    <span className="font-medium text-base">{opt}</span>
                </div>
                </button>
            ))}
            </div>
          );
      }

      // 2. Fill in the Blank
      if (q.type === 'FILL_BLANK') {
          return (
            <div>
               <p className="text-sm text-slate-500 mb-2 font-bold uppercase">Type the missing word:</p>
               <input 
                 autoFocus
                 className="w-full p-4 text-lg border-2 border-slate-300 rounded-xl focus:border-primary focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                 placeholder="Type your answer here..."
                 value={answers[q.id] || ''}
                 onChange={(e) => handleAnswer(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter') nextQuestion(); }}
               />
            </div>
          );
      }

      // 3. Matching (Word Bank)
      if (q.type === 'MATCHING') {
          return (
             <div>
                <div className="bg-slate-100 p-4 rounded-xl mb-6 border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-3">Word Bank (Select One)</p>
                    <div className="flex flex-wrap gap-2">
                        {q.options?.map(opt => (
                            <button 
                              key={opt}
                              onClick={() => handleAnswer(opt)}
                              className={`px-3 py-1.5 rounded-lg border text-sm font-bold transition-all ${
                                  answers[q.id] === opt 
                                    ? 'bg-primary text-white border-primary shadow-md transform scale-105' 
                                    : 'bg-white text-slate-700 border-slate-300 hover:border-primary'
                              }`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl text-center bg-slate-50">
                    <span className="text-lg text-slate-700">Selected Answer: </span>
                    {answers[q.id] ? (
                        <span className="text-xl font-bold text-primary border-b-2 border-primary pb-1">{answers[q.id]}</span>
                    ) : (
                        <span className="text-lg text-slate-400 italic">...</span>
                    )}
                </div>
             </div>
          );
      }

      // 4. Short Answer
      if (q.type === 'SHORT_ANSWER') {
          return (
             <div>
                <p className="text-sm text-slate-500 mb-2 font-bold uppercase">Your Response:</p>
                <textarea 
                  autoFocus
                  className="w-full p-4 text-base border-2 border-slate-300 rounded-xl focus:border-primary focus:ring-4 focus:ring-blue-100 outline-none transition-all min-h-[150px]"
                  placeholder="Type your explanation..."
                  value={answers[q.id] || ''}
                  onChange={(e) => handleAnswer(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-2 text-right">Self-graded via keyword check.</p>
             </div>
          );
      }

      return null;
  };

  return (
    <div className="max-w-2xl mx-auto p-4 flex flex-col h-full">
      <div className="mb-4 flex justify-between text-sm text-slate-500 font-bold uppercase tracking-wider">
        <span>Question {currentIndex + 1} / {questions.length}</span>
        <span>{Math.round(((currentIndex + 1) / questions.length) * 100)}%</span>
      </div>
      
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mb-6 flex-1 overflow-y-auto">
        <h3 className="text-xl font-bold mb-8 text-slate-800 leading-relaxed">
             {(currentQ.text || '').replace(/_{2,}/g, '______')}
        </h3>
        
        {renderQuestionContent()}

      </div>

      <div className="flex justify-between items-center mt-auto py-2">
        <button
          onClick={prevQuestion}
          disabled={currentIndex === 0}
          className="px-6 py-2 text-slate-500 font-bold hover:text-slate-800 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
        >
          <i className="fas fa-arrow-left mr-2"></i> Previous
        </button>
        
        <button
          onClick={nextQuestion}
          disabled={!answers[currentQ.id]}
          className="px-8 py-3 bg-primary text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 shadow-md hover:shadow-lg transition-all transform active:scale-[0.98]"
        >
          {currentIndex === questions.length - 1 ? 'Finish Quiz' : 'Next'} <i className="fas fa-arrow-right ml-2"></i>
        </button>
      </div>
    </div>
  );
};
