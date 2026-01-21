import React, { useState, type FC, type ChangeEvent } from 'react';
import { X, FileText, CloudUpload, PlusCircle, Layers, StickyNote, Info, Plus, Loader2 } from 'lucide-react';
import { loadPdfDocument, extractAllText } from '../services/pdfUtils';
import { Lecture, Course, Chapter } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: Partial<Lecture>) => void;
  onSaveToChapter: (chapterId: string, subchapterId: string | null, notes: string, title: string) => void;
  onCreateNotesChapter: (title: string, notes: string, sectionTitle?: string) => void;
  onCreateSubchapter: (chapterId: string, sectionTitle: string, notes: string) => void;
  onToast: (msg: string, type: 'success'|'error'|'info') => void;
  course: Course;
}

const uuid = () => Math.random().toString(36).substring(2, 9);

type TargetType = 'new_chapter' | 'existing' | 'standalone';

export const ImportNotesModal: FC<Props> = ({ isOpen, onClose, onSave, onSaveToChapter, onCreateNotesChapter, onCreateSubchapter, onToast, course }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('new_chapter');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [selectedSubchapterId, setSelectedSubchapterId] = useState<string>('');
  const [createNewSection, setCreateNewSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  // For new chapter with section flow
  const [addAsSection, setAddAsSection] = useState(true); // Default to creating section
  const [sectionTitle, setSectionTitle] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      setTitle(f.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const extractDocxText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const text = new TextDecoder().decode(uint8Array);
    const matches = text.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
    const extractedText = matches
      .map(m => m.replace(/<[^>]+>/g, ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (extractedText.length > 50) {
      return extractedText;
    }
    const readable = text.replace(/<[^>]+>/g, ' ').replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ').trim();
    return readable.substring(0, 50000);
  };

  const extractContent = async (file: File): Promise<string> => {
    const fileName = file.name.toLowerCase();

    if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
      const fileUrl = URL.createObjectURL(file);
      const doc = await loadPdfDocument(fileUrl);
      const content = await extractAllText(doc);
      URL.revokeObjectURL(fileUrl);
      return content;
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
      return await extractDocxText(file);
    } else if (fileName.endsWith('.rtf')) {
      const raw = await file.text();
      return raw.replace(/\{\\[^{}]+\}|\\[a-z]+\d*\s?/gi, '').replace(/[{}]/g, '').trim();
    } else {
      return await file.text();
    }
  };

  const processFile = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const content = await extractContent(file);

      if (targetType === 'new_chapter') {
        // Pass section title if user wants notes as a section within the new chapter
        const secTitle = addAsSection && sectionTitle.trim() ? sectionTitle.trim() : undefined;
        onCreateNotesChapter(title || "Imported Notes", content, secTitle);
        onToast(secTitle ? "Chapter with section created!" : "Notes chapter created!", "success");
      } else if (targetType === 'existing' && selectedChapterId) {
        if (createNewSection && newSectionTitle.trim()) {
          // Create a new subchapter/section with these notes
          onCreateSubchapter(selectedChapterId, newSectionTitle.trim(), content);
          onToast("New section created with notes!", "success");
        } else {
          onSaveToChapter(selectedChapterId, selectedSubchapterId || null, content, title);
          onToast("Notes added to chapter!", "success");
        }
      } else {
        // Standalone lecture (old behavior)
        const note: Partial<Lecture> = {
          id: uuid(),
          title: title || "Imported Note",
          date: new Date().toISOString(),
          transcript: content,
          sourceType: 'upload',
          fileName: file.name
        };
        onSave(note);
        onToast("Notes imported!", "success");
      }

      onClose();
      setFile(null);
      setTitle('');
      setTargetType('new_chapter');
      setSelectedChapterId('');
      setSelectedSubchapterId('');
      setCreateNewSection(false);
      setNewSectionTitle('');
      setAddAsSection(true);
      setSectionTitle('');
    } catch (e) {
      console.error(e);
      onToast("Failed to parse file.", "error");
    } finally {
      setLoading(false);
    }
  };

  const selectedChapter = course.chapters.find(c => c.id === selectedChapterId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg animate-fade-in-up overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-700">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Import Notes</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Step 1: Upload File */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">1. Upload Notes File</label>
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors relative group cursor-pointer">
              <input
                type="file"
                accept=".txt,.md,.pdf,.docx,.rtf,.doc"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {file ? (
                <div className="text-primary">
                  <FileText className="w-6 h-6 mb-2" />
                  <p className="font-bold text-sm truncate px-4">{file.name}</p>
                  <p className="text-xs text-slate-400 mt-1">Click to replace</p>
                </div>
              ) : (
                <div className="text-slate-400">
                  <CloudUpload className="w-6 h-6 mb-2 group-hover:text-primary transition-colors" />
                  <p className="font-bold text-sm text-slate-600 dark:text-slate-300">Click to Upload</p>
                  <p className="text-xs mt-1">PDF, DOCX, TXT, MD, RTF</p>
                </div>
              )}
            </div>
          </div>

          {file && (
            <>
              {/* Step 2: Where to add */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">2. Where to Add Notes</label>
                <div className="space-y-2">
                  <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${targetType === 'new_chapter' ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/30' : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                    <input
                      type="radio"
                      name="target"
                      checked={targetType === 'new_chapter'}
                      onChange={() => setTargetType('new_chapter')}
                      className="text-amber-500"
                    />
                    <PlusCircle className="w-5 h-5 text-amber-500" />
                    <div>
                      <div className="font-bold text-sm text-slate-700 dark:text-slate-200">Create New Notes Chapter</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Standalone chapter with just your notes</div>
                    </div>
                  </label>

                  {course.chapters.length > 0 && (
                    <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${targetType === 'existing' ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                      <input
                        type="radio"
                        name="target"
                        checked={targetType === 'existing'}
                        onChange={() => setTargetType('existing')}
                        className="text-blue-500"
                      />
                      <Layers className="w-5 h-5 text-blue-500" />
                      <div>
                        <div className="font-bold text-sm text-slate-700 dark:text-slate-200">Add to Existing Chapter</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Attach notes to a PDF chapter/section</div>
                      </div>
                    </label>
                  )}

                  <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${targetType === 'standalone' ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/30' : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                    <input
                      type="radio"
                      name="target"
                      checked={targetType === 'standalone'}
                      onChange={() => setTargetType('standalone')}
                      className="text-purple-500"
                    />
                    <StickyNote className="w-5 h-5 text-purple-500" />
                    <div>
                      <div className="font-bold text-sm text-slate-700 dark:text-slate-200">Standalone Lecture Note</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Add to Notes & Lectures section</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* New Chapter Configuration */}
              {targetType === 'new_chapter' && (
                <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div>
                    <label className="block text-xs font-bold text-amber-600 dark:text-amber-400 uppercase mb-1">Chapter Name</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Week 5, Unit 3, Midterm Review..."
                      className="w-full p-2 border border-amber-300 dark:border-amber-700 rounded text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-amber-400 outline-none"
                    />
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={addAsSection}
                      onChange={(e) => setAddAsSection(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                    />
                    <div>
                      <div className="font-bold text-sm text-slate-700 dark:text-slate-200">Add as section within chapter</div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Creates a subsection for your notes (recommended for lecture notes)</p>
                    </div>
                  </label>

                  {addAsSection && (
                    <div className="ml-7">
                      <label className="block text-xs font-bold text-amber-600 dark:text-amber-400 uppercase mb-1">Section Name</label>
                      <input
                        type="text"
                        value={sectionTitle}
                        onChange={(e) => setSectionTitle(e.target.value)}
                        placeholder="e.g., Monday Lecture, Reading Notes, Lab 3..."
                        className="w-full p-2 border border-amber-300 dark:border-amber-700 rounded text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-amber-400 outline-none"
                      />
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        <Info className="w-3 h-3 mr-1" />
                        Structure: {title || "Chapter"} → {sectionTitle || "Section"} → Your Notes
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Chapter selector for existing */}
              {targetType === 'existing' && course.chapters.length > 0 && (
                <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div>
                    <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Select Chapter</label>
                    <select
                      value={selectedChapterId}
                      onChange={(e) => { setSelectedChapterId(e.target.value); setSelectedSubchapterId(''); }}
                      className="w-full p-2 border border-blue-300 dark:border-blue-700 rounded text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                    >
                      <option value="">-- Select Chapter --</option>
                      {course.chapters.map((ch, idx) => (
                        <option key={ch.id} value={ch.id}>
                          Ch.{idx + 1}: {ch.title} {ch.notes ? '(has notes)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedChapterId && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Section Options</label>

                      {/* Toggle between existing section or create new */}
                      <div className="flex gap-2 mb-2">
                        <button
                          type="button"
                          onClick={() => { setCreateNewSection(false); setNewSectionTitle(''); }}
                          className={`flex-1 px-3 py-2 text-xs font-bold rounded transition-all ${!createNewSection ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-500'}`}
                        >
                          {selectedChapter?.subchapters?.length ? 'Select Existing' : 'Add to Chapter'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setCreateNewSection(true); setSelectedSubchapterId(''); }}
                          className={`flex-1 px-3 py-2 text-xs font-bold rounded transition-all ${createNewSection ? 'bg-green-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-500'}`}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Create New Section
                        </button>
                      </div>

                      {/* Existing section dropdown */}
                      {!createNewSection && selectedChapter?.subchapters && selectedChapter.subchapters.length > 0 && (
                        <select
                          value={selectedSubchapterId}
                          onChange={(e) => setSelectedSubchapterId(e.target.value)}
                          className="w-full p-2 border border-blue-300 dark:border-blue-700 rounded text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                        >
                          <option value="">-- Add to chapter level --</option>
                          {selectedChapter.subchapters.map((sub, sIdx) => (
                            <option key={sub.id} value={sub.id}>
                              {course.chapters.indexOf(selectedChapter) + 1}.{sIdx + 1}: {sub.title} {sub.notes ? '(has notes)' : ''}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* New section title input */}
                      {createNewSection && (
                        <div>
                          <input
                            type="text"
                            value={newSectionTitle}
                            onChange={(e) => setNewSectionTitle(e.target.value)}
                            placeholder="Enter new section title..."
                            className="w-full p-2 border border-green-300 dark:border-green-700 rounded text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-green-400 outline-none"
                          />
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            <Info className="w-3 h-3 mr-1" />
                            This will create a new section within the chapter
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedChapterId && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 p-2 rounded">
                      <Info className="w-3 h-3 mr-1" />
                      Notes will be combined with PDF content when generating.
                    </div>
                  )}
                </div>
              )}

              {/* Title - only for existing/standalone (new_chapter has its own inputs) */}
              {targetType !== 'new_chapter' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                    {targetType === 'existing' ? '3. Note Label (optional)' : '3. Title'}
                  </label>
                  <input
                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded text-sm font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-700 focus:ring-primary outline-none"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={targetType === 'existing' ? "e.g. Monday Lecture" : "Name your notes"}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700 border-t border-slate-100 dark:border-slate-600 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-500 font-medium hover:text-slate-700 dark:hover:text-slate-300">Cancel</button>
          <button
            onClick={processFile}
            disabled={!file || loading || (targetType === 'existing' && !selectedChapterId) || (targetType === 'existing' && createNewSection && !newSectionTitle.trim()) || (targetType === 'new_chapter' && addAsSection && !sectionTitle.trim())}
            className="px-6 py-2 bg-primary text-white rounded-lg font-bold disabled:opacity-50 flex items-center gap-2 hover:bg-blue-600 transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Importing...' : 'Import Notes'}
          </button>
        </div>
      </div>
    </div>
  );
};
