
import React, { useState, useContext, useMemo } from 'react';
import { Course, Flashcard, Lecture } from '../types';
import { PdfViewer } from './PdfViewer';
import { GeneratorPanel } from './GeneratorPanel';
import { LibraryPanel } from '../App';
import { Modal } from './Modal';
import { ChapterWizard } from './ChapterWizard';
import { ImportNotesModal } from './ImportNotesModal';
import { LectureRecorder } from './LectureRecorder';
import { LecturePlayer } from './LecturePlayer';
import { ShareCourseModal } from './ShareCourseModal';
import { savePdfBlob, saveMediaBlob } from '../services/storage';
import { loadPdfDocument, generatePdfThumbnail } from '../services/pdfUtils';
import { ToastContext } from '../App';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

export const CourseView = ({ courses, onUpdate, onUpdateFlashcard, user }: { courses: Course[], onUpdate: (c: Course) => void, onUpdateFlashcard: (cid: string, mid: string, c: Flashcard) => void, user?: any }) => {
  const [activeTab, setActiveTab] = useState<'content' | 'study' | 'performance'>('content');
  const [showWizard, setShowWizard] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [activeLecture, setActiveLecture] = useState<Lecture | null>(null);

  const { showToast } = useContext(ToastContext);
  const navigate = useNavigate();

  const urlParts = window.location.hash.split('/');
  const courseId = urlParts[urlParts.length - 1];
  const course = courses.find(c => c.id === courseId);

  // --- Performance Graph Data (must be before any early return) ---
  const performanceData = useMemo(() => {
    if (!course || !course.quizHistory || course.quizHistory.length === 0) return [];

    // Sort chronologically
    const sorted = [...course.quizHistory].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return sorted.map((res, idx) => {
        let label = `Quiz ${idx + 1}`;
        // Attempt to find Chapter Name from IDs
        if (res.chapterIds && res.chapterIds.length > 0) {
            const ch = course.chapters.find(c => c.id === res.chapterIds![0]);
            if (ch) label = `Ch ${course.chapters.indexOf(ch) + 1}`;
            else label = "Mixed";
        } else {
            label = "General";
        }

        return {
            date: new Date(res.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            score: Math.round((res.score / res.total) * 100),
            label: label,
            fullDate: new Date(res.date).toLocaleString(),
            material: res.materialTitle || "Quiz"
        };
    });
  }, [course]);

  if (!course) return <div className="p-8 text-center">Course not found</div>;

  const handleSaveWizard = async (updated: Course, file?: File | Blob) => {
    let newCourse = { ...updated };
    if (file) {
      const blobId = await savePdfBlob(newCourse.id, file);
      newCourse.pdfBlobId = blobId;
      newCourse.pdfUrl = URL.createObjectURL(file);

      // Generate PDF thumbnail
      try {
        const pdf = await loadPdfDocument(newCourse.pdfUrl);
        const thumbnail = await generatePdfThumbnail(pdf, 200);
        newCourse.pdfThumbnail = thumbnail;
      } catch (e) {
        console.warn('Failed to generate PDF thumbnail:', e);
      }
    }
    onUpdate(newCourse);
    setShowWizard(false);
  };

  const handleImportSave = (note: Partial<Lecture>) => {
    const newLecture = note as Lecture;
    onUpdate({ ...course, lectures: [newLecture, ...course.lectures] });
  };

  const handleSaveToChapter = (chapterId: string, subchapterId: string | null, notes: string, title: string) => {
    const updatedChapters = course.chapters.map(ch => {
      if (ch.id === chapterId) {
        if (subchapterId && ch.subchapters) {
          // Add notes to subchapter
          return {
            ...ch,
            subchapters: ch.subchapters.map(sub =>
              sub.id === subchapterId
                ? {
                    ...sub,
                    notes: sub.notes ? `${sub.notes}\n\n--- ${title || 'Additional Notes'} ---\n${notes}` : notes,
                    notesTitle: sub.notesTitle || (title.trim() || undefined) // Preserve existing or set new custom title
                  }
                : sub
            )
          };
        } else {
          // Add notes to chapter level
          return {
            ...ch,
            notes: ch.notes ? `${ch.notes}\n\n--- ${title || 'Additional Notes'} ---\n${notes}` : notes,
            notesTitle: ch.notesTitle || (title.trim() || undefined) // Preserve existing or set new custom title
          };
        }
      }
      return ch;
    });
    onUpdate({ ...course, chapters: updatedChapters });
  };

  const handleCreateNotesChapter = (title: string, notes: string, sectionTitle?: string) => {
    const chapterId = Math.random().toString(36).substring(2, 9);

    if (sectionTitle) {
      // Create chapter with a subchapter containing the notes
      const newChapter = {
        id: chapterId,
        title,
        isNotesOnly: true,
        subchapters: [{
          id: Math.random().toString(36).substring(2, 9),
          title: sectionTitle,
          isNotesOnly: true,
          notes
        }]
      };
      onUpdate({ ...course, chapters: [...course.chapters, newChapter] });
    } else {
      // Create chapter with notes at chapter level (old behavior)
      const newChapter = {
        id: chapterId,
        title,
        isNotesOnly: true,
        notes
      };
      onUpdate({ ...course, chapters: [...course.chapters, newChapter] });
    }
  };

  const handleCreateSubchapter = (chapterId: string, sectionTitle: string, notes: string) => {
    const updatedChapters = course.chapters.map(ch => {
      if (ch.id === chapterId) {
        const newSubchapter = {
          id: Math.random().toString(36).substring(2, 9),
          title: sectionTitle,
          isNotesOnly: true,
          notes
        };
        return {
          ...ch,
          subchapters: [...(ch.subchapters || []), newSubchapter]
        };
      }
      return ch;
    });
    onUpdate({ ...course, chapters: updatedChapters });
  };

  const handleRecordingSave = async (lecture: Partial<Lecture>, blob?: Blob) => {
      let newLecture = { ...lecture } as Lecture;
      if (blob) {
          const blobId = await saveMediaBlob(course.id, blob);
          newLecture.audioBlobId = blobId;
          newLecture.audioUrl = URL.createObjectURL(blob);
      }
      onUpdate({ ...course, lectures: [newLecture, ...course.lectures] });
      setShowRecorder(false);
      showToast("Lecture recorded successfully!", "success");
  };

  const handleViewLecture = (l: Lecture) => {
      setActiveLecture(l);
      // Ensure we are in the generator tab so the user sees the side-by-side or mobile switch
      setActiveTab('content');
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 md:px-8 md:py-4 flex flex-col md:flex-row md:justify-between md:items-center shrink-0 shadow-sm z-10 gap-4">
        <div className="flex items-start gap-3">
          <button
             onClick={() => navigate('/')}
             className="md:hidden mt-1 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300"
             aria-label="Back to Dashboard"
          >
             <i className="fas fa-arrow-left"></i>
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
               <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-xs font-bold px-2 py-0.5 rounded">{course.code}</span>
               <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{course.title}</h2>
            </div>
            <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400 font-medium overflow-x-auto no-scrollbar whitespace-nowrap">
               <span><i className="fas fa-book mr-1"></i> {course.chapters.length} Ch</span>
               <span><i className="fas fa-file-alt mr-1"></i> {course.lectures.length} Notes</span>
               <span><i className="fas fa-clipboard-list mr-1"></i> {course.materials.length} Items</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center w-full md:w-auto">

          <button
             disabled
             title="Coming soon"
             className="flex-1 md:flex-none px-3 py-2 text-xs md:text-sm font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-not-allowed opacity-60 whitespace-nowrap flex items-center justify-center gap-2"
          >
             <i className="fas fa-microphone"></i> Record
          </button>

          <button
            onClick={() => setShowImport(true)}
            className="flex-1 md:flex-none px-3 py-2 text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-lg transition-colors shadow-sm whitespace-nowrap"
          >
             <i className="fas fa-file-import mr-2 text-slate-500 dark:text-slate-400"></i>Import Notes
          </button>

          <div className="w-px h-6 bg-slate-200 dark:bg-slate-600 mx-1 hidden md:block"></div>

          <button onClick={() => setShowWizard(true)} className="flex-1 md:flex-none px-3 py-2 text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors border border-slate-200 dark:border-slate-600 whitespace-nowrap">
            <i className="fas fa-edit mr-2"></i>Edit Book/Ch
          </button>

          {user && (
            <button
              onClick={() => setShowShare(true)}
              className="flex-1 md:flex-none px-3 py-2 text-xs md:text-sm font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 border border-green-200 dark:border-green-800 rounded-lg transition-colors shadow-sm whitespace-nowrap flex items-center justify-center gap-2"
            >
              <i className="fas fa-share-alt"></i>
              <span className="hidden md:inline">Share</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
         {/* Left: Viewer (PDF or Lecture Player) */}
         {activeTab === 'content' && (
           <div className="w-full md:w-1/2 h-[40vh] md:h-full bg-slate-800 border-b md:border-b-0 md:border-r border-slate-200 relative shrink-0">
             {activeLecture ? (
                 <LecturePlayer lecture={activeLecture} onClose={() => setActiveLecture(null)} />
             ) : (
                 <>
                   <PdfViewer url={course.pdfUrl || ''} />
                   {!course.pdfUrl && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-800 z-10 p-4 text-center">
                        <i className="fas fa-book-open text-4xl mb-4 opacity-50"></i>
                        <p>No Content Yet</p>
                        <button onClick={() => setShowWizard(true)} className="mt-4 text-blue-400 hover:underline">Add PDF or Notes to use Generator</button>
                    </div>
                   )}
                 </>
             )}
           </div>
         )}

         {/* Right: Study/Gen Area */}
         <div className={`w-full ${activeTab === 'content' ? 'md:w-1/2 h-full' : 'md:w-full h-full'} overflow-y-auto bg-slate-50 dark:bg-slate-900 p-4 md:p-6 flex flex-col`}>
            {/* Tabs */}
            <div className="flex gap-2 mb-4 md:mb-6 border-b border-slate-200 dark:border-slate-700 pb-2 shrink-0 overflow-x-auto">
              <button onClick={() => setActiveTab('content')} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded transition-colors whitespace-nowrap ${activeTab === 'content' ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}>AI Generator</button>
              <button onClick={() => setActiveTab('study')} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded transition-colors whitespace-nowrap ${activeTab === 'study' ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}>Study Library</button>
              <button onClick={() => setActiveTab('performance')} className={`flex-1 md:flex-none px-4 py-2 text-sm font-bold rounded transition-colors whitespace-nowrap ${activeTab === 'performance' ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'}`}>Performance</button>
            </div>

            <div className="flex-1">
              {activeTab === 'content' && (
                <GeneratorPanel course={course} onUpdate={onUpdate} onViewLecture={handleViewLecture} userId={user?.uid} />
              )}
              {activeTab === 'study' && (
                <LibraryPanel course={course} onUpdate={onUpdate} onUpdateFlashcard={onUpdateFlashcard} />
              )}
              {activeTab === 'performance' && (
                <div className="h-full flex flex-col">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6 flex-1 min-h-[400px]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Chapter Performance</h3>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Based on Quiz Results</div>
                        </div>
                        {performanceData.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <i className="fas fa-chart-line text-4xl mb-4 opacity-50"></i>
                                <p className="font-medium">No quiz data available yet.</p>
                                <p className="text-sm mt-1">Take a quiz in the Library tab to see your progress!</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="90%">
                                <LineChart data={performanceData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200 dark:stroke-slate-700" />
                                    <XAxis dataKey="date" tick={{fontSize: 12}} className="fill-slate-500 dark:fill-slate-400" tickLine={false} axisLine={false} dy={10} />
                                    <YAxis domain={[0, 100]} tick={{fontSize: 12}} className="fill-slate-500 dark:fill-slate-400" tickLine={false} axisLine={false} unit="%" />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tooltip-bg, white)' }}
                                        formatter={(val: any) => [`${val}%`, 'Score']}
                                        labelFormatter={(label, payload) => {
                                            if (payload && payload.length > 0) {
                                                const data = payload[0].payload;
                                                return `${data.fullDate} • ${data.label}`;
                                            }
                                            return label;
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="score"
                                        stroke="#2563eb"
                                        strokeWidth={3}
                                        dot={{ r: 5, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                                        activeDot={{ r: 8 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {performanceData.length > 0 && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                           <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 font-bold text-xs text-slate-500 dark:text-slate-400 uppercase">Recent History</div>
                           {performanceData.slice().reverse().slice(0, 5).map((d, i) => (
                               <div key={i} className="flex justify-between items-center p-4 border-b border-slate-50 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                   <div>
                                       <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{d.label}</div>
                                       <div className="text-xs text-slate-500 dark:text-slate-400">{d.material}</div>
                                   </div>
                                   <div className={`text-lg font-bold ${d.score >= 80 ? 'text-green-600 dark:text-green-400' : d.score >= 60 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500 dark:text-red-400'}`}>
                                       {d.score}%
                                   </div>
                               </div>
                           ))}
                        </div>
                    )}
                </div>
              )}
            </div>
         </div>
      </div>

      <Modal isOpen={showWizard} onClose={() => setShowWizard(false)} title="Manage Course Content" maxWidth="max-w-6xl">
        <ChapterWizard course={course} onCancel={() => setShowWizard(false)} onSave={handleSaveWizard} onToast={showToast} />
      </Modal>

      <ImportNotesModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onSave={handleImportSave}
        onSaveToChapter={handleSaveToChapter}
        onCreateNotesChapter={handleCreateNotesChapter}
        onCreateSubchapter={handleCreateSubchapter}
        onToast={showToast}
        course={course}
      />

      {showRecorder && (
          <LectureRecorder
              onSave={handleRecordingSave}
              onCancel={() => setShowRecorder(false)}
              onToast={showToast}
          />
      )}

      {showShare && user && (
        <ShareCourseModal
          isOpen={showShare}
          onClose={() => setShowShare(false)}
          course={course}
          user={user}
        />
      )}
    </div>
  );
};
