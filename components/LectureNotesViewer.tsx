import React, { useState, type FC } from 'react';
import {
  FileText, Sparkles, ListChecks, Target, ChevronDown, ChevronUp,
  Loader2, Clock, RefreshCw
} from 'lucide-react';
import { Lecture } from '../types';
import { generateLectureSummary, LectureSummaryResult } from '../services/geminiService';

interface Props {
  lecture: Lecture;
  onUpdateLecture: (lecture: Lecture) => void;
}

export const LectureNotesViewer: FC<Props> = ({ lecture, onUpdateLecture }) => {
  const [generating, setGenerating] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasSummary = !!lecture.summary;

  const handleGenerateSummary = async () => {
    if (!lecture.transcript || lecture.transcript.trim().length < 50) {
      setError('Transcript is too short to summarize. Please add more content.');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const result = await generateLectureSummary(lecture.transcript, lecture.title);

      if (result) {
        const updatedLecture: Lecture = {
          ...lecture,
          summary: result.summary,
          keyPoints: result.keyPoints,
          actionItems: result.actionItems,
          summaryGeneratedAt: new Date().toISOString()
        };
        onUpdateLecture(updatedLecture);
      } else {
        setError('Failed to generate summary. Please try again.');
      }
    } catch (e) {
      setError('An error occurred. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!hasSummary) {
    // Show generate button
    return (
      <div className="space-y-4">
        {/* Transcript Preview */}
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
              <FileText className="w-4 h-4" />
              Transcript
            </div>
            <span className="text-xs text-slate-400">
              {lecture.transcript?.split(/\s+/).length || 0} words
            </span>
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400 max-h-32 overflow-y-auto leading-relaxed">
            {lecture.transcript?.substring(0, 500)}
            {(lecture.transcript?.length || 0) > 500 && '...'}
          </div>
        </div>

        {/* Generate Button */}
        <div className="text-center py-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
          <Sparkles className="w-10 h-10 mx-auto text-purple-500 mb-3" />
          <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-2">
            Generate Smart Notes
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-xs mx-auto">
            AI will create a summary, key points, and action items from your lecture transcript.
          </p>
          <button
            onClick={handleGenerateSummary}
            disabled={generating}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold rounded-lg hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 flex items-center gap-2 mx-auto shadow-lg shadow-purple-500/20"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Smart Notes
              </>
            )}
          </button>
          {error && (
            <p className="text-sm text-red-500 mt-3">{error}</p>
          )}
        </div>
      </div>
    );
  }

  // Show generated summary
  return (
    <div className="space-y-4">
      {/* Summary Section */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <span className="font-bold text-slate-700 dark:text-slate-200">Smart Notes</span>
            </div>
            <div className="flex items-center gap-2">
              {lecture.summaryGeneratedAt && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(lecture.summaryGeneratedAt)}
                </span>
              )}
              <button
                onClick={handleGenerateSummary}
                disabled={generating}
                className="p-1.5 text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded transition-colors"
                title="Regenerate"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
            {lecture.summary}
          </p>
        </div>
      </div>

      {/* Key Points */}
      {lecture.keyPoints && lecture.keyPoints.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              <span className="font-bold text-slate-700 dark:text-slate-200">Key Points</span>
              <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                {lecture.keyPoints.length}
              </span>
            </div>
          </div>
          <div className="p-4">
            <ul className="space-y-2">
              {lecture.keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-slate-600 dark:text-slate-300">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Action Items */}
      {lecture.actionItems && lecture.actionItems.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-green-500" />
              <span className="font-bold text-slate-700 dark:text-slate-200">Action Items</span>
              <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                {lecture.actionItems.length}
              </span>
            </div>
          </div>
          <div className="p-4">
            <ul className="space-y-2">
              {lecture.actionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <div className="w-4 h-4 rounded border-2 border-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-600 dark:text-slate-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Collapsible Transcript */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Original Transcript</span>
            <span className="text-xs text-slate-400">
              ({lecture.transcript?.split(/\s+/).length || 0} words)
            </span>
          </div>
          {showTranscript ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>
        {showTranscript && (
          <div className="p-4 pt-0 border-t border-slate-200 dark:border-slate-700">
            <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
              {lecture.transcript}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}
    </div>
  );
};
