
import React, { type FC } from 'react';
import { X, AudioWaveform, MicOff } from 'lucide-react';
import { Lecture } from '../types';
import { LectureNotesViewer } from './LectureNotesViewer';

interface Props {
  lecture: Lecture;
  onClose: () => void;
  onUpdateLecture?: (lecture: Lecture) => void;
}

export const LecturePlayer: FC<Props> = ({ lecture, onClose, onUpdateLecture }) => {
  const handleUpdateLecture = (updatedLecture: Lecture) => {
    if (onUpdateLecture) {
      onUpdateLecture(updatedLecture);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 text-white relative">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center shadow-md z-10">
        <div>
          <h3 className="font-bold text-lg text-white">{lecture.title}</h3>
          <p className="text-xs text-slate-400">{new Date(lecture.date).toLocaleDateString()}</p>
        </div>
        <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
           <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 relative">
         <div className="max-w-2xl mx-auto">
            {/* Audio Player */}
            {lecture.audioUrl ? (
                <div className="mb-8 sticky top-0 bg-slate-900/95 backdrop-blur z-10 p-4 border border-slate-700 rounded-xl shadow-xl">
                   <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center">
                        <AudioWaveform className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Audio Recording</span>
                   </div>
                   <audio controls src={lecture.audioUrl} className="w-full" />
                </div>
            ) : (
                <div className="mb-8 p-4 bg-slate-800 rounded-xl border border-slate-700 text-center text-slate-400 text-sm">
                   <MicOff className="w-5 h-5 mb-2 block mx-auto" />
                   No audio recording available for this note.
                </div>
            )}

            {/* Smart Lecture Notes */}
            {onUpdateLecture ? (
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <LectureNotesViewer lecture={lecture} onUpdateLecture={handleUpdateLecture} />
              </div>
            ) : (
              /* Fallback to basic transcript if no update handler */
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                  Transcript / Notes
                </h4>
                <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed whitespace-pre-wrap font-sans text-base">
                  {lecture.transcript}
                </div>
              </div>
            )}
         </div>
      </div>
    </div>
  );
};
