
import React, { useState, type FC, type ChangeEvent } from 'react';
import { Course, Chapter, Subchapter } from '../types';
import { PdfViewer } from './PdfViewer';

interface Props {
  course: Course;
  onSave: (updatedCourse: Course, file?: File | Blob) => void;
  onCancel: () => void;
  onToast?: (msg: string, type?: 'success'|'error'|'info') => void;
}

const OPENSTAX_BOOKS = [
  { title: "Biology 2e", id: "bio2e", url: "https://assets.openstax.org/oscms-cprod/media/documents/Biology2e-WEB_3iX053o.pdf" },
  { title: "Chemistry 2e", id: "chem2e", url: "https://assets.openstax.org/oscms-cprod/media/documents/Chemistry2e-WEB_1.pdf" },
  { title: "Psychology 2e", id: "psych2e", url: "https://assets.openstax.org/oscms-cprod/media/documents/Psychology2e-WEB.pdf" },
  { title: "U.S. History", id: "ushist", url: "https://assets.openstax.org/oscms-cprod/media/documents/USHistory-WEB.pdf" },
  { title: "Calculus Vol 1", id: "calc1", url: "https://assets.openstax.org/oscms-cprod/media/documents/CalculusVolume1-WEB_9sX1XjV.pdf" }
];

const uuid = () => Math.random().toString(36).substring(2, 9);

export const ChapterWizard: FC<Props> = ({ course, onSave, onCancel, onToast }) => {
  const [step, setStep] = useState(course.pdfUrl ? 2 : 1);
  const [pdfFile, setPdfFile] = useState<File | Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>(course.pdfUrl || '');
  const [pdfName, setPdfName] = useState(course.pdfName || '');
  const [chapters, setChapters] = useState<Chapter[]>(course.chapters);
  const [isLoading, setIsLoading] = useState(false);

  // Helper: Deep copy to avoid mutation issues
  const updateChapters = (fn: (prev: Chapter[]) => Chapter[]) => {
    setChapters(prev => fn(JSON.parse(JSON.stringify(prev))));
  };

  const handleOpenStaxSelect = async (book: typeof OPENSTAX_BOOKS[0]) => {
    if(!confirm(`Download ${book.title}? This may take 10-20 seconds depending on connection.`)) return;
    setIsLoading(true);
    try {
      const resp = await fetch(book.url);
      if (!resp.ok) throw new Error("Network response was not ok");
      const blob = await resp.blob();
      setPdfFile(blob);
      setPdfName(`${book.title} (OpenStax)`);
      setPdfUrl(URL.createObjectURL(blob));
      setStep(2);
    } catch (e) {
      alert("Failed to download PDF. Browser security might block this request. Please download the PDF manually from OpenStax.org and upload it here.");
    } finally {
      setIsLoading(false);
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

  const addSubchapter = (chapterIndex: number) => {
    updateChapters(prev => {
      const parent = prev[chapterIndex];
      if (!parent.subchapters) parent.subchapters = [];
      parent.subchapters.push({
        id: uuid(),
        title: '',
        startPage: parent.startPage || 0,
        endPage: parent.endPage || 0
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

  const handleAutoDetectPlaceholder = () => {
    if (onToast) onToast("Coming soon – advanced TOC detection", "info");
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
                  <p className="text-slate-500 mt-2">Drag & drop or click to browse local files</p>
               </div>

               {/* OpenStax Grid */}
               <div>
                 <h4 className="font-bold text-slate-700 mb-4 flex items-center"><i className="fas fa-globe-americas mr-2 text-slate-400"></i>OpenStax Library (Free)</h4>
                 {isLoading ? (
                   <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100">
                     <i className="fas fa-circle-notch fa-spin text-3xl text-primary mb-3"></i>
                     <p className="text-slate-600 font-medium">Downloading Textbook...</p>
                     <p className="text-xs text-slate-400 mt-1">This happens once. We'll save it locally.</p>
                   </div>
                 ) : (
                   <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                     {OPENSTAX_BOOKS.map(book => (
                       <button key={book.id} onClick={() => handleOpenStaxSelect(book)} className="p-4 border border-slate-200 rounded-xl hover:border-primary hover:shadow-md transition-all text-left group bg-white flex flex-col items-center text-center h-full">
                         <div className="w-full aspect-[3/4] bg-slate-100 rounded mb-3 flex items-center justify-center group-hover:bg-blue-50 relative overflow-hidden">
                            <i className="fas fa-book text-slate-300 group-hover:text-blue-300 text-4xl"></i>
                            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <i className="fas fa-download text-slate-600"></i>
                            </div>
                         </div>
                         <div className="font-bold text-sm text-slate-800 line-clamp-2">{book.title}</div>
                         <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide">OpenStax</div>
                       </button>
                     ))}
                   </div>
                 )}
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
               <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
                 <div>
                   <h3 className="font-bold text-slate-800">Map Chapters</h3>
                   <p className="text-xs text-slate-500">Break down large chapters into sections for faster AI generation.</p>
                 </div>
                 <div className="flex gap-2">
                   <button 
                      onClick={handleAutoDetectPlaceholder}
                      className="text-xs bg-slate-100 text-slate-500 border border-slate-200 px-3 py-2 rounded font-bold flex items-center shadow-sm transition-all cursor-not-allowed opacity-80 hover:bg-slate-200"
                    >
                       <i className="fas fa-magic mr-2 text-slate-400"></i> Auto-Detect
                   </button>
                   <button onClick={() => updateChapters(p => [...p, { id: uuid(), title: '', startPage: 0, endPage: 0 }])} className="text-xs bg-primary text-white px-3 py-2 rounded hover:bg-blue-600 shadow-sm font-bold">
                     <i className="fas fa-plus mr-1"></i> Add Chapter
                   </button>
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
                   <div key={ch.id} className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm hover:border-blue-300 transition-all group relative">
                      {ch.isSuggested && (
                          <div className="absolute top-0 right-0 transform translate-x-1/3 -translate-y-1/3 z-10">
                              <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                                  <i className="fas fa-robot text-[8px]"></i> Suggested
                              </span>
                          </div>
                      )}

                      {/* Parent Chapter Row */}
                      <div className="flex justify-between mb-3 items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">{idx + 1}</span>
                          Chapter
                        </span>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => addSubchapter(idx)}
                                className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                                type="button"
                            >
                                <i className="fas fa-indent mr-1"></i> Add Topic / Section
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

                      {/* Subchapters List */}
                      {ch.subchapters && ch.subchapters.length > 0 && (
                          <div className="pl-4 border-l-2 border-slate-200 space-y-3 mt-4">
                              {ch.subchapters.map((sub, sIdx) => (
                                  <div key={sub.id} className="relative">
                                      <div className="flex items-center gap-2 mb-1">
                                          <span className="text-[10px] font-bold text-slate-400 uppercase">Section {idx+1}.{sIdx+1}</span>
                                          <button onClick={() => deleteSubchapter(idx, sIdx)} className="text-slate-300 hover:text-red-400 text-xs ml-auto" type="button"><i className="fas fa-times"></i></button>
                                      </div>
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
             onClick={() => onSave({ ...course, pdfName, chapters }, pdfFile || undefined)} 
             disabled={step === 1 && !pdfFile}
             className="px-6 py-2 bg-primary text-white rounded-lg font-bold disabled:opacity-50 shadow-md hover:shadow-lg hover:bg-blue-600 transition-all transform active:scale-95"
           >
             {step === 1 ? 'Next: Map Chapters' : 'Save & Close'}
           </button>
         </div>
      </div>
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
