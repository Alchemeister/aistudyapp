import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Course, Chapter, Lecture, StudyMaterial, ContentType, Difficulty, Question, Flashcard, QuizResult } from './types';
import { saveCourses, loadCourses, savePdfBlob, getPdfBlob, deleteCourseData, seedInitialData } from './services/storage';
import { generateContent, fixFlashcardContent } from './services/geminiService';
import { loadPdfDocument, extractTextFromRange } from './services/pdfUtils';
import { getInitialCardState } from './services/srs';
import { Pomodoro } from './components/Pomodoro';
import { QuizTaker } from './components/QuizTaker';
import { Modal } from './components/Modal';
import { ChapterWizard } from './components/ChapterWizard';
import { PdfViewer } from './components/PdfViewer';
import { ReviewSession, ReviewItem } from './components/ReviewSession';
import { Login } from './components/Login';
import { CourseView } from './components/CourseView';
import { auth, signOut as firebaseSignOut } from './services/firebase';
import { GeneratorPanel, FlashcardViewer } from './components/GeneratorPanel';

// --- Utils ---
const uuid = () => Math.random().toString(36).substring(2, 9);
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// --- Toast System ---
interface ToastMsg { id: string; msg: string; type: 'success' | 'error' | 'info'; }
export const ToastContext = createContext<{ showToast: (msg: string, type?: 'success'|'error'|'info') => void }>({ showToast: () => {} });

const ToastContainer = ({ children }: { children?: React.ReactNode }) => {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const showToast = (msg: string, type: 'success'|'error'|'info' = 'success') => {
    const id = uuid();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };
  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 left-6 z-[60] flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-lg shadow-lg text-white text-sm font-bold flex items-center animate-slide-up ${t.type === 'error' ? 'bg-red-500' : 'bg-slate-800'}`}>
            <i className={`fas ${t.type === 'success' ? 'fa-check-circle' : t.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} mr-2`}></i>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

function App() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Auth Listener
  useEffect(() => {
    // Safety check: if Firebase isn't configured, auth will be undefined.
    // In that case, we stop loading and let the Login component handle the UI for missing config.
    if (!auth) {
        console.warn("Firebase Auth not initialized. Skipping auth listener.");
        setLoading(false);
        return;
    }

    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) {
        setUser(u);
      } else {
        // Keep user null, will show Login
      }
      setLoading(false); // Ensure loading stops once auth check is done
    });
    return () => unsubscribe();
  }, []);

  // Data Loading (Only load if user is present or we are in a demo mode)
  useEffect(() => {
    if (!user) return; 

    const init = async () => {
      const data = await seedInitialData();
      setCourses(data);
      setLoading(false);
    };
    init();
  }, [user]);

  useEffect(() => {
    if (!loading && user) saveCourses(courses);
  }, [courses, loading, user]);

  const addCourse = (course: Course) => setCourses([...courses, course]);
  
  const updateCourse = (updated: Course) => setCourses(courses.map(c => c.id === updated.id ? updated : c));
  
  const deleteCourse = async (id: string) => {
    const course = courses.find(c => c.id === id);
    if (course) {
      await deleteCourseData(course);
      setCourses(courses.filter(c => c.id !== id));
    }
  };

  const handleFlashcardUpdate = (courseId: string, materialId: string, updatedCard: Flashcard) => {
    setCourses(prevCourses => prevCourses.map(c => {
        if (c.id !== courseId) return c;
        const newMaterials = c.materials.map(m => {
            if (m.id !== materialId) return m;
            const newContent = (m.content as Flashcard[]).map(card => card.id === updatedCard.id ? updatedCard : card);
            return { ...m, content: newContent };
        });
        return { ...c, materials: newMaterials };
    }));
  };

  if (!user) {
    return (
       <Login onLoginSuccess={setUser} />
    );
  }

  if (loading) return <div className="h-screen flex flex-col items-center justify-center text-primary"><i className="fas fa-circle-notch fa-spin text-4xl mb-4"></i><span className="font-bold">Loading StudyAI...</span></div>;

  return (
    <ToastContainer>
      <Router>
        <div className="h-screen flex flex-col md:flex-row bg-slate-50 font-sans overflow-hidden">
          <Sidebar courses={courses} onAddCourse={addCourse} onDeleteCourse={deleteCourse} user={user} />
          <main className="flex-1 overflow-y-auto h-full relative">
            <Routes>
              <Route path="/" element={<Dashboard courses={courses} onDeleteCourse={deleteCourse} />} />
              <Route path="/review" element={<ReviewController courses={courses} onUpdateCard={handleFlashcardUpdate} />} />
              <Route path="/course/:courseId" element={<CourseView courses={courses} onUpdate={updateCourse} onUpdateFlashcard={handleFlashcardUpdate} />} />
            </Routes>
            <Pomodoro />
          </main>
        </div>
      </Router>
    </ToastContainer>
  );
}

// --- Review Controller ---
const ReviewController = ({ courses, onUpdateCard }: { courses: Course[], onUpdateCard: (cid: string, mid: string, card: Flashcard) => void }) => {
    const navigate = useNavigate();
    
    // Gather all due cards (excluding broken ones)
    const now = new Date();
    const queue: ReviewItem[] = [];
    
    for (const c of courses) {
        c.materials.forEach(m => {
            if (m.type === ContentType.FLASHCARDS) {
                (m.content as Flashcard[]).forEach(card => {
                    // Filter invalid cards (empty front/back)
                    if (!card.front || !card.back || !card.front.trim() || !card.back.trim()) return;

                    if (card.dueDate && new Date(card.dueDate) <= now) {
                        queue.push({
                            courseId: c.id,
                            materialId: m.id,
                            card: card,
                            courseTitle: c.title
                        });
                    }
                });
            }
        });
    }

    return (
        <ReviewSession 
            queue={queue} 
            onUpdateCard={onUpdateCard} 
            onExit={() => navigate('/')} 
        />
    );
};

// --- Sidebar ---
const Sidebar = ({ courses, onAddCourse, onDeleteCourse, user }: { courses: Course[], onAddCourse: (c: Course) => void, onDeleteCourse: (id: string) => void, user: any }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCourse, setNewCourse] = useState({ title: '', code: '', subtitle: '', description: '', semester: 'Fall 2024' });
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  const handleCreate = () => {
    if (!newCourse.title || !newCourse.code) return;
    const course: Course = {
      id: uuid(),
      ...newCourse,
      chapters: [], lectures: [], materials: [], quizHistory: []
    };
    onAddCourse(course);
    setIsModalOpen(false);
    setNewCourse({ title: '', code: '', subtitle: '', description: '', semester: 'Fall 2024' });
  };

  const handleLogout = async () => {
     try {
       await firebaseSignOut();
       window.location.reload(); // Hard reload to clear state
     } catch (e) {
       console.error("Logout failed", e);
     }
  };

  return (
    <>
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col h-full z-20 hidden md:flex">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white"><i className="fas fa-graduation-cap"></i></div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">StudyAI</h1>
        </div>
        
        {/* User Profile Snippet */}
        <div className="px-6 py-4 flex items-center gap-3 border-b border-slate-100">
           <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
              {user.photoURL ? <img src={user.photoURL} alt="user" className="w-full h-full object-cover" /> : <i className="fas fa-user text-slate-400"></i>}
           </div>
           <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-700 truncate">{user.displayName || "Student"}</div>
              <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-red-500">Sign Out</button>
           </div>
        </div>

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto custom-scrollbar">
          <Link to="/" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-primary font-medium transition-colors">
            <i className="fas fa-th-large w-5"></i> Dashboard
          </Link>
          <Link to="/review" className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-primary font-medium transition-colors">
            <i className="fas fa-layer-group w-5"></i> Review
          </Link>

          <div className="mt-6 mb-2 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">My Courses</div>
          {courses.map(course => (
            <div key={course.id} className="group flex items-center justify-between px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
              <Link to={`/course/${course.id}`} className="flex-1 flex items-center gap-3 min-w-0">
                <span className="font-mono text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">{course.code}</span>
                <span className="text-sm font-medium text-slate-700 truncate">{course.title}</span>
              </Link>
              <button onClick={() => setCourseToDelete(course)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1">
                <i className="fas fa-trash-alt text-xs"></i>
              </button>
            </div>
          ))}
          <button onClick={() => setIsModalOpen(true)} className="w-full mt-6 flex items-center justify-center px-4 py-3 border border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-primary hover:text-primary transition-all text-sm font-bold bg-slate-50 hover:bg-white">
            <i className="fas fa-plus mr-2"></i> Add Course
          </button>
        </nav>
      </aside>

      {/* Create Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Course">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Code</label>
            <input 
              className="w-full p-2 border border-slate-300 rounded focus:ring-primary outline-none bg-white text-slate-900 placeholder:text-slate-400" 
              placeholder="BIO101" 
              value={newCourse.code} 
              onChange={e => setNewCourse({...newCourse, code: e.target.value})} 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Title</label>
            <input 
              className="w-full p-2 border border-slate-300 rounded focus:ring-primary outline-none bg-white text-slate-900 placeholder:text-slate-400" 
              placeholder="Intro to Biology" 
              value={newCourse.title} 
              onChange={e => setNewCourse({...newCourse, title: e.target.value})} 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Semester</label>
            <select 
              className="w-full p-2 border border-slate-300 rounded focus:ring-primary outline-none bg-white text-slate-900"
              value={newCourse.semester}
              onChange={e => setNewCourse({...newCourse, semester: e.target.value})}
            >
              <option value="Fall 2024">Fall 2024</option>
              <option value="Spring 2025">Spring 2025</option>
              <option value="Fall 2025">Fall 2025</option>
              <option value="Spring 2026">Spring 2026</option>
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500">Cancel</button>
          <button onClick={handleCreate} disabled={!newCourse.title} className="px-4 py-2 bg-primary text-white rounded font-bold">Create</button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <CourseDeleteModal 
        course={courseToDelete} 
        onClose={() => setCourseToDelete(null)} 
        onConfirm={() => { if(courseToDelete) onDeleteCourse(courseToDelete.id); setCourseToDelete(null); }} 
      />
    </>
  );
};

// --- Dashboard ---
const Dashboard = ({ courses, onDeleteCourse }: { courses: Course[], onDeleteCourse: (id: string) => void }) => {
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [semesterFilter, setSemesterFilter] = useState("All Semesters");
  const navigate = useNavigate();

  // Get unique semesters
  const semesters = ["All Semesters", ...Array.from(new Set(courses.map(c => c.semester)))];

  // Filter courses
  const filteredCourses = courses.filter(c => semesterFilter === "All Semesters" || c.semester === semesterFilter);

  // Calculate Due Cards
  const dueCount = courses.reduce((acc, c) => {
      return acc + c.materials.reduce((mAcc, m) => {
          if (m.type === ContentType.FLASHCARDS) {
              return mAcc + (m.content as Flashcard[])
                .filter(fc => fc.front && fc.back && fc.dueDate && new Date(fc.dueDate) <= new Date()).length;
          }
          return mAcc;
      }, 0);
  }, 0);

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h2>
           <p className="text-slate-500 mt-1">Overview of your academic progress.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-bold text-slate-500">Semester:</label>
          <select 
            className="p-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 bg-white shadow-sm focus:ring-primary focus:border-primary outline-none"
            value={semesterFilter}
            onChange={(e) => setSemesterFilter(e.target.value)}
          >
            {semesters.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </header>

      {/* Hero Review Card */}
      <div className="mb-8 bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between">
          <div>
              <h3 className="text-2xl font-bold mb-1">Ready to Review?</h3>
              <p className="text-slate-300">You have <span className="font-bold text-white">{dueCount}</span> cards due for review today.</p>
          </div>
          <button 
            onClick={() => navigate('/review')}
            className="px-6 py-3 bg-primary hover:bg-blue-600 text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-2"
          >
              <i className="fas fa-play"></i> Start Session
          </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StatCard label="Active Courses" value={filteredCourses.length} icon="fa-book" color="text-blue-600" bg="bg-blue-50" />
        <StatCard label="Quizzes Taken" value={filteredCourses.reduce((acc, c) => acc + c.quizHistory.length, 0)} icon="fa-check-circle" color="text-purple-600" bg="bg-purple-50" />
        <StatCard label="Study Materials" value={filteredCourses.reduce((acc, c) => acc + c.materials.length, 0)} icon="fa-layer-group" color="text-amber-600" bg="bg-amber-50" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map(course => (
          <div key={course.id} className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all relative group flex flex-col h-64">
             <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded border border-slate-200">{course.code}</span>
                  <button onClick={(e) => {e.preventDefault(); setCourseToDelete(course)}} className="text-slate-300 hover:text-red-500 p-1"><i className="fas fa-trash-alt"></i></button>
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-1 line-clamp-1">{course.title}</h4>
                <div className="flex items-center gap-2 mb-4">
                   <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{course.semester}</span>
                   <p className="text-sm text-slate-500 line-clamp-1">{course.subtitle}</p>
                </div>
                <div className="flex gap-4 text-xs text-slate-400 mt-auto">
                   <span className="flex items-center gap-1"><i className="fas fa-file-pdf"></i> {course.pdfName ? 'PDF Linked' : 'No PDF'}</span>
                   <span className="flex items-center gap-1"><i className="fas fa-list"></i> {course.chapters.length} Ch</span>
                </div>
             </div>
             <Link to={`/course/${course.id}`} className="bg-slate-50 p-3 text-center text-sm font-bold text-primary border-t border-slate-100 hover:bg-blue-50 transition-colors rounded-b-xl">
               Enter Course <i className="fas fa-arrow-right ml-1 text-xs"></i>
             </Link>
          </div>
        ))}
        {filteredCourses.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400">
             No courses found for this semester.
          </div>
        )}
      </div>

      <CourseDeleteModal 
        course={courseToDelete} 
        onClose={() => setCourseToDelete(null)} 
        onConfirm={() => { if(courseToDelete) onDeleteCourse(courseToDelete.id); setCourseToDelete(null); }} 
      />
    </div>
  );
};

// --- Specialized Delete Modal ---
const CourseDeleteModal = ({ course, onClose, onConfirm }: { course: Course | null, onClose: () => void, onConfirm: () => void }) => {
  const [confirmName, setConfirmName] = useState("");
  
  if (!course) return null;

  const isMatch = confirmName === course.title;

  return (
    <Modal isOpen={!!course} onClose={onClose} title="Delete Course" maxWidth="max-w-md">
       <div className="p-2">
         <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-4 flex items-start gap-3">
            <i className="fas fa-exclamation-triangle text-red-500 mt-1"></i>
            <div>
              <h4 className="font-bold text-red-800 text-sm">Permanent Action</h4>
              <p className="text-xs text-red-600 mt-1">This will permanently delete:</p>
              <ul className="list-disc list-inside text-xs text-red-600 mt-1 space-y-0.5 ml-1">
                 <li>The uploaded textbook PDF</li>
                 <li>All {course.chapters.length} chapters and mappings</li>
                 <li>All {course.materials.length} study materials (flashcards, quizzes)</li>
                 <li>All progress and SRS data</li>
              </ul>
            </div>
         </div>
         
         <p className="text-sm text-slate-600 mb-4">
           To confirm deletion, please type <span className="font-bold select-all">"{course.title}"</span> below:
         </p>
         
         <input 
           className="w-full p-2 border border-slate-300 rounded mb-6 focus:ring-red-500 focus:border-red-500 outline-none font-bold"
           placeholder={course.title}
           value={confirmName}
           onChange={(e) => setConfirmName(e.target.value)}
           autoFocus
         />

         <div className="flex justify-end gap-3">
           <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancel</button>
           <button 
             onClick={onConfirm} 
             disabled={!isMatch}
             className="px-4 py-2 bg-red-500 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-600 shadow-sm transition-all"
           >
             Delete Course
           </button>
         </div>
       </div>
    </Modal>
  );
};

const StatCard = ({ label, value, icon, color, bg }: any) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-full ${bg} ${color} flex items-center justify-center text-xl shadow-sm`}><i className={`fas ${icon}`}></i></div>
    <div><div className="text-slate-500 text-xs font-bold uppercase tracking-wide">{label}</div><div className="text-2xl font-bold text-slate-900">{value}</div></div>
  </div>
);

// --- Library Panel ---
export const LibraryPanel = ({ course, onUpdate, onUpdateFlashcard }: { course: Course, onUpdate: (c: Course) => void, onUpdateFlashcard: (cid: string, mid: string, c: Flashcard) => void }) => {
  const [activeMat, setActiveMat] = useState<StudyMaterial | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [renameId, setRenameId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<string>('MULTI');
  const [fixing, setFixing] = useState(false);
  const { showToast } = useContext(ToastContext);

  // Initialize filterTab if unset (default to MULTI, or first available source)
  // Simplified for this view

  // Filter materials based on tab
  // If tab is 'MULTI', show multi-chapter or lecture-based materials or anything with >1 source
  const filteredMaterials = course.materials.filter(m => {
    if (filterTab === 'MULTI') return (m.sourceChapterIds?.length || 0) > 1 || (m.sourceChapterIds?.length === 0);
    // Specific chapter logic
    return m.sourceChapterIds?.length === 1 && m.sourceChapterIds[0] === filterTab;
  });

  // Sort materials by date descending
  const sortedMaterials = [...filteredMaterials].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleComplete = (score: number) => {
    if (activeMat?.type === ContentType.QUIZ) {
      onUpdate({ ...course, quizHistory: [...course.quizHistory, { date: new Date().toISOString(), score, total: (activeMat.content as any).length }] });
    }
  };

  const handleExitQuiz = () => {
    setActiveMat(null);
  }

  const handleFixCard = async (card: Flashcard) => {
    if (!activeMat || fixing) return;
    setFixing(true);
    showToast("Fixing card... please wait.", "info");

    try {
        // Retrieve context from chapters
        let context = "";
        const relevantChapters = course.chapters.filter(ch => activeMat.sourceChapterIds?.includes(ch.id));
        context += relevantChapters.map(ch => ch.extractedText || "").join("\n");
        
        // Also retrieve context from lectures if any
        const relevantLectures = course.lectures.filter(l => activeMat.sourceChapterIds?.includes(l.id));
        context += relevantLectures.map(l => l.transcript || "").join("\n");

        if (!context) context = `Card Context: ${card.front} ${card.back}`;

        const fixed = await fixFlashcardContent(context);
        const updatedCard = { ...card, front: fixed.front, back: fixed.back };
        
        onUpdateFlashcard(course.id, activeMat.id, updatedCard);
        
        // Update local activeMat state slightly hacky to reflect immediately without closing
        const updatedContent = (activeMat.content as Flashcard[]).map(c => c.id === card.id ? updatedCard : c);
        setActiveMat({ ...activeMat, content: updatedContent });

        showToast("Card fixed successfully!");
    } catch (e) {
        showToast("Failed to fix card.", "error");
    } finally {
        setFixing(false);
    }
  };

  const hasBrokenCards = (mat: StudyMaterial) => {
      if (mat.type !== ContentType.FLASHCARDS) return false;
      return (mat.content as Flashcard[]).some(c => !c.front || !c.back || !c.front.trim() || !c.back.trim());
  };

  const handleSaveMissedFlashcards = (missedQs: Question[]) => {
    if (missedQs.length === 0) return;
    
    const newCards: Flashcard[] = missedQs.map(q => ({
      id: uuid(),
      front: q.text,
      back: `Answer: ${q.correctAnswer}\n\nExplanation: ${q.explanation || ''}`,
      mastered: false,
      ...getInitialCardState(true) // Initialize with easier stats for missed Qs
    }));
    
    const newMat: StudyMaterial = {
      id: uuid(),
      type: ContentType.FLASHCARDS,
      title: `Missed from Quiz - ${formatDate(new Date().toISOString())}`,
      createdAt: new Date().toISOString(),
      difficulty: activeMat?.difficulty || Difficulty.MEDIUM,
      content: newCards,
      sourceChapterIds: activeMat?.sourceChapterIds || [] // Inherit chapter tags
    };

    onUpdate({ ...course, materials: [newMat, ...course.materials] });
    showToast(`${newCards.length} flashcards created from errors!`);
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleMerge = () => {
    if (selectedIds.size < 2) return;
    
    const itemsToMerge = course.materials.filter(m => selectedIds.has(m.id));
    const firstType = itemsToMerge[0].type;
    
    if (itemsToMerge.some(m => m.type !== firstType)) {
      showToast("Can only merge items of the same type.", "error");
      return;
    }

    let mergedContent: any;
    const newTitle = `Merged ${firstType === ContentType.FLASHCARDS ? 'Deck' : 'Set'}`;

    if (firstType === ContentType.FLASHCARDS) {
      const allCards = itemsToMerge.flatMap(m => m.content as Flashcard[]);
      const seen = new Set();
      mergedContent = allCards.filter(c => {
        const key = c.front.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } else if (firstType === ContentType.QUIZ) {
       const allQs = itemsToMerge.flatMap(m => m.content as Question[]);
       const seen = new Set();
       mergedContent = allQs.filter(q => {
         const key = q.text.toLowerCase().trim();
         if (seen.has(key)) return false;
         seen.add(key);
         return true;
       });
    } else {
      mergedContent = itemsToMerge.map(m => `--- ${m.title} ---\n\n${m.content}`).join("\n\n");
    }

    // Combine chapter IDs
    const combinedChapterIds = Array.from(new Set(itemsToMerge.flatMap(m => m.sourceChapterIds || [])));

    const newMat: StudyMaterial = {
      id: uuid(),
      type: firstType,
      title: newTitle,
      createdAt: new Date().toISOString(),
      difficulty: itemsToMerge[0].difficulty, 
      content: mergedContent,
      sourceChapterIds: combinedChapterIds
    };

    // Remove originals and add new
    const remainingMaterials = course.materials.filter(m => !selectedIds.has(m.id));
    onUpdate({ ...course, materials: [newMat, ...remainingMaterials] });
    setSelectedIds(new Set());
    showToast(`Merged into "${newTitle}" – originals deleted.`);
  };

  const handleDeleteClick = () => {
    if (selectedIds.size === 0) return;
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    const remaining = course.materials.filter(m => !selectedIds.has(m.id));
    onUpdate({ ...course, materials: remaining });
    setSelectedIds(new Set());
    setDeleteConfirmOpen(false);
    showToast("Items deleted successfully.", "success");
  };

  const startRename = (mat: StudyMaterial, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameId(mat.id);
    setNewName(mat.title);
  };

  const saveRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (renameId && newName.trim()) {
      const updatedMats = course.materials.map(m => m.id === renameId ? { ...m, title: newName.trim() } : m);
      onUpdate({ ...course, materials: updatedMats });
      setRenameId(null);
      showToast("Renamed successfully.");
    }
  };

  const cancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameId(null);
  };

  const getDifficultyBadge = (d?: Difficulty) => {
    if (!d) return null;
    if (d === 1) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-50 text-green-600 border border-green-100">Easy</span>;
    if (d === 3) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">Medium</span>;
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100">Hard</span>;
  };

  const getChapterBadge = (mat: StudyMaterial) => {
    const ids = mat.sourceChapterIds || [];
    if (ids.length === 0) return null;
    
    // Check if it's a Lecture ID
    const lecture = course.lectures.find(l => ids.includes(l.id));
    if (lecture && ids.length === 1) {
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">Note</span>;
    }

    if (ids.length === 1) {
      const idx = course.chapters.findIndex(c => c.id === ids[0]);
      if (idx === -1) return null;
      return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">Ch.{idx + 1}</span>;
    }
    
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">Mixed</span>;
  };

  if (activeMat) {
    return (
      <div className="animate-fade-in-up h-full flex flex-col">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => setActiveMat(null)} className="text-sm font-bold text-slate-500 hover:text-slate-800"><i className="fas fa-arrow-left mr-2"></i>Back to Library</button>
          <div className="flex items-center gap-3">
             <h3 className="font-bold text-slate-800">{activeMat.title}</h3>
             {fixing && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded animate-pulse"><i className="fas fa-magic mr-1"></i>Fixing...</span>}
          </div>
        </div>
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
           {activeMat.type === ContentType.QUIZ && (
             <div className="h-full overflow-y-auto">
               <QuizTaker 
                 questions={activeMat.content as Question[]} 
                 onComplete={handleComplete} 
                 onExit={handleExitQuiz}
                 onSaveMissed={handleSaveMissedFlashcards}
               />
             </div>
           )}
           {activeMat.type === ContentType.FLASHCARDS && (
              <div className="h-full flex items-center justify-center">
                 <FlashcardViewer cards={activeMat.content as Flashcard[]} onFixCard={handleFixCard} />
              </div>
           )}
           {(activeMat.type === ContentType.NOTES || activeMat.type === ContentType.MINDMAP || activeMat.type === ContentType.ACTIVE_RECALL) && (
             <div className="h-full overflow-y-auto p-8 prose max-w-none">
               <pre className="whitespace-pre-wrap font-sans text-slate-700">{activeMat.content as string}</pre>
             </div>
           )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Stats */}
      <div className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h4 className="font-bold text-slate-700 mb-4">Performance</h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={course.quizHistory}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={false} />
              <YAxis domain={[0, 100]} fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={3} dot={{r: 4}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 border-b border-slate-200 flex overflow-x-auto gap-1 no-scrollbar">
         <button 
           onClick={() => setFilterTab('MULTI')}
           className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${filterTab === 'MULTI' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
         >
           All Materials
         </button>
         {course.chapters.map((ch, idx) => (
           <button 
             key={ch.id}
             onClick={() => setFilterTab(ch.id)}
             className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${filterTab === ch.id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
           >
             Ch.{idx + 1}
           </button>
         ))}
      </div>

      {/* List Header */}
      <div className="flex justify-between items-end mb-4 h-8">
        <h4 className="font-bold text-slate-700 flex items-center gap-2">
          Study Materials
          <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{sortedMaterials.length}</span>
        </h4>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 animate-fade-in bg-slate-800 text-white px-2 py-1 rounded-lg shadow-lg z-10">
            <span className="text-xs font-bold px-2">{selectedIds.size} selected</span>
            {selectedIds.size >= 2 && (
              <button onClick={handleMerge} className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded transition-colors border border-blue-500">
                <i className="fas fa-object-group mr-1"></i> Merge
              </button>
            )}
            <button onClick={handleDeleteClick} className="text-xs bg-red-600 hover:bg-red-500 px-3 py-1 rounded transition-colors border border-red-500">
              <i className="fas fa-trash-alt mr-1"></i> Delete
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-400 hover:text-white px-2">
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-10">
        {sortedMaterials.map(mat => (
          <div 
            key={mat.id} 
            onClick={() => selectedIds.size > 0 ? toggleSelect(mat.id) : setActiveMat(mat)} 
            className={`bg-white p-4 rounded-xl border transition-all group relative cursor-pointer flex flex-col justify-between ${selectedIds.has(mat.id) ? 'border-primary ring-1 ring-primary bg-blue-50/30' : 'border-slate-200 hover:border-blue-400 hover:shadow-md'}`}
          >
             {/* Checkbox Overlay */}
             <div className="absolute top-3 right-3 z-10" onClick={(e) => { e.stopPropagation(); toggleSelect(mat.id); }}>
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.has(mat.id) ? 'bg-primary border-primary' : 'bg-white border-slate-300 group-hover:border-blue-300 shadow-sm'}`}>
                   {selectedIds.has(mat.id) && <i className="fas fa-check text-white text-xs"></i>}
                </div>
             </div>

             {/* Meta Header */}
             <div className="flex justify-between items-start mb-2 pr-8">
                <div className="flex gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${mat.type === ContentType.QUIZ ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'}`}>{mat.type}</span>
                  {getDifficultyBadge(mat.difficulty)}
                  {getChapterBadge(mat)}
                </div>
                {hasBrokenCards(mat) && <div className="text-amber-500 text-xs" title="Contains invalid cards"><i className="fas fa-exclamation-triangle"></i></div>}
             </div>
             
             {/* Title / Rename Form */}
             <div className="mb-2">
               {renameId === mat.id ? (
                  <form onSubmit={saveRename} className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <input 
                      autoFocus 
                      className="w-full text-sm font-bold border rounded p-1 outline-none ring-1 ring-primary bg-white text-slate-900" 
                      value={newName} 
                      onChange={e => setNewName(e.target.value)} 
                    />
                    <button type="submit" className="text-green-600 px-1 hover:bg-green-50 rounded"><i className="fas fa-check"></i></button>
                    <button type="button" onClick={cancelRename} className="text-red-500 px-1 hover:bg-red-50 rounded"><i className="fas fa-times"></i></button>
                  </form>
               ) : (
                  <div className="flex items-center gap-2 group/title">
                     <h5 className="font-bold text-slate-800 text-lg leading-tight line-clamp-2">{mat.title}</h5>
                     <button onClick={(e) => startRename(mat, e)} className="text-slate-300 hover:text-blue-500 opacity-0 group-hover/title:opacity-100 transition-opacity p-1"><i className="fas fa-pencil-alt text-xs"></i></button>
                  </div>
               )}
             </div>
             
             <span className="text-xs text-slate-400 font-medium">{formatDate(mat.createdAt)}</span>
          </div>
        ))}
        {sortedMaterials.length === 0 && (
           <div className="col-span-2 py-12 text-center border-2 border-dashed border-slate-100 rounded-xl">
             <i className="fas fa-folder-open text-slate-300 text-4xl mb-3"></i>
             <p className="text-slate-500 font-medium">No materials yet.</p>
             <p className="text-xs text-slate-400">Use the Generator to create flashcards or quizzes!</p>
           </div>
        )}
      </div>

      <Modal isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Confirm Deletion" maxWidth="max-w-sm">
        <div className="p-4 text-center">
           <i className="fas fa-trash-alt text-3xl text-red-500 mb-4 bg-red-50 p-4 rounded-full"></i>
           <h3 className="font-bold text-lg mb-2">Delete {selectedIds.size} Items?</h3>
           <p className="text-slate-500 text-sm mb-6">These materials will be permanently removed from your library.</p>
           <div className="flex justify-center gap-3">
             <button onClick={() => setDeleteConfirmOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancel</button>
             <button onClick={confirmDelete} className="px-6 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 shadow-md">Delete</button>
           </div>
        </div>
      </Modal>
    </div>
  );
};

export default App;