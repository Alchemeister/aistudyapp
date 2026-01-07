
import React, { useState, type FC, type ChangeEvent } from 'react';
import { Course, Chapter, Subchapter } from '../types';
import { PdfViewer } from './PdfViewer';
import { loadPdfDocument, extractTOCText } from '../services/pdfUtils';
import { parseTableOfContents } from '../services/geminiService';
import { BookSearchModal } from './BookSearchModal';

interface Props {
  course: Course;
  onSave: (updatedCourse: Course, file?: File | Blob) => void;
  onCancel: () => void;
  onToast?: (msg: string, type?: 'success'|'error'|'info') => void;
}

const OPENSTAX_BOOKS = [
  { title: "Biology 2e", id: "biology-2e" },
  { title: "Chemistry 2e", id: "chemistry-2e" },
  { title: "Psychology 2e", id: "psychology-2e" },
  { title: "U.S. History", id: "us-history" },
  { title: "Calculus Vol 1", id: "calculus-volume-1" },
  { title: "College Physics", id: "college-physics-2e" },
  { title: "Anatomy & Physiology", id: "anatomy-and-physiology-2e" }
];

const uuid = () => Math.random().toString(36).substring(2, 9);

export const ChapterWizard: FC<Props> = ({ course, onSave, onCancel, onToast }) => {
  const [step, setStep] = useState(course.pdfUrl ? 2 : 1);
  const [pdfFile, setPdfFile] = useState<File | Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>(course.pdfUrl || '');
  const [pdfName, setPdfName] = useState(course.pdfName || '');
  const [chapters, setChapters] = useState<Chapter[]>(course.chapters);
  const [tocDetecting, setTocDetecting] = useState(false);
  const [tocStatus, setTocStatus] = useState('');
  const [tocStartPage, setTocStartPage] = useState<number>(1);
  const [tocEndPage, setTocEndPage] = useState<number>(30);
  const [showTocOptions, setShowTocOptions] = useState(false);
  const [showBookSearch, setShowBookSearch] = useState(false);

  // Helper: Deep copy to avoid mutation issues
  const updateChapters = (fn: (prev: Chapter[]) => Chapter[]) => {
    setChapters(prev => fn(JSON.parse(JSON.stringify(prev))));
  };

  const handleOpenStaxSelect = (book: typeof OPENSTAX_BOOKS[0]) => {
    // OpenStax blocks direct downloads due to CORS - open in new tab for manual download
    const confirmed = confirm(
      `Opening "${book.title}" on OpenStax.org\n\n` +
      `1. Click "Download" on their page\n` +
      `2. Save the PDF to your device\n` +
      `3. Come back here and upload it\n\n` +
      `Continue?`
    );
    if (confirmed) {
      window.open(`https://openstax.org/details/books/${book.id}`, '_blank');
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPdfFile(file);
      setPdfName(file.name);
      setPdfUrl(URL.createObjectURL(file));
      setStep(2);
    }
  };

  const updateChapter = (index: number, field: keyof Chapter, value: any) => {
    updateChapters(prev => {
      (prev[index] as any)[field] = value;
      if (prev[index].isSuggested) prev[index].isSuggested = false;
      return prev;
    });
  };

  const addSubchapter = (chapterIndex: number, notesOnly: boolean = false) => {
    updateChapters(prev => {
      const parent = prev[chapterIndex];
      if (!parent.subchapters) parent.subchapters = [];
      parent.subchapters.push({
        id: uuid(),
        title: '',
        startPage: notesOnly ? undefined : (parent.startPage || 0),
        endPage: notesOnly ? undefined : (parent.endPage || 0),
        isNotesOnly: notesOnly,
        notes: notesOnly ? '' : undefined
      });
      return prev;
    });
  };

  const updateSubchapter = (chapterIndex: number, subIndex: number, field: keyof Subchapter, value: any) => {
    updateChapters(prev => {
      if (prev[chapterIndex].subchapters) {
         (prev[chapterIndex].subchapters![subIndex] as any)[field] = value;
      }
      return prev;
    });
  };

  const deleteSubchapter = (chapterIndex: number, subIndex: number) => {
    updateChapters(prev => {
      if (prev[chapterIndex].subchapters) {
        prev[chapterIndex].subchapters!.splice(subIndex, 1);
      }
      return prev;
    });
  };

  const handleAutoDetect = async () => {
    if (!pdfUrl) {
      if (onToast) onToast("Please upload a PDF first", "error");
      return;
    }

    setTocDetecting(true);
    setTocStatus("Loading PDF...");

    try {
      // Load the PDF document
      const pdf = await loadPdfDocument(pdfUrl);

      // Extract text from specified page range
      const pageRangeText = tocStartPage === 1 && tocEndPage === 30
        ? "first 30 pages"
        : `pages ${tocStartPage}-${tocEndPage}`;
      setTocStatus(`Reading ${pageRangeText}...`);
      const tocText = await extractTOCText(pdf, tocStartPage, tocEndPage, (curr, tot) => {
        setTocStatus(`Reading page ${curr} of ${tot}...`);
      });

      if (tocText.length < 200) {
        if (onToast) onToast(`Not enough text found in pages ${tocStartPage}-${tocEndPage}`, "error");
        setTocDetecting(false);
        setTocStatus('');
        return;
      }

      // Send to AI for TOC parsing
      setTocStatus("AI analyzing structure...");
      const tocEntries = await parseTableOfContents(tocText);

      if (tocEntries.length === 0) {
        if (onToast) onToast("Could not detect chapters. Try adding manually.", "info");
        setTocDetecting(false);
        setTocStatus('');
        return;
      }

      // Convert TOC entries to Chapter[] format
      const detectedChapters: Chapter[] = tocEntries.map((entry, idx) => {
        // Calculate end page (next chapter's start - 1, or use start + 20 as estimate)
        const nextEntry = tocEntries[idx + 1];
        const endPage = nextEntry ? nextEntry.start_page - 1 : entry.start_page + 20;

        // Convert children to subchapters
        const subchapters: Subchapter[] = (entry.children || []).map((child, sIdx) => {
          const nextChild = entry.children?.[sIdx + 1];
          const subEndPage = nextChild ? nextChild.start_page - 1 : endPage;

          return {
            id: uuid(),
            title: child.title,
            startPage: child.start_page,
            endPage: Math.min(subEndPage, endPage),
          };
        });

        return {
          id: uuid(),
          title: entry.title,
          startPage: entry.start_page,
          endPage: Math.max(entry.start_page, endPage),
          isSuggested: true,
          subchapters: subchapters.length > 0 ? subchapters : undefined,
        };
      });

      // Set chapters (replace existing)
      setChapters(detectedChapters);
      if (onToast) onToast(`Detected ${detectedChapters.length} chapters! Review and adjust page numbers.`, "success");

    } catch (e: any) {
      console.error("TOC Detection Error:", e);
      if (onToast) onToast(e.message || "Failed to detect TOC", "error");
    } finally {
      setTocDetecting(false);
      setTocStatus('');
    }
  };

  return (
    <div className="flex flex-col h-[80vh]">
      {/* Header Stepper */}
      <div className="flex items-center justify-center py-4 border-b border-slate-100 flex-shrink-0">
        <StepIndicator num={1} active={step === 1} done={step > 1} label="Upload PDF" />
        <div className="w-12 h-0.5 bg-slate-200 mx-2"></div>
        <StepIndicator num={2} active={step === 2} done={false} label="Map Chapters" />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {step === 1 && (
          <div className="p-8 h-full overflow-y-auto">
             <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
               {/* Upload Box */}
               <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:bg-slate-50 transition-colors relative group">
                  <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileUpload} />
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-100 transition-colors">
                    <i className="fas fa-cloud-upload-alt text-4xl text-primary"></i>
                  </div>
                  <h3 className="text-xl font-bold text-slate-700">Upload Textbook PDF</h3>
                  <p className="text-slate-500 mt-2">Drag & drop or click to browse</p>
               </div>

               <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                 <i className="fas fa-lightbulb text-amber-500 mt-0.5"></i>
                 <div>
                   <p className="text-sm font-medium text-amber-800">No PDF? Use Import Notes instead!</p>
                   <p className="text-xs text-amber-600 mt-1">Close this and click "Import" to add your lecture notes directly.</p>
                 </div>
               </div>

               {/* Search Free Books */}
               <div>
                 <h4 className="font-bold text-slate-700 mb-4 flex items-center"><i className="fas fa-search mr-2 text-slate-400"></i>Search Free Textbooks</h4>
                 <button
                   onClick={() => setShowBookSearch(true)}
                   className="w-full p-6 border border-slate-200 rounded-xl hover:border-primary hover:shadow-md transition-all bg-gradient-to-r from-blue-50 to-purple-50 text-center group"
                 >
                   <i className="fas fa-book-open text-3xl text-primary mb-3"></i>
                   <p className="font-bold text-slate-700">Search by Title or ISBN</p>
                   <p className="text-xs text-slate-500 mt-1">Find free textbooks from Open Library & Internet Archive</p>
                 </button>
               </div>

               {/* OpenStax Grid */}
               <div>
                 <h4 className="font-bold text-slate-700 mb-4 flex items-center"><i className="fas fa-globe-americas mr-2 text-slate-400"></i>OpenStax Library (Free)</h4>
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                   {OPENSTAX_BOOKS.map(book => (
                     <button key={book.id} onClick={() => handleOpenStaxSelect(book)} className="p-4 border border-slate-200 rounded-xl hover:border-primary hover:shadow-md transition-all text-left group bg-white flex flex-col items-center text-center h-full">
                       <div className="w-full aspect-[3/4] bg-slate-100 rounded mb-3 flex items-center justify-center group-hover:bg-blue-50 relative overflow-hidden">
                          <i className="fas fa-book text-slate-300 group-hover:text-blue-300 text-4xl"></i>
                          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <i className="fas fa-external-link-alt text-slate-600"></i>
                          </div>
                       </div>
                       <div className="font-bold text-sm text-slate-800 line-clamp-2">{book.title}</div>
                       <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide">OpenStax</div>
                     </button>
                   ))}
                 </div>
                 <p className="text-xs text-slate-400 text-center mt-3">Click to open on OpenStax.org, then download and upload here</p>
               </div>
             </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex h-full flex-col md:flex-row">
            {/* Left: PDF Viewer */}
            <div className="w-full md:w-1/2 h-1/2 md:h-full bg-slate-800 border-b md:border-b-0 md:border-r border-slate-200">
               <PdfViewer url={pdfUrl} />
            </div>

            {/* Right: Chapter Form */}
            <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col bg-white">
               <div className="p-4 bg-slate-50 border-b border-slate-200 shadow-sm z-10">
                 <div className="flex justify-between items-center">
                   <div>
                     <h3 className="font-bold text-slate-800">Map Chapters</h3>
                     <p className="text-xs text-slate-500">Break down large chapters into sections for faster AI generation.</p>
                   </div>
                   <div className="flex gap-2">
                     <button
                        onClick={handleAutoDetect}
                        disabled={tocDetecting}
                        className={`text-xs px-3 py-2 rounded font-bold flex items-center shadow-sm transition-all ${
                          tocDetecting
                            ? 'bg-purple-100 text-purple-600 border border-purple-200 cursor-wait'
                            : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600'
                        }`}
                      >
                         {tocDetecting ? (
                           <>
                             <i className="fas fa-circle-notch fa-spin mr-2"></i>
                             {tocStatus || 'Detecting...'}
                           </>
                         ) : (
                           <>
                             <i className="fas fa-magic mr-2"></i> Auto-Detect
                           </>
                         )}
                     </button>
                     <button onClick={() => updateChapters(p => [...p, { id: uuid(), title: '', startPage: 0, endPage: 0 }])} className="text-xs bg-primary text-white px-3 py-2 rounded hover:bg-blue-600 shadow-sm font-bold">
                       <i className="fas fa-plus mr-1"></i> Add Chapter
                     </button>
                   </div>
                 </div>

                 {/* TOC Page Range Options */}
                 <div className="mt-3 pt-3 border-t border-slate-200">
                   <button
                     onClick={() => setShowTocOptions(!showTocOptions)}
                     className="text-xs text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1"
                     type="button"
                   >
                     <i className={`fas fa-chevron-${showTocOptions ? 'up' : 'down'} text-[10px]`}></i>
                     TOC Page Range
                     <span className="text-slate-400 ml-1">(pages {tocStartPage}-{tocEndPage})</span>
                   </button>
                   {showTocOptions && (
                     <div className="mt-2 flex items-center gap-3 animate-fade-in">
                       <div className="flex items-center gap-2">
                         <label className="text-[10px] font-bold text-slate-400 uppercase">From Page</label>
                         <input
                           type="number"
                           min={1}
                           value={tocStartPage}
                           onChange={(e) => setTocStartPage(Math.max(1, parseInt(e.target.value) || 1))}
                           className="w-16 p-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-primary outline-none"
                         />
                       </div>
                       <div className="flex items-center gap-2">
                         <label className="text-[10px] font-bold text-slate-400 uppercase">To Page</label>
                         <input
                           type="number"
                           min={tocStartPage}
                           value={tocEndPage}
                           onChange={(e) => setTocEndPage(Math.max(tocStartPage, parseInt(e.target.value) || tocStartPage))}
                           className="w-16 p-1.5 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-primary outline-none"
                         />
                       </div>
                       <p className="text-[10px] text-slate-400 italic">Specify where the Table of Contents is located</p>
                     </div>
                   )}
                 </div>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                 {chapters.length === 0 && (
                   <div className="text-center text-slate-400 mt-10 p-6 border-2 border-dashed border-slate-200 rounded-xl">
                     <i className="fas fa-list-ol text-2xl mb-2"></i>
                     <p>No chapters defined.</p>
                   </div>
                 )}
                 {chapters.map((ch, idx) => (
                   <div key={ch.id} className={`p-4 border rounded-lg shadow-sm transition-all group relative ${ch.isNotesOnly ? 'border-amber-300 bg-amber-50/30 hover:border-amber-400' : 'border-slate-200 bg-white hover:border-blue-300'}`}>
                      {ch.isSuggested && (
                          <div className="absolute top-0 right-0 transform translate-x-1/3 -translate-y-1/3 z-10">
                              <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                                  <i className="fas fa-robot text-[8px]"></i> Suggested
                              </span>
                          </div>
                      )}
                      {ch.isNotesOnly && !ch.isSuggested && (
                          <div className="absolute top-0 right-0 transform translate-x-1/3 -translate-y-1/3 z-10">
                              <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                                  <i className="fas fa-sticky-note text-[8px]"></i> Notes Only
                              </span>
                          </div>
                      )}

                      {/* Parent Chapter Row */}
                      <div className="flex justify-between mb-3 items-center">
                        <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${ch.isNotesOnly ? 'text-amber-600' : 'text-slate-400'}`}>
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center ${ch.isNotesOnly ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>{idx + 1}</span>
                          {ch.isNotesOnly ? 'Notes Chapter' : 'Chapter'}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => addSubchapter(idx, false)}
                                className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                                type="button"
                                title="Add section with PDF page range"
                            >
                                <i className="fas fa-plus mr-1"></i> Add Section
                            </button>
                            <button 
                              onClick={() => setChapters(chapters.filter((_, i) => i !== idx))} 
                              className="text-slate-300 hover:text-red-500 transition-colors p-1"
                              type="button"
                            >
                              <i className="fas fa-trash-alt"></i>
                            </button>
                        </div>
                      </div>
                      
                      {ch.isNotesOnly ? (
                        <div className="space-y-3 mb-3">
                          <div>
                            <label className="text-[10px] uppercase font-bold text-amber-600 mb-1 block">Chapter Title</label>
                            <input
                              className="w-full p-2 border border-amber-300 rounded text-sm focus:ring-1 focus:ring-amber-400 outline-none bg-white text-slate-900"
                              placeholder="e.g. Unit 3: Cellular Respiration"
                              value={ch.title}
                              onChange={(e) => updateChapter(idx, 'title', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-bold text-amber-600 mb-1 block">Chapter Notes (optional - or add sections below)</label>
                            <div className="flex gap-2 mb-2">
                              <label className="flex-1 flex items-center justify-center gap-2 p-3 border border-dashed border-amber-300 rounded bg-amber-50/50 hover:bg-amber-100 cursor-pointer transition-colors text-sm font-bold text-amber-600">
                                <i className="fas fa-upload"></i>
                                <span>Upload .txt / .md file</span>
                                <input
                                  type="file"
                                  accept=".txt,.md,.text"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const text = await file.text();
                                      updateChapter(idx, 'notes', text);
                                      if (!ch.title) {
                                        updateChapter(idx, 'title', file.name.replace(/\.(txt|md|text)$/i, ''));
                                      }
                                    }
                                  }}
                                />
                              </label>
                              {ch.notes && (
                                <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded text-sm font-bold text-green-600">
                                  <i className="fas fa-check-circle"></i>
                                  {ch.notes.split(/\s+/).length} words
                                </div>
                              )}
                            </div>
                            {ch.notes && (
                              <details className="group">
                                <summary className="text-xs text-amber-600 cursor-pointer hover:text-amber-700 font-medium">
                                  <i className="fas fa-eye mr-1"></i> Preview / Edit notes
                                </summary>
                                <textarea
                                  className="w-full p-2 border border-amber-300 rounded text-sm focus:ring-1 focus:ring-amber-400 outline-none bg-white text-slate-900 resize-none mt-2"
                                  rows={5}
                                  value={ch.notes || ''}
                                  onChange={(e) => updateChapter(idx, 'notes', e.target.value)}
                                />
                              </details>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-12 gap-3 mb-3">
                          <div className="col-span-8">
                            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Title</label>
                            <input
                              className="w-full p-2 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-primary outline-none bg-white text-slate-900"
                              placeholder="Chapter Title"
                              value={ch.title}
                              onChange={(e) => updateChapter(idx, 'title', e.target.value)}
                            />
                          </div>
                          <div className="col-span-2">
                              <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Start</label>
                              <input type="number" className="w-full p-2 border border-slate-300 rounded text-sm outline-none bg-white text-slate-900" value={ch.startPage || ''} onChange={(e) => updateChapter(idx, 'startPage', parseInt(e.target.value))} />
                          </div>
                          <div className="col-span-2">
                              <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">End</label>
                              <input type="number" className="w-full p-2 border border-slate-300 rounded text-sm outline-none bg-white text-slate-900" value={ch.endPage || ''} onChange={(e) => updateChapter(idx, 'endPage', parseInt(e.target.value))} />
                          </div>
                        </div>
                      )}

                      {/* Subchapters List */}
                      {ch.subchapters && ch.subchapters.length > 0 && (
                          <div className="pl-4 border-l-2 border-slate-200 space-y-3 mt-4">
                              {ch.subchapters.map((sub, sIdx) => (
                                  <div key={sub.id} className={`relative p-3 rounded-lg ${sub.isNotesOnly ? 'bg-amber-50/50 border border-amber-200' : 'bg-slate-50'}`}>
                                      <div className="flex items-center gap-2 mb-2">
                                          <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${sub.isNotesOnly ? 'text-amber-600' : 'text-slate-400'}`}>
                                            {sub.isNotesOnly ? <i className="fas fa-sticky-note"></i> : <i className="fas fa-file-pdf"></i>}
                                            Section {idx+1}.{sIdx+1}
                                            {sub.isNotesOnly && <span className="bg-amber-200 text-amber-700 px-1.5 rounded text-[8px] ml-1">NOTES</span>}
                                          </span>
                                          <button onClick={() => deleteSubchapter(idx, sIdx)} className="text-slate-300 hover:text-red-400 text-xs ml-auto" type="button"><i className="fas fa-times"></i></button>
                                      </div>

                                      {sub.isNotesOnly ? (
                                        <>
                                          <input
                                            className="w-full p-2 border border-amber-200 rounded text-sm bg-white text-slate-900 focus:ring-1 focus:ring-amber-300 outline-none mb-2"
                                            placeholder="Section Title (e.g. Monday - Glycolysis)"
                                            value={sub.title}
                                            onChange={(e) => updateSubchapter(idx, sIdx, 'title', e.target.value)}
                                          />
                                          <div className="flex gap-2 mb-2">
                                            <label className="flex-1 flex items-center justify-center gap-2 p-2 border border-dashed border-amber-300 rounded bg-amber-50/50 hover:bg-amber-100 cursor-pointer transition-colors text-xs font-bold text-amber-600">
                                              <i className="fas fa-upload"></i>
                                              <span>Upload .txt / .md</span>
                                              <input
                                                type="file"
                                                accept=".txt,.md,.text"
                                                className="hidden"
                                                onChange={async (e) => {
                                                  const file = e.target.files?.[0];
                                                  if (file) {
                                                    const text = await file.text();
                                                    updateSubchapter(idx, sIdx, 'notes', text);
                                                    if (!sub.title) {
                                                      updateSubchapter(idx, sIdx, 'title', file.name.replace(/\.(txt|md|text)$/i, ''));
                                                    }
                                                  }
                                                }}
                                              />
                                            </label>
                                            {sub.notes && (
                                              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded text-xs font-bold text-green-600">
                                                <i className="fas fa-check-circle"></i>
                                                {sub.notes.split(/\s+/).length} words
                                              </div>
                                            )}
                                          </div>
                                          {sub.notes && (
                                            <details className="group">
                                              <summary className="text-[10px] text-amber-600 cursor-pointer hover:text-amber-700 font-medium">
                                                <i className="fas fa-eye mr-1"></i> Preview / Edit notes
                                              </summary>
                                              <textarea
                                                className="w-full p-2 border border-amber-200 rounded text-xs bg-white text-slate-900 focus:ring-1 focus:ring-amber-300 outline-none resize-none mt-2"
                                                placeholder="Notes content..."
                                                rows={4}
                                                value={sub.notes || ''}
                                                onChange={(e) => updateSubchapter(idx, sIdx, 'notes', e.target.value)}
                                              />
                                            </details>
                                          )}
                                          {!sub.notes && (
                                            <p className="text-[10px] text-slate-400 italic">Or paste notes below:</p>
                                          )}
                                          {!sub.notes && (
                                            <textarea
                                              className="w-full p-2 border border-amber-200 rounded text-xs bg-white text-slate-900 focus:ring-1 focus:ring-amber-300 outline-none resize-none"
                                              placeholder="Paste your lecture notes here..."
                                              rows={3}
                                              value={sub.notes || ''}
                                              onChange={(e) => updateSubchapter(idx, sIdx, 'notes', e.target.value)}
                                            />
                                          )}
                                        </>
                                      ) : (
                                        <div className="grid grid-cols-12 gap-2">
                                            <div className="col-span-6">
                                                <input
                                                  className="w-full p-1.5 border border-slate-200 rounded text-xs bg-white text-slate-900 focus:ring-1 focus:ring-blue-200 outline-none"
                                                  placeholder="Section Topic (e.g. Mitochondria)"
                                                  value={sub.title}
                                                  onChange={(e) => updateSubchapter(idx, sIdx, 'title', e.target.value)}
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <input type="number" className="w-full p-1.5 border border-slate-200 rounded text-xs bg-white text-slate-900 outline-none" placeholder="Start" value={sub.startPage || ''} onChange={(e) => updateSubchapter(idx, sIdx, 'startPage', parseInt(e.target.value))} />
                                            </div>
                                            <div className="col-span-3">
                                                <input type="number" className="w-full p-1.5 border border-slate-200 rounded text-xs bg-white text-slate-900 outline-none" placeholder="End" value={sub.endPage || ''} onChange={(e) => updateSubchapter(idx, sIdx, 'endPage', parseInt(e.target.value))} />
                                            </div>
                                        </div>
                                      )}
                                  </div>
                              ))}
                          </div>
                      )}
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center flex-shrink-0 z-20">
         <button onClick={onCancel} className="text-slate-500 font-medium hover:text-slate-800">Cancel</button>
         <div className="flex gap-3">
           {step === 2 && <button onClick={() => setStep(1)} className="px-4 py-2 border border-slate-300 rounded text-slate-600 font-medium">Back</button>}
           <button
             onClick={() => step === 1 ? setStep(2) : onSave({ ...course, pdfName, chapters }, pdfFile || undefined)}
             className="px-6 py-2 bg-primary text-white rounded-lg font-bold shadow-md hover:shadow-lg hover:bg-blue-600 transition-all transform active:scale-95"
           >
             {step === 1 ? 'Next: Map Chapters' : 'Save & Close'}
           </button>
         </div>
      </div>

      {/* Book Search Modal */}
      <BookSearchModal
        isOpen={showBookSearch}
        onClose={() => setShowBookSearch(false)}
        onSelect={(url, title) => {
          window.open(url, '_blank');
          setShowBookSearch(false);
        }}
      />
    </div>
  );
};

const StepIndicator = ({ num, active, done, label }: any) => (
  <div className={`flex items-center gap-2 ${active ? 'text-primary' : done ? 'text-green-600' : 'text-slate-400'}`}>
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${active ? 'bg-primary text-white shadow-md' : done ? 'bg-green-600 text-white' : 'bg-slate-200'}`}>
      {done ? <i className="fas fa-check"></i> : num}
    </div>
    <span className={`text-sm font-bold ${active ? 'text-slate-800' : ''}`}>{label}</span>
  </div>
);
