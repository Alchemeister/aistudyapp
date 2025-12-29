import React, { useState, useContext } from 'react';
import { Course, Flashcard, Lecture } from '../types';
import { PdfViewer } from './PdfViewer';
import { GeneratorPanel } from './GeneratorPanel';
import { LibraryPanel } from '../App';
import { Modal } from './Modal';
import { ChapterWizard } from './ChapterWizard';
import { ImportNotesModal } from './ImportNotesModal';
import { savePdfBlob } from '../services/storage';
import { ToastContext } from '../App';

export const CourseView = ({ courses, onUpdate, onUpdateFlashcard }: { courses: Course[], onUpdate: (c: Course) => void, onUpdateFlashcard: (cid: string, mid: string, c: Flashcard) => void }) => {
  const [activeTab, setActiveTab] = useState<'content' | 'study'>('content');
  const [showWizard, setShowWizard] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const { showToast } = useContext(ToastContext);

  // In a real app, you might use useParams here, but we are passed the filtered list from App for specific course
  // However, App passes *all* courses and expects this component to filter. 
  // Let's assume the parent handles the finding or we grab from URL.
  // For safety with current architecture:
  const urlParts = window.location.hash.split('/');
  const courseId = urlParts[urlParts.length - 1];
  const course = courses.find(c => c.id === courseId);

  if (!course) return <div>Course not found</div>;

  const handleSaveWizard = async (updated: Course, file?: File | Blob) => {
    let newCourse = { ...updated };
    if (file) {
      const blobId = await savePdfBlob(newCourse.id, file);
      newCourse.pdfBlobId = blobId;
      newCourse.pdfUrl = URL.createObjectURL(file);
    }
    onUpdate(newCourse);
    setShowWizard(false);
  };

  const handleImportSave = (note: Partial<Lecture>) => {
    const newLecture = note as Lecture;
    onUpdate({ ...course, lectures: [newLecture, ...course.lectures] });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shrink-0 shadow-sm z-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded">{course.code}</span>
             <h2 className="text-xl font-bold text-slate-900">{course.title}</h2>
          </div>
          <div className="flex gap-4 text-xs text-slate-500 font-medium">
             <span><i className="fas fa-book mr-1"></i> {course.chapters.length} Chapters</span>
             <span><i className="fas fa-file-alt mr-1"></i> {course.lectures.length} Notes</span>
             <span><i className="fas fa-clipboard-list mr-1"></i> {course.materials.length} Materials</span>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          
          <button 
            onClick={() => setShowImport(true)}
            className="px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-sm"
          >
             <i className="fas fa-file-import mr-2 text-slate-500"></i>Import Notes
          </button>
          
          <div className="w-px h-8 bg-slate-200 mx-1"></div>

          <button onClick={() => setShowWizard(true)} className="px-4 py-2 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200">
            <i className="fas fa-edit mr-2"></i>Add Chapter / Edit Textbook
          </button>
        </div>
      </header>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
         {/* Left: PDF Viewer (Fixed in Content Mode) */}
         {activeTab === 'content' && (
           <div className="w-full md:w-1/2 h-full bg-slate-800 border-r border-slate-200 relative">
             <PdfViewer url={course.pdfUrl || ''} />
             {!course.pdfUrl && (
               <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-800 z-10">
                  <i className="fas fa-file-pdf text-4xl mb-4 opacity-50"></i>
                  <p>No Textbook Uploaded</p>
                  <button onClick={() => setShowWizard(true)} className="mt-4 text-blue-400 hover:underline">Upload PDF</button>
               </div>
             )}
           </div>
         )}

         {/* Right: Study/Gen Area */}
         <div className={`w-full ${activeTab === 'content' ? 'md:w-1/2' : 'md:w-full'} h-full overflow-y-auto bg-slate-50 p-6`}>
            {/* Tabs inside right panel if content mode, or top if study mode */}
            <div className="flex gap-2 mb-6 border-b border-slate-200 pb-2">
              <button onClick={() => setActiveTab('content')} className={`px-4 py-2 text-sm font-bold rounded transition-colors ${activeTab === 'content' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-white'}`}>Generator</button>
              <button onClick={() => setActiveTab('study')} className={`px-4 py-2 text-sm font-bold rounded transition-colors ${activeTab === 'study' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-white'}`}>Study & Stats</button>
            </div>

            {activeTab === 'content' ? (
              <GeneratorPanel course={course} onUpdate={onUpdate} />
            ) : (
              <LibraryPanel course={course} onUpdate={onUpdate} onUpdateFlashcard={onUpdateFlashcard} />
            )}
         </div>
      </div>

      <Modal isOpen={showWizard} onClose={() => setShowWizard(false)} title="Manage Course Content" maxWidth="max-w-6xl">
        <ChapterWizard course={course} onCancel={() => setShowWizard(false)} onSave={handleSaveWizard} onToast={showToast} />
      </Modal>

      <ImportNotesModal 
        isOpen={showImport} 
        onClose={() => setShowImport(false)} 
        onSave={handleImportSave} 
        onToast={showToast} 
      />
    </div>
  );
};