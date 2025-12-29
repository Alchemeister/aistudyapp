import React, { useState } from 'react';
import { Question } from '../types';

interface Props {
  questions: Question[];
  onComplete?: (score: number) => void; // Call to record score
  onExit?: () => void; // Call to close/leave
  onSaveMissed?: (missed: Question[]) => void; // Call to save flashcards
  mode?: 'take' | 'preview';
}

type InternalState = 'active' | 'summary' | 'review';

export const QuizTaker: React.FC<Props> = ({ questions, onComplete, onExit, onSaveMissed, mode = 'take' }) => {
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
              {q.text}
            </p>
            <div className="space-y-2 pl-9">
              {q.options?.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded border border-transparent hover:bg-slate-50 transition-colors">
                  <div className="w-4 h-4 rounded-full border border-slate-300 flex-shrink-0"></div>
                  <span className="text-slate-600">{opt}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="text-center text-xs text-slate-400 italic pt-4">
          Answers hidden in preview mode.
        </div>
      </div>
    );
  }

  // --- Take / Review Logic ---

  const handleAnswer = (option: string) => {
    if (internalState !== 'active') return;
    setAnswers({ ...answers, [questions[currentIndex].id]: option });
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

  const finishQuiz = () => {
    setInternalState('summary');
    if (onComplete) {
      const score = questions.reduce((acc, q) => acc + (answers[q.id] === q.correctAnswer ? 1 : 0), 0);
      onComplete(score);
    }
  };

  const handleRetake = () => {
    setAnswers({});
    setCurrentIndex(0);
    setInternalState('active');
    setSavedMissed(false);
  };

  const handleSaveMissedAction = () => {
    if (onSaveMissed) {
      const missed = questions.filter(q => answers[q.id] !== q.correctAnswer);
      onSaveMissed(missed);
      setSavedMissed(true);
    }
  };

  const currentQ = questions[currentIndex];
  const score = questions.reduce((acc, q) => acc + (answers[q.id] === q.correctAnswer ? 1 : 0), 0);
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
          {missedCount > 0 && onSaveMissed && (
            <button 
              onClick={handleSaveMissedAction}
              disabled={savedMissed}
              className={`w-full py-3 px-4 rounded-lg font-bold shadow-sm flex items-center justify-center gap-2 transition-all ${savedMissed ? 'bg-slate-100 text-slate-400 cursor-default' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
            >
              {savedMissed ? <i className="fas fa-check"></i> : <i className="fas fa-plus-circle"></i>}
              {savedMissed ? 'Added to Library' : 'Add Missed as Flashcards'}
            </button>
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
            const isCorrect = userAns === q.correctAnswer;
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

  // --- Active Take View ---
  return (
    <div className="max-w-2xl mx-auto p-4 flex flex-col h-full">
      <div className="mb-4 flex justify-between text-sm text-slate-500 font-bold uppercase tracking-wider">
        <span>Question {currentIndex + 1} / {questions.length}</span>
        <span>{Math.round(((currentIndex + 1) / questions.length) * 100)}%</span>
      </div>
      
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mb-6 flex-1 overflow-y-auto">
        <h3 className="text-xl font-bold mb-8 text-slate-800 leading-relaxed">{currentQ.text}</h3>
        <div className="space-y-3">
          {currentQ.options?.map((opt) => (
            <button
              key={opt}
              onClick={() => handleAnswer(opt)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                answers[currentQ.id] === opt 
                  ? 'bg-blue-50 border-primary text-primary shadow-sm' 
                  : 'border-transparent bg-slate-50 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                 <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${answers[currentQ.id] === opt ? 'border-primary bg-primary' : 'border-slate-300 bg-white'}`}>
                    {answers[currentQ.id] === opt && <div className="w-2 h-2 rounded-full bg-white"></div>}
                 </div>
                 <span className="font-medium text-base">{opt}</span>
              </div>
            </button>
          ))}
        </div>
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
          {currentIndex === questions.length - 1 ? 'Finish Quiz' : 'Next Question'} <i className="fas fa-arrow-right ml-2"></i>
        </button>
      </div>
    </div>
  );
};