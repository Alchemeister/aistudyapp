
import React, { useState, useEffect, useContext, useRef, useMemo, createContext, type ReactNode, type FC } from 'react';
import { HashRouter as Router, Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { Course, Chapter, Lecture, StudyMaterial, ContentType, Difficulty, Question, Flashcard, QuizResult, ConceptConnection } from './types';
import { saveCourses, loadCourses, savePdfBlob, getPdfBlob, deleteCourseData, seedInitialData } from './services/storage';
import { loadCloudCourses, debouncedCloudSync, immediateCloudSync, mergeCourses, deleteCloudCourse, isCloudSyncAvailable } from './services/cloudSync';
import { generateContent, fixFlashcardContent } from './services/geminiService';
import { loadPdfDocument, extractTextFromRange } from './services/pdfUtils';
import { getInitialCardState } from './services/srs';
import { Pomodoro } from './components/Pomodoro';
import { QuizTaker } from './components/QuizTaker';
import { Modal } from './components/Modal';
import { BookSearchModal } from './components/BookSearchModal';
import { ChapterWizard } from './components/ChapterWizard';
import { PdfViewer } from './components/PdfViewer';
import { ReviewSession, ReviewItem } from './components/ReviewSession';
import { Login } from './components/Login';
import { CourseView } from './components/CourseView';
import { SettingsPanel } from './components/SettingsPanel';
import { auth, signOut as firebaseSignOut } from './services/firebase';
import { GeneratorPanel, FlashcardViewer } from './components/GeneratorPanel';
import { FriendsPanel } from './components/FriendsPanel';
import { createOrUpdateProfile, getSharedWithMe, isFriendsAvailable } from './services/friendsService';
import { SharedCourse } from './types';

// --- Utils ---
const uuid = () => Math.random().toString(36).substring(2, 9);
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Helper: Fisher-Yates Shuffle
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// Helper: Difficulty Label
const getDifficultyLabel = (level: number) => {
  if (level <= 1.5) return "Easy";
  if (level <= 2.5) return "Easy-Medium";
  if (level <= 3.5) return "Medium";
  if (level <= 4.5) return "Medium-Hard";
  return "Hard";
};

// --- Toast System ---
interface ToastMsg { id: string; msg: string; type: 'success' | 'error' | 'info'; }
export const ToastContext = createContext<{ showToast: (msg: string, type?: 'success'|'error'|'info') => void }>({ showToast: () => {} });

const ToastContainer = ({ children }: { children?: ReactNode }) => {
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

// --- Mobile Navigation ---
const MobileNav = ({ user, onLogout, dueCount }: { user: any, onLogout: () => void, dueCount?: number }) => {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    document.documentElement.classList.toggle('dark', newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  return (
    <div className="md:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-2" onClick={() => navigate('/')}>
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white"><i className="fas fa-graduation-cap"></i></div>
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">StudyAI</h1>
      </div>
      <div className="flex items-center gap-2">
          <button
            onClick={toggleDarkMode}
            className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600"
            title={darkMode ? 'Light Mode' : 'Dark Mode'}
          >
             <i className={`fas ${darkMode ? 'fa-sun text-amber-500' : 'fa-moon text-indigo-500'} text-xs`}></i>
          </button>
          <Link to="/review" className="relative w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600">
             <i className="fas fa-layer-group text-xs"></i>
             {(dueCount || 0) > 0 && (
               <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                 {(dueCount || 0) > 9 ? '9+' : dueCount}
               </span>
             )}
          </Link>
          <Link to="/friends" className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600">
             <i className="fas fa-user-friends text-xs"></i>
          </Link>
          <Link to="/settings" className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600">
             <i className="fas fa-cog text-xs"></i>
          </Link>
          <button
            onClick={onLogout}
            className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 border border-slate-200 dark:border-slate-600"
            title="Logout"
          >
             <i className="fas fa-sign-out-alt text-xs"></i>
          </button>
      </div>
    </div>
  );
};

function App() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Persist sidebar state
    const saved = localStorage.getItem('studyai_sidebar_collapsed');
    return saved === 'true';
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem('studyai_sidebar_collapsed', String(newVal));
      return newVal;
    });
  };

  // Auth Listener
  useEffect(() => {
    if (!auth) {
        console.warn("Firebase Auth not initialized. Skipping auth listener.");
        setLoading(false);
        return;
    }

    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) {
        setUser(u);
        // Create/update user profile for friends feature
        createOrUpdateProfile(u);
      } else {
        // Keep user null, will show Login
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Loading - Merge Local + Cloud
  useEffect(() => {
    if (!user) return;

    const init = async () => {
      // Only seed demo data for demo accounts (email contains 'demo' or anonymous users)
      const isDemoAccount = !user.email || user.email.toLowerCase().includes('demo');
      const localData = await seedInitialData(isDemoAccount);

      // Try to load and merge cloud data
      if (isCloudSyncAvailable() && user.uid) {
        try {
          console.log('☁️ Fetching cloud data...');
          const cloudData = await loadCloudCourses(user.uid);
          const merged = mergeCourses(localData, cloudData);
          setCourses(merged);

          // Save merged data back to local
          await saveCourses(merged);
          console.log('☁️ Cloud sync complete');
        } catch (error) {
          console.warn('Cloud sync failed, using local data:', error);
          setCourses(localData);
        }
      } else {
        setCourses(localData);
      }

      setLoading(false);
    };
    init();
  }, [user]);

  useEffect(() => {
    if (!loading && user) {
      saveCourses(courses);
      // Debounced cloud sync (2 second delay to batch updates)
      if (isCloudSyncAvailable() && user.uid) {
        debouncedCloudSync(user.uid, courses);
      }
    }
  }, [courses, loading, user]);

  const addCourse = (course: Course) => setCourses([...courses, course]);
  
  const updateCourse = (updated: Course) => setCourses(courses.map(c => c.id === updated.id ? updated : c));
  
  const deleteCourse = async (id: string) => {
    const course = courses.find(c => c.id === id);
    if (course) {
      await deleteCourseData(course);
      // Delete from cloud immediately
      if (isCloudSyncAvailable() && user?.uid) {
        deleteCloudCourse(user.uid, id).catch(console.error);
      }
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

  const handleLogout = async () => {
     try {
       await firebaseSignOut();
       window.location.reload();
     } catch (e) {
       console.error("Logout failed", e);
     }
  };

  // Calculate due cards count for notification badge
  const dueCardsCount = useMemo(() => {
    const now = new Date();
    let count = 0;
    courses.forEach(c => {
      c.materials.forEach(m => {
        if (m.type === ContentType.FLASHCARDS) {
          (m.content as Flashcard[]).forEach(card => {
            if (card.front && card.back && card.dueDate && new Date(card.dueDate) <= now) {
              count++;
            }
          });
        }
      });
    });
    return count;
  }, [courses]);

  if (!user) {
    return (
       <Login onLoginSuccess={setUser} />
    );
  }

  if (loading) return <div className="h-screen flex flex-col items-center justify-center text-primary bg-slate-50 dark:bg-slate-900"><i className="fas fa-circle-notch fa-spin text-4xl mb-4"></i><span className="font-bold dark:text-slate-100">Loading StudyAI...</span></div>;

  return (
    <ToastContainer>
      <Router>
        <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-900 font-sans md:h-screen md:overflow-hidden relative transition-colors">
          <Sidebar courses={courses} onAddCourse={addCourse} onDeleteCourse={deleteCourse} user={user} onLogout={handleLogout} dueCount={dueCardsCount} collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />

          <main className="flex-1 w-full relative flex flex-col md:h-full md:overflow-hidden">
             <MobileNav user={user} onLogout={handleLogout} dueCount={dueCardsCount} />
             <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
                <Routes>
                  <Route path="/" element={<Dashboard courses={courses} onDeleteCourse={deleteCourse} onAddCourse={addCourse} user={user} />} />
                  <Route path="/review" element={<ReviewController courses={courses} onUpdateCard={handleFlashcardUpdate} />} />
                  <Route path="/settings" element={<SettingsPanel user={user} onLogout={handleLogout} />} />
                  <Route path="/friends" element={<FriendsPanel user={user} />} />
                  <Route path="/course/:courseId" element={<CourseView courses={courses} onUpdate={updateCourse} onUpdateFlashcard={handleFlashcardUpdate} user={user} />} />
                </Routes>
             </div>
          </main>

          {/* Pomodoro at Root Level for correct Z-Index and Boundary calculation */}
          <Pomodoro />
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
const Sidebar = ({ courses, onAddCourse, onDeleteCourse, user, onLogout, dueCount, collapsed, onToggleCollapse }: any) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCourse, setNewCourse] = useState({ title: '', code: '', subtitle: '', description: '', semester: 'Fall 2024' });
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    document.documentElement.classList.toggle('dark', newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

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

  return (
    <>
      <aside className={`${collapsed ? 'w-16' : 'w-64'} bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex-shrink-0 flex-col h-full z-20 hidden md:flex transition-all duration-300`}>
        {/* Header with collapse toggle */}
        <div className={`p-4 border-b border-slate-100 dark:border-slate-700 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <Link to="/" className={`flex items-center gap-3 hover:opacity-80 transition-opacity`}>
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white flex-shrink-0"><i className="fas fa-graduation-cap"></i></div>
            {!collapsed && <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">StudyAI</h1>}
          </Link>
          {!collapsed && (
            <button
              onClick={onToggleCollapse}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              title="Collapse sidebar"
            >
              <i className="fas fa-chevron-left text-sm font-bold"></i>
            </button>
          )}
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <button
            onClick={onToggleCollapse}
            className="mx-auto mt-2 w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            title="Expand sidebar"
          >
            <i className="fas fa-chevron-right text-sm font-bold"></i>
          </button>
        )}

        {/* User Profile Snippet */}
        {!collapsed && (
          <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700">
             <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                {user.photoURL ? <img src={user.photoURL} alt="user" className="w-full h-full object-cover" /> : <i className="fas fa-user text-slate-400"></i>}
             </div>
             <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{user.displayName || "Student"}</div>
             </div>
          </div>
        )}

        <nav className={`${collapsed ? 'p-2' : 'p-4'} space-y-1 flex-1 overflow-y-auto custom-scrollbar`}>
          <Link to="/" className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-3 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-primary font-medium transition-colors`} title="Dashboard">
            <i className="fas fa-th-large w-5 text-center"></i>
            {!collapsed && <span>Dashboard</span>}
          </Link>
          <Link to="/review" className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-3 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-primary font-medium transition-colors relative`} title="Review">
            <i className="fas fa-layer-group w-5 text-center"></i>
            {!collapsed && <span>Review</span>}
            {dueCount > 0 && (
              <span className={`${collapsed ? 'absolute -top-1 -right-1' : 'absolute right-3 top-1/2 -translate-y-1/2'} min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1`}>
                {dueCount > 9 ? '9+' : dueCount}
              </span>
            )}
          </Link>
          <Link to="/settings" className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-3 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-primary font-medium transition-colors`} title="Settings">
            <i className="fas fa-cog w-5 text-center"></i>
            {!collapsed && <span>Settings</span>}
          </Link>
          <Link to="/friends" className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-3 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-primary font-medium transition-colors`} title="Friends">
            <i className="fas fa-user-friends w-5 text-center"></i>
            {!collapsed && <span>Friends</span>}
          </Link>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-3 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition-colors w-full`}
            title={darkMode ? 'Light Mode' : 'Dark Mode'}
          >
            <i className={`fas ${darkMode ? 'fa-sun text-amber-500' : 'fa-moon text-indigo-500'} w-5 text-center`}></i>
            {!collapsed && <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          {!collapsed && (
            <>
              <div className="mt-6 mb-2 px-3 text-xs font-bold text-slate-400 uppercase tracking-wider">My Courses</div>
              {courses.map((course: Course) => (
                <div key={course.id} className="group flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <Link to={`/course/${course.id}`} className="flex-1 flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">{course.code}</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{course.title}</span>
                  </Link>
                  <button onClick={() => setCourseToDelete(course)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1">
                    <i className="fas fa-trash-alt text-xs"></i>
                  </button>
                </div>
              ))}
            </>
          )}

          {/* Collapsed: show add button as icon */}
          {collapsed ? (
            <button onClick={() => setIsModalOpen(true)} className="w-full mt-4 flex items-center justify-center p-3 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-primary transition-colors" title="Add Course">
              <i className="fas fa-plus"></i>
            </button>
          ) : (
            <button onClick={() => setIsModalOpen(true)} className="w-full mt-4 flex items-center justify-center px-4 py-3 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 hover:border-primary hover:text-primary transition-all text-sm font-bold bg-slate-50 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700">
              <i className="fas fa-plus mr-2"></i> Add Course
            </button>
          )}
        </nav>
      </aside>

      {/* Create Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Course">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Code</label>
            <input 
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-primary outline-none bg-white text-slate-900 placeholder:text-slate-400" 
              placeholder="BIO101" 
              value={newCourse.code} 
              onChange={e => setNewCourse({...newCourse, code: e.target.value})} 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Title</label>
            <input 
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-primary outline-none bg-white text-slate-900 placeholder:text-slate-400" 
              placeholder="Intro to Biology" 
              value={newCourse.title} 
              onChange={e => setNewCourse({...newCourse, title: e.target.value})} 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Semester</label>
            <select 
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-primary outline-none bg-white text-slate-900"
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
          <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-500 font-bold">Cancel</button>
          <button onClick={handleCreate} disabled={!newCourse.title} className="px-6 py-3 bg-primary text-white rounded-lg font-bold shadow-md">Create</button>
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
const Dashboard = ({ courses, onDeleteCourse, onAddCourse, user }: { courses: Course[], onDeleteCourse: (id: string) => void, onAddCourse: (course: Course) => void, user?: any }) => {
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [semesterFilter, setSemesterFilter] = useState("All Semesters");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCourse, setNewCourse] = useState({ title: '', code: '', subtitle: '', description: '', semester: 'Fall 2024' });
  const [sharedCourses, setSharedCourses] = useState<SharedCourse[]>([]);
  const navigate = useNavigate();

  // Load shared courses
  useEffect(() => {
    if (!user?.uid || !isFriendsAvailable()) return;

    const loadShared = async () => {
      const shared = await getSharedWithMe(user.uid);
      setSharedCourses(shared);
    };
    loadShared();
  }, [user?.uid]);

  const handleCreate = () => {
    if (!newCourse.title || !newCourse.code) return;
    const course: Course = {
      id: uuid(),
      ...newCourse,
      chapters: [], lectures: [], materials: [], quizHistory: []
    };
    onAddCourse(course);
    setShowAddModal(false);
    setNewCourse({ title: '', code: '', subtitle: '', description: '', semester: 'Fall 2024' });
  };

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

  // Calculate Chart Data (Quiz History)
  const chartData = useMemo(() => {
    const history: {date: string, score: number, total: number}[] = [];
    courses.forEach(c => {
        c.quizHistory.forEach(q => history.push(q));
    });
    
    // Group by date
    const grouped = history.reduce((acc, curr) => {
        const d = new Date(curr.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (!acc[d]) acc[d] = { date: d, score: 0, total: 0, count: 0 };
        acc[d].score += curr.score;
        acc[d].total += curr.total;
        acc[d].count += 1;
        return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped)
        .map((g: any) => ({ 
            date: g.date, 
            percentage: Math.round((g.score / g.total) * 100) 
        }))
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-10); // Last 10 days
  }, [courses]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
           <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Dashboard</h2>
           <p className="text-slate-500 dark:text-slate-400 mt-1">Overview of your academic progress.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-primary text-white rounded-lg font-bold shadow-md hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <i className="fas fa-plus"></i>
            <span className="hidden sm:inline">Add Course</span>
          </button>
          <div className="hidden md:flex items-center gap-2 ml-2">
            <label className="text-sm font-bold text-slate-500 dark:text-slate-400">Semester:</label>
            <select
              className="p-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 shadow-sm focus:ring-primary focus:border-primary outline-none"
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
            >
              {semesters.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StatCard label="Active Courses" value={filteredCourses.length} icon="fa-book" color="text-blue-600" bg="bg-blue-50" />
        <StatCard label="Quizzes Taken" value={filteredCourses.reduce((acc, c) => acc + c.quizHistory.length, 0)} icon="fa-check-circle" color="text-purple-600" bg="bg-purple-50" />
        <StatCard label="Study Materials" value={filteredCourses.reduce((acc, c) => acc + c.materials.length, 0)} icon="fa-layer-group" color="text-amber-600" bg="bg-amber-50" />
      </div>

      {/* Progress Chart */}
      {chartData.length > 0 && (
          <div className="mb-10 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
             <div className="flex justify-between items-center mb-6">
                <h4 className="font-bold text-slate-800 flex items-center"><i className="fas fa-chart-line text-primary mr-2"></i> Performance Trends</h4>
                <div className="flex gap-2">
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">Quiz Scores %</span>
                </div>
             </div>
             <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorPerc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} unit="%" domain={[0, 100]} />
                        <Tooltip 
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                            formatter={(value: any) => [`${value}%`, 'Score']}
                            cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="percentage" 
                            stroke="#3b82f6" 
                            strokeWidth={3} 
                            fillOpacity={1} 
                            fill="url(#colorPerc)" 
                            activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
        {filteredCourses.map(course => (
          <div key={course.id} className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all relative group flex flex-col h-auto min-h-[16rem]">
             <Link to={`/course/${course.id}`} className="absolute inset-0 z-0 rounded-xl" aria-label={`View ${course.title}`}></Link>

             <div className="p-4 flex-1 pointer-events-none flex gap-4">
                {/* PDF Thumbnail */}
                {course.pdfThumbnail ? (
                  <div className="flex-shrink-0 w-20 h-28 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-sm">
                    <img src={course.pdfThumbnail} alt="PDF preview" className="w-full h-full object-cover" />
                  </div>
                ) : course.pdfName ? (
                  <div className="flex-shrink-0 w-20 h-28 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
                    <i className="fas fa-file-pdf text-2xl text-slate-300"></i>
                  </div>
                ) : null}

                {/* Content */}
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="flex justify-between items-start mb-2 pointer-events-auto">
                    <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded border border-slate-200">{course.code}</span>
                    <button onClick={(e) => {e.preventDefault(); e.stopPropagation(); setCourseToDelete(course)}} className="text-slate-300 hover:text-red-500 p-2 -mr-2 -mt-2 z-10 relative"><i className="fas fa-trash-alt"></i></button>
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-1 line-clamp-2">{course.title}</h4>
                  <div className="flex items-center gap-2 mb-2">
                     <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{course.semester}</span>
                     <p className="text-sm text-slate-500 line-clamp-1 truncate">{course.subtitle}</p>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-400 mt-auto">
                     <span className="flex items-center gap-1"><i className="fas fa-file-pdf"></i> {course.pdfName ? 'PDF' : 'No PDF'}</span>
                     <span className="flex items-center gap-1"><i className="fas fa-list"></i> {course.chapters.length} Ch</span>
                  </div>
                </div>
             </div>
             <div className="bg-slate-50 p-3 text-center text-sm font-bold text-primary border-t border-slate-100 rounded-b-xl pointer-events-none">
               Enter Course <i className="fas fa-arrow-right ml-1 text-xs"></i>
             </div>
          </div>
        ))}
        {filteredCourses.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400">
             No courses found for this semester.
          </div>
        )}
      </div>

      {/* Shared with Me Section */}
      {sharedCourses.length > 0 && (
        <div className="mb-10">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <i className="fas fa-share-alt text-green-500"></i>
            Shared with Me
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sharedCourses.map((shared) => (
              <div
                key={shared.shareId}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-green-200 dark:border-green-800 hover:shadow-md transition-all p-4"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center">
                    <i className="fas fa-book text-green-600 dark:text-green-400"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 truncate">{shared.courseTitle}</h4>
                    {shared.courseSubtitle && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{shared.courseSubtitle}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <i className="fas fa-user"></i>
                    <span>From: {shared.ownerName}</span>
                  </div>
                  <span className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded font-medium">
                    {shared.permission === 'copy' ? 'Can Copy' : 'View Only'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CourseDeleteModal
        course={courseToDelete}
        onClose={() => setCourseToDelete(null)}
        onConfirm={() => { if(courseToDelete) onDeleteCourse(courseToDelete.id); setCourseToDelete(null); }}
      />

      {/* Add Course Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Create New Course">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Code</label>
            <input
              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-primary outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              placeholder="BIO101"
              value={newCourse.code}
              onChange={e => setNewCourse({...newCourse, code: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Title</label>
            <input
              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-primary outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              placeholder="Intro to Biology"
              value={newCourse.title}
              onChange={e => setNewCourse({...newCourse, title: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Semester</label>
            <select
              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-primary outline-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
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
          <button onClick={() => setShowAddModal(false)} className="px-6 py-3 text-slate-500 dark:text-slate-400 font-bold">Cancel</button>
          <button onClick={handleCreate} disabled={!newCourse.title || !newCourse.code} className="px-6 py-3 bg-primary text-white rounded-lg font-bold shadow-md disabled:opacity-50">Create</button>
        </div>
      </Modal>

    </div>
  );
};

const CourseDeleteModal = ({ course, onClose, onConfirm }: { course: Course | null, onClose: () => void, onConfirm: () => void }) => {
  const [confirmName, setConfirmName] = useState("");
  
  if (!course) return null;

  const isMatch = confirmName === course.title;

  return (
    <Modal isOpen={!!course} onClose={onClose} title="Delete Course" maxWidth="max-w-md">
       <div className="p-4">
         <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-4 flex items-start gap-3">
            <i className="fas fa-exclamation-triangle text-red-500 mt-1"></i>
            <div>
              <h4 className="font-bold text-red-800 text-sm">Permanent Action</h4>
              <p className="text-xs text-red-600 mt-1 leading-relaxed">
                 This will permanently delete the course, textbook, chapters, and all generated study materials.
              </p>
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
           <button onClick={onClose} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
           <button 
             onClick={onConfirm} 
             disabled={!isMatch}
             className="px-6 py-2 bg-red-500 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-600 shadow-md transition-colors"
           >
             Delete Course
           </button>
         </div>
       </div>
    </Modal>
  );
};

const MaterialDeleteModal = ({ material, onClose, onConfirm }: { material: StudyMaterial | null, onClose: () => void, onConfirm: () => void }) => {
  if (!material) return null;

  return (
    <Modal isOpen={!!material} onClose={onClose} title="Delete Material" maxWidth="max-w-sm">
       <div className="p-4">
         <p className="text-slate-600 font-medium mb-6">
            Are you sure you want to delete <span className="font-bold text-slate-800">"{material.title}"</span>?
         </p>
         <div className="flex justify-end gap-3">
           <button onClick={onClose} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
           <button 
             onClick={onConfirm} 
             className="px-6 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 shadow-md transition-colors"
           >
             Delete
           </button>
         </div>
       </div>
    </Modal>
  );
};

// Simple Rename Modal
const RenameMaterialModal = ({ material, onClose, onConfirm }: { material: StudyMaterial | null, onClose: () => void, onConfirm: (newName: string) => void }) => {
  const [name, setName] = useState("");

  useEffect(() => {
    if (material) setName(material.title);
  }, [material]);

  if (!material) return null;

  return (
    <Modal isOpen={!!material} onClose={onClose} title="Rename Item" maxWidth="max-w-sm">
      <div className="p-4">
        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Title</label>
        <input 
          className="w-full p-2 border border-slate-300 rounded focus:ring-primary outline-none text-slate-900 font-bold"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-3 mt-6">
           <button onClick={onClose} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-lg">Cancel</button>
           <button onClick={() => onConfirm(name)} disabled={!name.trim()} className="px-6 py-2 bg-primary text-white rounded-lg font-bold shadow-md hover:bg-blue-600 disabled:opacity-50">Save</button>
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

const VisualDifficulty = ({ level }: { level: number }) => {
  const pct = Math.max(0, Math.min(100, ((level - 1) / 4) * 100));

  return (
    <div className="flex flex-col gap-1 w-24">
      <div className="h-2 w-full bg-slate-100 rounded-full relative overflow-hidden border border-slate-200">
         <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-yellow-400 to-red-500 opacity-80"></div>
         {/* Indicator Arrow */}
         <div 
           className="absolute top-0 bottom-0 w-1 bg-slate-900 shadow-sm" 
           style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
         ></div>
      </div>
      <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
         <span>Easy</span>
         <span>Hard</span>
      </div>
    </div>
  );
};

// --- UPDATED LIBRARY PANEL ---
export const LibraryPanel = ({ course, onUpdate, onUpdateFlashcard }: { course: Course, onUpdate: (c: Course) => void, onUpdateFlashcard: (cid: string, mid: string, c: Flashcard) => void }) => {
  const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterial | null>(null);
  const [materialToDelete, setMaterialToDelete] = useState<StudyMaterial | null>(null);
  const [materialToRename, setMaterialToRename] = useState<StudyMaterial | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { showToast } = useContext(ToastContext);

  // Group materials by Chapter
  const groupedMaterials = useMemo(() => {
     const groups: Record<string, StudyMaterial[]> = {};
     const mixed: StudyMaterial[] = [];
     const general: StudyMaterial[] = [];
     const subMap: Record<string, string> = {}; // Map Subchapter ID -> Parent Chapter ID

     // Init groups & build subchapter map
     course.chapters.forEach(ch => { 
         groups[ch.id] = []; 
         if (ch.subchapters) {
             ch.subchapters.forEach(sub => {
                 subMap[sub.id] = ch.id;
             });
         }
     });

     course.materials.forEach(mat => {
        if (!mat.sourceChapterIds || mat.sourceChapterIds.length === 0) {
           general.push(mat);
        } else if (mat.sourceChapterIds.length === 1) {
           const id = mat.sourceChapterIds[0];
           if (groups[id]) {
               groups[id].push(mat); // Direct match to Chapter
           } else if (subMap[id] && groups[subMap[id]]) {
               groups[subMap[id]].push(mat); // Match to Subchapter -> Add to Parent Chapter
           } else {
               general.push(mat); // Orphaned ID (Lecture or deleted chapter) fallback
           }
        } else {
           mixed.push(mat);
        }
     });

     return { groups, mixed, general };
  }, [course]);

  // Source Name Helper
  const getSourceDisplay = (mat: StudyMaterial) => {
      if (!mat.sourceChapterIds || mat.sourceChapterIds.length === 0) return "General Notes";
      
      const names = mat.sourceChapterIds.map(id => {
          const ch = course.chapters.find(c => c.id === id);
          if (ch) return `Ch ${course.chapters.indexOf(ch) + 1}`;
          
          // Check for subchapters
          for (const c of course.chapters) {
              const s = c.subchapters?.find(sub => sub.id === id);
              if (s) return `Ch ${course.chapters.indexOf(c) + 1}.${c.subchapters!.indexOf(s) + 1}`;
          }

          const lec = course.lectures.find(l => l.id === id);
          if (lec) return `Lecture`;
          return null;
      }).filter(Boolean);

      if (names.length === 0) return "General";
      if (names.length > 2) return `${names[0]} + ${names.length - 1} more`;
      return names.join(", ");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleMerge = () => {
    if (selectedIds.length < 2) return;
    const selectedMats = course.materials.filter(m => selectedIds.includes(m.id));
    
    // Validation
    const type = selectedMats[0].type;
    if (selectedMats.some(m => m.type !== type)) {
        showToast("Merge failed: Can only merge items of the same type.", "error");
        return;
    }
    if (type !== ContentType.FLASHCARDS && type !== ContentType.QUIZ && type !== ContentType.MOCK_TEST) {
        showToast("Merge failed: Only Flashcards and Quizzes can be merged.", "error");
        return;
    }

    // Combine & Shuffle
    const rawContent = selectedMats.flatMap(m => m.content as unknown as (Flashcard | Question)[]);
    const shuffledContent = shuffleArray(rawContent);
    
    // Dedupe for Flashcards based on front text
    let uniqueContent = shuffledContent;
    if (type === ContentType.FLASHCARDS) {
        const seen = new Set();
        uniqueContent = (shuffledContent as Flashcard[]).filter(c => {
            const dup = seen.has(c.front);
            seen.add(c.front);
            return !dup;
        });
    }

    // Determine target Source ID (To keep it in Chapter 1 if possible)
    const allSourceIds = selectedMats.flatMap(m => m.sourceChapterIds || []);
    // Map subchapter IDs to parent chapter IDs where applicable
    const normalizedSourceIds = allSourceIds.map(id => {
       // Check if it's a subchapter
       for (const ch of course.chapters) {
           if (ch.subchapters?.some(sub => sub.id === id)) return ch.id;
       }
       return id; // Return original if not a subchapter (e.g. it is a chapter ID or lecture ID)
    });
    
    const uniqueSourceIds = Array.from(new Set(normalizedSourceIds));
    const mergedSourceIds = uniqueSourceIds.length === 1 ? uniqueSourceIds : []; // If all from same parent chapter, keep it. Else mixed.

    // Calculate Average Difficulty
    const totalDiff = selectedMats.reduce((acc, m) => acc + (m.difficulty || Difficulty.MEDIUM), 0);
    const avgDiff = totalDiff / selectedMats.length;

    const newMat: StudyMaterial = {
        id: uuid(),
        type: type,
        title: `Merged: ${selectedMats[0].title} + ${selectedMats.length - 1} more`,
        createdAt: new Date().toISOString(),
        difficulty: avgDiff,
        content: uniqueContent as any,
        sourceChapterIds: mergedSourceIds // Use smart merged IDs
    };

    onUpdate({ ...course, materials: [newMat, ...course.materials] });
    setSelectedIds([]);
    showToast("Materials merged & shuffled successfully!");
  };

  const confirmDeleteMaterial = () => {
      if (materialToDelete) {
          const newMaterials = course.materials.filter(m => m.id !== materialToDelete.id);
          onUpdate({ ...course, materials: newMaterials });
          setMaterialToDelete(null);
          setSelectedMaterial(null);
          showToast("Study material deleted.");
      }
  };

  const confirmRenameMaterial = (newName: string) => {
      if (materialToRename && newName.trim()) {
          const updated = { ...materialToRename, title: newName.trim() };
          const newMaterials = course.materials.map(m => m.id === materialToRename.id ? updated : m);
          onUpdate({ ...course, materials: newMaterials });
          setMaterialToRename(null);
          showToast("Renamed successfully.");
      }
  };

  const handleShuffleMaterial = () => {
    if (!selectedMaterial) return;
    const content = selectedMaterial.content as any[];
    if (!content || content.length === 0) return;
    
    const shuffled = shuffleArray([...content]);
    const updatedMat = { ...selectedMaterial, content: shuffled };
    const newMaterials = course.materials.map(m => m.id === selectedMaterial.id ? updatedMat : m);
    
    onUpdate({ ...course, materials: newMaterials });
    setSelectedMaterial(updatedMat);
    showToast("Deck shuffled!");
  };

  const handleExport = (mat: StudyMaterial) => {
    let content = "";
    let filename = `${mat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`;
    let type = "text/csv;charset=utf-8;";

    if (mat.type === ContentType.FLASHCARDS) {
        const cards = mat.content as Flashcard[];
        // CSV format compatible with Anki: Front,Back
        content = cards.map(c => `"${c.front.replace(/"/g, '""')}","${c.back.replace(/"/g, '""')}"`).join("\n");
    } else if (mat.type === ContentType.QUIZ || mat.type === ContentType.MOCK_TEST) {
        const questions = mat.content as Question[];
        content = questions.map(q => 
            `Q: ${q.text}\nA: ${q.correctAnswer}\n${q.options ? 'Options: ' + q.options.join(', ') : ''}\n`
        ).join("\n---\n");
        filename = filename.replace('.csv', '.txt');
        type = "text/plain;charset=utf-8;";
    } else {
        content = mat.content as string;
        filename = filename.replace('.csv', '.txt');
        type = "text/plain;charset=utf-8;";
    }

    const dataStr = `data:${type},` + encodeURIComponent(content);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    showToast("Export downloaded!");
  };

  // Convert Quiz questions to Flashcards
  const handleSaveMissedToFlashcards = (missed: Question[]) => {
      if (!missed || missed.length === 0) return;

      const newFlashcards: Flashcard[] = missed.map(q => ({
          id: uuid(),
          front: q.text,
          back: `Answer: ${q.correctAnswer}\n\n${q.explanation || ''}`,
          source: q.source || `Quiz: ${selectedMaterial?.title || 'Unknown'}`,
          ...getInitialCardState(true)
      }));

      const newMat: StudyMaterial = {
          id: uuid(),
          type: ContentType.FLASHCARDS,
          title: `Flashcards from ${selectedMaterial?.title || 'Quiz'}`,
          createdAt: new Date().toISOString(),
          difficulty: selectedMaterial?.difficulty || Difficulty.MEDIUM,
          content: newFlashcards,
          sourceChapterIds: selectedMaterial?.sourceChapterIds || []
      };

      onUpdate({ ...course, materials: [newMat, ...course.materials] });
      showToast(`Created ${newFlashcards.length} flashcards from quiz questions!`);
  };

  const handleQuizComplete = (score: number) => {
      if (!selectedMaterial) return;
      const result: QuizResult = {
          date: new Date().toISOString(),
          score: score,
          total: (selectedMaterial.content as Question[]).length,
          chapterIds: selectedMaterial.sourceChapterIds,
          materialTitle: selectedMaterial.title
      };
      
      const newHistory = [...course.quizHistory, result];
      onUpdate({ ...course, quizHistory: newHistory });
      showToast(`Quiz completed! Score saved.`, "success");
  };

  const renderMaterialCard = (mat: StudyMaterial) => (
    <div key={mat.id} className={`group bg-white dark:bg-slate-800 p-5 rounded-xl border flex flex-col justify-between hover:shadow-lg transition-all relative overflow-hidden ${selectedIds.includes(mat.id) ? 'border-primary ring-2 ring-primary bg-blue-50/50 dark:bg-blue-900/30' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'}`}>
       
       <div className="flex justify-between items-start mb-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 shadow-sm ${
             mat.type === ContentType.FLASHCARDS ? 'bg-amber-100 text-amber-600' :
             mat.type === ContentType.QUIZ || mat.type === ContentType.MOCK_TEST ? 'bg-purple-100 text-purple-600' :
             mat.type === ContentType.CONCEPT_CONNECTIONS ? 'bg-cyan-100 text-cyan-600' : 'bg-blue-100 text-blue-600'
          }`}>
             <i className={`fas ${
                mat.type === ContentType.FLASHCARDS ? 'fa-bolt' :
                mat.type === ContentType.QUIZ || mat.type === ContentType.MOCK_TEST ? 'fa-question-circle' :
                mat.type === ContentType.CONCEPT_CONNECTIONS ? 'fa-share-nodes' : 'fa-align-left'
             }`}></i>
          </div>
          <div className="flex gap-2 z-10">
             <input 
               type="checkbox" 
               checked={selectedIds.includes(mat.id)}
               onChange={() => toggleSelect(mat.id)}
               className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
             />
          </div>
       </div>

       <div className="mb-4">
          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1 leading-snug line-clamp-2 pr-6" title={mat.title}>{mat.title}</h4>
          <div className="flex items-center gap-2 text-xs text-slate-400">
             <span>{formatDate(mat.createdAt)}</span>
             <span>•</span>
             <span className="font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 rounded">{getSourceDisplay(mat)}</span>
          </div>
       </div>

       <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50 dark:border-slate-700">
          <div className="flex flex-col items-start mr-auto">
             <VisualDifficulty level={mat.difficulty || Difficulty.MEDIUM} />
             <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">{getDifficultyLabel(mat.difficulty || Difficulty.MEDIUM)}</span>
          </div>

          <div className="flex gap-2 items-center">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMaterialToRename(mat); }}
              className="p-2 text-slate-300 dark:text-slate-500 hover:text-blue-500 transition-colors z-20"
              title="Rename"
              type="button"
            >
              <i className="fas fa-edit"></i>
            </button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMaterialToDelete(mat); }}
              className="p-2 text-slate-300 dark:text-slate-500 hover:text-red-500 transition-colors z-20"
              title="Delete"
              type="button"
            >
              <i className="fas fa-trash-alt"></i>
            </button>
            <button
              onClick={() => setSelectedMaterial(mat)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-primary hover:text-white text-slate-600 dark:text-slate-300 text-xs font-bold rounded transition-colors shadow-sm"
              type="button"
            >
              Open
            </button>
          </div>
       </div>
    </div>
  );

  if (selectedMaterial) {
    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden animate-fade-in">
           <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:justify-between md:items-center bg-slate-50 dark:bg-slate-800/50 gap-4">
             <div className="flex items-center gap-3">
               <button onClick={() => setSelectedMaterial(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"><i className="fas fa-arrow-left"></i></button>
               <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 line-clamp-1">{selectedMaterial.title}</h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{(selectedMaterial.type || 'UNKNOWN').replace('_', ' ')} • {(selectedMaterial.content as any[]).length || 0} items</div>
               </div>
             </div>
             <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <button
                    onClick={handleShuffleMaterial}
                    className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-bold rounded flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap"
                >
                    <i className="fas fa-random"></i> Shuffle
                </button>
                <button
                    onClick={() => handleExport(selectedMaterial)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs font-bold rounded flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap"
                >
                    <i className="fas fa-download"></i> Export
                </button>
                <button
                    onClick={() => setMaterialToDelete(selectedMaterial)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 text-xs font-bold rounded flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap"
                >
                    <i className="fas fa-trash-alt"></i> Delete
                </button>
                <div className="bg-slate-50 dark:bg-slate-700 px-3 py-1 rounded border border-slate-100 dark:border-slate-600 flex flex-col items-end whitespace-nowrap hidden sm:flex">
                    <VisualDifficulty level={selectedMaterial.difficulty || Difficulty.MEDIUM} />
                    <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{getDifficultyLabel(selectedMaterial.difficulty || Difficulty.MEDIUM)}</span>
                </div>
             </div>
           </div>
           <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50 dark:bg-slate-900/50">
              {selectedMaterial.type === ContentType.FLASHCARDS && (
                 <div className="h-full flex flex-col items-center justify-center">
                    <FlashcardViewer cards={selectedMaterial.content as unknown as Flashcard[]} />
                 </div>
              )}
              {(selectedMaterial.type === ContentType.QUIZ || selectedMaterial.type === ContentType.MOCK_TEST) && (
                 <QuizTaker 
                    questions={selectedMaterial.content as unknown as Question[]} 
                    onExit={() => setSelectedMaterial(null)} 
                    onSaveMissed={handleSaveMissedToFlashcards}
                    onComplete={handleQuizComplete}
                 />
              )}
              {(selectedMaterial.type === ContentType.NOTES || selectedMaterial.type === ContentType.MINDMAP || selectedMaterial.type === ContentType.ACTIVE_RECALL) && (
                 <div className="prose prose-slate dark:prose-invert max-w-none bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 mx-auto">
                    <pre className="whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-300 leading-relaxed">{(selectedMaterial.content as unknown as string)}</pre>
                 </div>
              )}
              {selectedMaterial.type === ContentType.CONCEPT_CONNECTIONS && (
                <div className="space-y-6 max-w-2xl mx-auto">
                  {(selectedMaterial.content as unknown as ConceptConnection[]).map((conn, idx) => (
                    <div key={conn.id || idx} className="p-6 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100">{conn.concept}</h4>
                        <span className="text-xs font-bold uppercase px-2 py-1 rounded bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 tracking-wide">
                          {conn.relationship}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {conn.relatedConcepts.map((rel, rIdx) => (
                          <div key={rIdx} className="px-3 py-1.5 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 rounded-lg text-sm font-medium border border-cyan-200 dark:border-cyan-800">
                            {rel}
                          </div>
                        ))}
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{conn.explanation}</p>
                      {conn.source && (
                        <p className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                          <i className="fas fa-book"></i> {conn.source}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
           </div>
           
           <MaterialDeleteModal 
              material={materialToDelete} 
              onClose={() => setMaterialToDelete(null)} 
              onConfirm={confirmDeleteMaterial} 
           />
        </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
       {/* Merge Bar - Fixed to viewport */}
       {selectedIds.length > 1 && (
         <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-slide-up border border-slate-700">
            <span className="font-bold text-sm">{selectedIds.length} Selected</span>
            <div className="w-px h-4 bg-slate-600"></div>
            <button onClick={handleMerge} className="text-sm font-bold hover:text-blue-300 transition-colors">
                <i className="fas fa-object-group mr-2"></i>Merge & Shuffle
            </button>
            <button onClick={() => setSelectedIds([])} className="ml-2 text-slate-400 hover:text-white transition-colors"><i className="fas fa-times"></i></button>
         </div>
       )}

       <div className="flex-1 overflow-y-auto space-y-6 pb-20 p-1">
         {course.materials.length === 0 && (
             <div className="text-center py-16 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/50">
               <i className="fas fa-inbox text-5xl mb-4 text-slate-300 dark:text-slate-600"></i>
               <p className="font-bold text-slate-500 dark:text-slate-400">Library is empty.</p>
               <p className="text-sm mt-1">Use the Generator tab to create study materials.</p>
             </div>
         )}

         {/* Chapter Sections */}
         {course.chapters.map((ch, idx) => {
             const mats = groupedMaterials.groups[ch.id];
             if (mats.length === 0) return null;

             return (
                 <details key={ch.id} open className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden" >
                    <summary className="flex items-center gap-3 cursor-pointer list-none p-4 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700">
                        <div className="w-6 h-6 rounded bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 flex items-center justify-center text-xs text-slate-400 group-open:bg-primary group-open:text-white group-open:border-primary transition-all">
                            <i className="fas fa-chevron-right transform group-open:rotate-90 transition-transform"></i>
                        </div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Chapter {idx + 1}: {ch.title}</span>
                        <div className="ml-auto text-xs font-bold text-slate-400 bg-white dark:bg-slate-600 px-2 py-1 rounded border border-slate-200 dark:border-slate-500 shadow-sm">{mats.length} Items</div>
                    </summary>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/30 dark:bg-slate-800/50">
                        {mats.map(renderMaterialCard)}
                    </div>
                 </details>
             );
         })}

         {/* Mixed Section */}
         {groupedMaterials.mixed.length > 0 && (
            <details open className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <summary className="flex items-center gap-3 cursor-pointer list-none p-4 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700">
                    <div className="w-6 h-6 rounded bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 flex items-center justify-center text-xs text-slate-400 group-open:bg-primary group-open:text-white group-open:border-primary transition-all">
                        <i className="fas fa-chevron-right transform group-open:rotate-90 transition-transform"></i>
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide"><i className="fas fa-layer-group mr-2 text-slate-400"></i>Combined / Mixed</span>
                    <div className="ml-auto text-xs font-bold text-slate-400 bg-white dark:bg-slate-600 px-2 py-1 rounded border border-slate-200 dark:border-slate-500 shadow-sm">{groupedMaterials.mixed.length} Items</div>
                </summary>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/30 dark:bg-slate-800/50">
                    {groupedMaterials.mixed.map(renderMaterialCard)}
                </div>
            </details>
         )}

         {/* General Section */}
         {groupedMaterials.general.length > 0 && (
            <details open className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <summary className="flex items-center gap-3 cursor-pointer list-none p-4 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700">
                    <div className="w-6 h-6 rounded bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 flex items-center justify-center text-xs text-slate-400 group-open:bg-primary group-open:text-white group-open:border-primary transition-all">
                        <i className="fas fa-chevron-right transform group-open:rotate-90 transition-transform"></i>
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide"><i className="fas fa-file-alt mr-2 text-slate-400"></i>General Notes</span>
                    <div className="ml-auto text-xs font-bold text-slate-400 bg-white dark:bg-slate-600 px-2 py-1 rounded border border-slate-200 dark:border-slate-500 shadow-sm">{groupedMaterials.general.length} Items</div>
                </summary>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/30 dark:bg-slate-800/50">
                    {groupedMaterials.general.map(renderMaterialCard)}
                </div>
            </details>
         )}
       </div>
       
       <MaterialDeleteModal 
          material={materialToDelete} 
          onClose={() => setMaterialToDelete(null)} 
          onConfirm={confirmDeleteMaterial} 
       />
       
       <RenameMaterialModal
          material={materialToRename}
          onClose={() => setMaterialToRename(null)}
          onConfirm={confirmRenameMaterial}
       />
    </div>
  );
};

export default App;
