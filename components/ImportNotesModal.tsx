import React, { useState, type FC, type ChangeEvent } from 'react';
import { X, FileText, CloudUpload, Loader2, Check, ArrowRight, AlertCircle } from 'lucide-react';
import { loadPdfDocument, extractAllText } from '../services/pdfUtils';
import { Lecture, Course } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: Partial<Lecture>) => void;
  onSaveToChapter: (chapterId: string, notes: string, title: string) => void;
  onCreateNotesChapter: (title: string, notes: string) => void;
  onToast: (msg: string, type: 'success'|'error'|'info') => void;
  course: Course;
}

const uuid = () => Math.random().toString(36).substring(2, 9);

export const ImportNotesModal: FC<Props> = ({ isOpen, onClose, onSave, onSaveToChapter, onCreateNotesChapter, onToast, course }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');

  if (!isOpen) return null;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      setTitle(f.name.replace(/\.[^/.]+$/, ""));
      setStep(2);
    }
  };

  const extractDocxText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const text = new TextDecoder().decode(uint8Array);
    const matches = text.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
    return matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ').substring(0, 50000);
  };

  const extractContent = async (file: File): Promise<string> => {
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.pdf')) {
      const fileUrl = URL.createObjectURL(file);
      const doc = await loadPdfDocument(fileUrl);
      const content = await extractAllText(doc);
      URL.revokeObjectURL(fileUrl);
      return content;
    } else if (fileName.endsWith('.docx')) {
      return await extractDocxText(file);
    } else {
      return await file.text();
    }
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    
    try {
      const content = await extractContent(file);
      const noteTitle = title || "Imported Notes";

      if (selectedChapterId && selectedChapterId !== 'new') {
        onSaveToChapter(selectedChapterId, content, noteTitle);
        onToast("Notes added to chapter!", "success");
      } else if (selectedChapterId === 'new') {
        onCreateNotesChapter(noteTitle, content);
        onToast("New notes chapter created!", "success");
      } else {
        const note: Partial<Lecture> = {
          id: uuid(),
          title: noteTitle,
          date: new Date().toISOString(),
          transcript: content,
          sourceType: 'upload',
          fileName: file.name
        };
        onSave(note);
        onToast("Notes imported!", "success");
      }

      resetAndClose();
    } catch (e) {
      console.error(e);
      onToast("Failed to parse file. Try a different format.", "error");
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
    setFile(null);
    setTitle('');
    setStep(1);
    setSelectedChapterId('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={resetAndClose} />
      
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-gradient-to-r from-purple-600 to-pink-600">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            {step === 1 && "Upload Notes"}
            {step === 2 && "Where to Save"}
            {step === 3 && "Importing..."}
          </h3>
          <button onClick={resetAndClose} className="text-white/80 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Progress Steps */}
          <div className="flex items-center gap-2 mb-6">
            <div className={`flex-1 h-2 rounded-full transition-colors ${step >= 1 ? 'bg-purple-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
            <div className={`flex-1 h-2 rounded-full transition-colors ${step >= 2 ? 'bg-purple-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
            <div className={`flex-1 h-2 rounded-full transition-colors ${step >= 3 ? 'bg-purple-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
          </div>

          {step === 1 && (
            <div className="space-y-4">
              {/* Simple Drag & Drop */}
              <div className="border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-2xl p-8 text-center hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all relative group cursor-pointer">
                <input
                  type="file"
                  accept=".txt,.md,.pdf,.docx,.rtf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <CloudUpload className="w-12 h-12 mx-auto mb-3 text-purple-500 group-hover:scale-110 transition-transform" />
                <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">Drop your notes here</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">or click to browse</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">PDF, DOCX, TXT, RTF</p>
              </div>

              {/* Quick Format Tips */}
              <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>For best results, use PDF or DOCX files. Plain text files work too!</p>
              </div>
            </div>
          )}

          {step === 2 && file && (
            <div className="space-y-4">
              {/* File Preview */}
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <Check className="w-5 h-5 text-green-500" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button 
                  onClick={() => setStep(1)}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                >
                  Change
                </button>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  Notes Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Week 5 Lecture Notes"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Simple Destination Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  Save To
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  <label className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${selectedChapterId === 'new' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-purple-300'}`}>
                    <input
                      type="radio"
                      name="destination"
                      checked={selectedChapterId === 'new'}
                      onChange={() => setSelectedChapterId('new')}
                      className="w-4 h-4 text-purple-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-slate-700 dark:text-slate-200">Create New Notes Chapter</p>
                      <p className="text-xs text-slate-500">Best for standalone notes</p>
                    </div>
                  </label>

                  {course.chapters.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-slate-500 uppercase mt-3 mb-2">Or add to existing chapter:</p>
                      {course.chapters.slice(0, 5).map((ch) => (
                        <label key={ch.id} className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${selectedChapterId === ch.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-purple-300'}`}>
                          <input
                            type="radio"
                            name="destination"
                            checked={selectedChapterId === ch.id}
                            onChange={() => setSelectedChapterId(ch.id)}
                            className="w-4 h-4 text-purple-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-700 dark:text-slate-200 truncate">{ch.title}</p>
                          </div>
                        </label>
                      ))}
                    </>
                  )}

                  <label className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${selectedChapterId === '' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-purple-300'}`}>
                    <input
                      type="radio"
                      name="destination"
                      checked={selectedChapterId === ''}
                      onChange={() => setSelectedChapterId('')}
                      className="w-4 h-4 text-purple-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-slate-700 dark:text-slate-200">Quick Notes (No Chapter)</p>
                      <p className="text-xs text-slate-500">Add to general notes</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    Import Notes
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-purple-500 mb-4" />
              <p className="text-slate-600 dark:text-slate-300 font-medium">Extracting and importing...</p>
              <p className="text-sm text-slate-500 mt-1">This may take a moment</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportNotesModal;