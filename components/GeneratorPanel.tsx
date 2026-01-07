
import React, { useState, useContext, useMemo, useRef, useEffect } from 'react';
import { Course, ContentType, Difficulty, Flashcard, Question, StudyMaterial, Lecture, ConceptConnection, ChatMessage } from '../types';
import { generateContent, fixFlashcardContent, chatWithContext } from '../services/geminiService';
import { loadPdfDocument, extractTextFromRange } from '../services/pdfUtils';
import { getInitialCardState } from '../services/srs';
import { Modal } from './Modal';
import { QuizTaker } from './QuizTaker';
import { ToastContext } from '../App';
import { getPdfBlob } from '../services/storage';

const uuid = () => Math.random().toString(36).substring(2, 9);
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// --- Similarity Utils ---
const levenshtein = (a: string, b: string): number => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

const getSimilarity = (s1: string, s2: string): number => {
    const a = s1.toLowerCase().trim();
    const b = s2.toLowerCase().trim();
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    const dist = levenshtein(a, b);
    return 1 - (dist / maxLen);
};

const GenBtn = ({ icon, label, onClick, loading, status, disabled, badge, fullWidth }: any) => (
  <button
    onClick={onClick}
    disabled={loading || disabled}
    className={`relative flex flex-col items-center justify-center p-4 border rounded-xl transition-all group h-24 ${fullWidth ? 'col-span-2 md:col-span-3 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' : ''} ${
      disabled
        ? 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 opacity-60 cursor-not-allowed'
        : 'border-slate-200 dark:border-slate-600 hover:border-primary hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer'
    }`}
  >
    {loading && fullWidth ? (
       <div className="flex items-center gap-3">
          <i className="fas fa-circle-notch fa-spin text-primary"></i>
          <span className="text-slate-600 dark:text-slate-300 font-bold">{status}</span>
       </div>
    ) : loading ? (
      <>
        <i className="fas fa-circle-notch fa-spin text-primary mb-2"></i>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 animate-pulse text-center leading-tight px-1">{status}</span>
      </>
    ) : (
      <>
        <i className={`fas ${icon} mb-2 text-xl ${disabled ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400 group-hover:text-primary'}`}></i>
        <span className={`text-xs font-bold ${disabled ? 'text-slate-400' : 'text-slate-600 dark:text-slate-300 group-hover:text-primary'}`}>{label}</span>
      </>
    )}
    {badge && (
      <span className="absolute top-2 right-2 text-[8px] font-bold bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-300 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
        {badge}
      </span>
    )}
  </button>
);

export const FlashcardViewer = ({ cards, onFixCard }: { cards: Flashcard[], onFixCard?: (card: Flashcard) => void }) => {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (!cards || cards.length === 0) return (
    <div className="text-center py-10 px-4">
      <div className="text-slate-300 text-5xl mb-4"><i className="fas fa-layer-group"></i></div>
      <p className="text-slate-500 font-bold">No flashcards generated.</p>
      <p className="text-xs text-slate-400 mt-2">Try selecting more content or different source material.</p>
    </div>
  );

  // Safety check: if index out of bounds (e.g. after filter), reset to 0
  const safeIndex = index >= cards.length ? 0 : index;
  const card = cards[safeIndex];
  const isBroken = !card || !card.front || !card.back || !card.front.trim() || !card.back.trim();

  return (
    <div className="flex flex-col w-full h-full">
      {/* Card Area - Flex 1 ensures it fills all available space */}
      <div 
        className="flex-1 w-full relative cursor-pointer group perspective"
        style={{ perspective: '1000px' }}
        onClick={() => !isBroken && setFlipped(!flipped)}
      >
        <div 
          className="relative w-full h-full transition-transform duration-500"
          style={{ transformStyle: 'preserve-3d', transform: flipped && !isBroken ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          {/* Front */}
          <div
            className={`absolute inset-0 backface-hidden bg-white dark:bg-slate-800 border shadow-sm rounded-xl flex flex-col items-center justify-center p-8 text-center overflow-hidden ${card.isDuplicate ? 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/20' : 'border-slate-200 dark:border-slate-700'}`}
            style={{ backfaceVisibility: 'hidden' }}
          >
            {card.isDuplicate && (
                <div className="absolute top-3 right-3 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1 z-10">
                    <i className="fas fa-clone"></i> Duplicate Skipped
                </div>
            )}

            {isBroken ? (
               <div className="flex flex-col items-center text-amber-500">
                  <i className="fas fa-exclamation-triangle text-3xl mb-2"></i>
                  <h4 className="font-bold">Empty Card</h4>
                  <p className="text-xs text-slate-400 mt-1 mb-4">Content could not be generated.</p>
               </div>
            ) : (
               <>
                 <div className="overflow-y-auto w-full max-h-full flex flex-col items-center justify-center">
                    <h4 className={`text-2xl font-bold leading-relaxed ${card.isDuplicate ? 'text-slate-500 opacity-70' : 'text-slate-800 dark:text-slate-100'}`}>{card.front}</h4>
                 </div>
                 <span className="absolute bottom-6 text-sm text-slate-400 font-medium uppercase tracking-wider">Tap to Flip</span>
               </>
            )}
          </div>

          {/* Back */}
          <div
            className={`absolute inset-0 backface-hidden border shadow-sm rounded-xl flex flex-col items-center justify-center p-8 text-center ${card.isDuplicate ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800' : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'}`}
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
             <div className="overflow-y-auto w-full max-h-full">
                <h4 className={`text-xl font-medium leading-relaxed ${card.isDuplicate ? 'text-slate-600 dark:text-slate-400 opacity-80' : 'text-blue-900 dark:text-blue-100'}`}>{card.back}</h4>
                {card.source && (
                    <div className="mt-6 pt-4 border-t border-blue-100 dark:border-blue-800 w-full">
                        <p className={`text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1 ${card.isDuplicate ? 'text-slate-400' : 'text-blue-400'}`}>
                            <i className="fas fa-map-marker-alt"></i> {card.source}
                        </p>
                    </div>
                )}
             </div>
          </div>
        </div>
      </div>

      {/* Controls - Fixed height to prevent shifting */}
      <div className="flex-none h-16 flex items-center justify-center gap-6 mt-2">
        <button 
          onClick={(e) => { e.stopPropagation(); setFlipped(false); setIndex(Math.max(0, safeIndex - 1)); }}
          disabled={safeIndex === 0}
          className="p-3 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors"
        >
          <i className="fas fa-chevron-left text-slate-600 text-lg"></i>
        </button>
        <span className="text-base font-bold text-slate-500">{safeIndex + 1} / {cards.length}</span>
        <button 
          onClick={(e) => { e.stopPropagation(); setFlipped(false); setIndex(Math.min(cards.length - 1, safeIndex + 1)); }}
          disabled={safeIndex === cards.length - 1}
          className="p-3 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors"
        >
          <i className="fas fa-chevron-right text-slate-600 text-lg"></i>
        </button>
      </div>
    </div>
  );
};

export const GeneratorPanel = ({ course, onUpdate, onViewLecture }: { course: Course, onUpdate: (c: Course) => void, onViewLecture: (l: Lecture) => void }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [itemCount, setItemCount] = useState(10);
  const [mockCount, setMockCount] = useState(50);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<{type: ContentType, data: any} | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(false); // Controls filtering in preview
  const { showToast } = useContext(ToastContext);

  // Generation config modal state
  const [genConfigModal, setGenConfigModal] = useState<ContentType | null>(null);

  // Chat state (Pro feature)
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatContext, setChatContext] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (showChat && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [course.chatHistory, showChat]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Helper for content type labels
  const getContentTypeLabel = (type: ContentType) => {
    switch (type) {
      case ContentType.FLASHCARDS: return 'Flashcards';
      case ContentType.QUIZ: return 'Quiz Questions';
      case ContentType.MOCK_TEST: return 'Mock Test Questions';
      case ContentType.NOTES: return 'Summary Notes';
      case ContentType.CONCEPT_CONNECTIONS: return 'Concept Connections';
      default: return 'Items';
    }
  };

  const getDifficultyLabel = (d: Difficulty) => {
    if (d <= 1.5) return 'Easy';
    if (d <= 3.5) return 'Medium';
    return 'Hard';
  };

  const openGenConfig = (type: ContentType) => {
    if (selectedIds.length === 0) {
      showToast("Please select at least one chapter, section, or lecture.", "error");
      return;
    }
    setGenConfigModal(type);
  };

  const startGeneration = () => {
    if (genConfigModal) {
      handleGenerate(genConfigModal);
      setGenConfigModal(null);
    }
  };

  const handleGenerate = async (type: ContentType) => {
    if (selectedIds.length === 0) return alert("Please select at least one chapter, section, or lecture.");
    setGenerating(true);
    setStatus("Reading...");
    setPreview(null);
    setShowDuplicates(false); // Reset duplicate view
    
    try {
      let context = "";
      let totalChars = 0;
      
      // 1. Process PDF Content
      const selectedPdfItems: {title: string, start: number, end: number}[] = [];

      course.chapters.forEach(ch => {
        if (selectedIds.includes(ch.id)) {
            selectedPdfItems.push({ title: ch.title, start: ch.startPage, end: ch.endPage });
        } else if (ch.subchapters) {
            ch.subchapters.forEach(sub => {
                if (selectedIds.includes(sub.id)) {
                    selectedPdfItems.push({ title: sub.title, start: sub.startPage, end: sub.endPage });
                }
            });
        }
      });

      if (selectedPdfItems.length > 0) {
          if (course.pdfBlobId) {
            setStatus("Loading PDF...");
            const blob = await getPdfBlob(course.pdfBlobId);
            if (blob) {
              const blobUrl = URL.createObjectURL(blob);
              setStatus("Parsing PDF...");
              const doc = await loadPdfDocument(blobUrl);
              
              for (const item of selectedPdfItems) {
                if (item.start && item.end) {
                  const text = await extractTextFromRange(doc, item.start, item.end, (curr, tot) => {
                     setStatus(`Reading... ${Math.round((curr/tot)*100)}%`);
                  });
                  context += `\nSection: ${item.title}\n${text}\n`;
                }
              }
              URL.revokeObjectURL(blobUrl);
            }
          } else {
             context += selectedPdfItems.map(c => `[Text from ${c.title}]\n(No PDF loaded)`).join("\n");
          }
      }

      // 2. Process Lectures
      const selectedLectures = course.lectures.filter(l => selectedIds.includes(l.id));
      if (selectedLectures.length > 0) {
          context += selectedLectures.map(l => `\nSource: ${l.title}\n${l.transcript}\n`).join("\n");
      }
      
      totalChars = context.length;

      if (totalChars < 100) {
         showToast("Selected content is too short or empty.", "error");
         setGenerating(false);
         setStatus("");
         return;
      }

      setStatus(`Analyzed ${Math.floor(totalChars/1000)}k chars. Thinking...`);
      
      const requestedCount = type === ContentType.MOCK_TEST ? mockCount : itemCount;
      const data = await generateContent(context, type, difficulty, course.title, requestedCount);
      
      if (Array.isArray(data)) {
          if (data.length === 0) {
              showToast("AI returned no results. Try again.", "error");
          } else {
              // --- DUPLICATE DETECTION LOGIC ---
              if (type === ContentType.FLASHCARDS) {
                  setStatus("Checking duplicates...");
                  
                  // OPTIMIZATION: Scope duplicate check to selected chapters/sections only
                  const scopeIds = new Set<string>(selectedIds);
                  course.chapters.forEach(ch => {
                      if (selectedIds.includes(ch.id) && ch.subchapters) {
                          ch.subchapters.forEach(sub => scopeIds.add(sub.id));
                      }
                  });

                  // Fetch existing flashcards from SCOPE only to improve performance
                  // Check materials that match ANY of the scope IDs
                  const existingCards = course.materials
                      .filter(m => 
                          m.type === ContentType.FLASHCARDS && 
                          m.sourceChapterIds?.some(id => scopeIds.has(id))
                      )
                      .flatMap(m => m.content as Flashcard[]);

                  let duplicateCount = 0;
                  const processedData = (data as Flashcard[]).map(nc => {
                      const isDup = existingCards.some(ec => {
                          const simFront = getSimilarity(nc.front, ec.front);
                          // Only check back if front is also similar to avoid false positives on simple answers like "Yes"
                          // Actually, strict front similarity is usually enough for flashcards.
                          return simFront > 0.85; 
                      });
                      if (isDup) duplicateCount++;
                      return { ...nc, isDuplicate: isDup };
                  });

                  if (duplicateCount > 0) {
                      showToast(`Generated ${data.length} cards (${duplicateCount} duplicates found)`, "info");
                  }
                  
                  setPreview({ type, data: processedData });
              } else {
                  setPreview({ type, data });
              }
          }
      } else if (typeof data === 'string' && data.length > 0) {
          setPreview({ type, data });
      } else {
          showToast("Generation failed.", "error");
      }

    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Generation failed.", 'error');
    } finally {
      setGenerating(false);
      setStatus("");
    }
  };

  const saveMaterial = () => {
    if (!preview) return;
    
    // Filter duplicates based on checkbox
    let contentToSave = preview.data;
    if (preview.type === ContentType.FLASHCARDS && Array.isArray(preview.data)) {
        if (!showDuplicates) {
            contentToSave = (preview.data as Flashcard[]).filter(c => !c.isDuplicate);
        }
        
        // Remove transient isDuplicate flag and init SRS
        contentToSave = (contentToSave as Flashcard[]).map(({ isDuplicate, ...fc }) => ({
            ...fc,
            ...getInitialCardState(false)
        }));
    }

    if (Array.isArray(contentToSave) && contentToSave.length === 0) {
        showToast("No content to save (all items were duplicates).", "error");
        return;
    }

    // Auto-generate Title
    let baseTitle = "Mixed Content";
    const firstId = selectedIds[0];
    const ch = course.chapters.find(c => c.id === firstId);
    if (ch) baseTitle = `Ch: ${ch.title}`;
    else {
        let subFound = false;
        for (const c of course.chapters) {
            const s = c.subchapters?.find(sub => sub.id === firstId);
            if (s) {
                baseTitle = `Sec: ${s.title}`;
                subFound = true;
                break;
            }
        }
        if (!subFound) {
            const lec = course.lectures.find(l => l.id === firstId);
            if (lec) baseTitle = lec.title;
        }
    }
    
    if (selectedIds.length > 1) baseTitle += ` + ${selectedIds.length - 1} more`;
    if (baseTitle.length > 30) baseTitle = baseTitle.substring(0, 30) + "...";

    let typeLabel = 'Notes';
    if (preview.type === ContentType.FLASHCARDS) typeLabel = 'Flashcards';
    if (preview.type === ContentType.QUIZ) typeLabel = 'Quiz';
    if (preview.type === ContentType.MOCK_TEST) typeLabel = 'Mock Test';
    if (preview.type === ContentType.CONCEPT_CONNECTIONS) typeLabel = 'Concepts';

    const title = `${typeLabel}: ${baseTitle}`;

    const newMat: StudyMaterial = {
      id: uuid(),
      type: preview.type,
      title: title,
      createdAt: new Date().toISOString(),
      difficulty: difficulty,
      content: contentToSave,
      sourceChapterIds: selectedIds
    };
    onUpdate({ ...course, materials: [newMat, ...course.materials] });
    setPreview(null);
    setSelectedIds([]);
    showToast(`Saved ${Array.isArray(contentToSave) ? contentToSave.length : '1'} items to library!`);
  };

  // Helper to count visible items in preview
  const getVisibleCount = () => {
      if (!preview || !Array.isArray(preview.data)) return 0;
      if (preview.type !== ContentType.FLASHCARDS) return preview.data.length;
      return showDuplicates ? preview.data.length : preview.data.filter((c: Flashcard) => !c.isDuplicate).length;
  };

  const duplicateCount = preview && Array.isArray(preview.data)
      ? preview.data.filter((c: any) => c.isDuplicate).length
      : 0;

  // --- Chat Functions (Pro Feature) ---
  const handleOpenChat = async () => {
    if (selectedIds.length === 0) {
      showToast("Select chapters/lectures to chat about", "error");
      return;
    }

    setChatLoading(true);
    setShowChat(true);

    try {
      let context = "";

      // Build context from selected items
      const selectedPdfItems: {title: string, start: number, end: number}[] = [];

      course.chapters.forEach(ch => {
        if (selectedIds.includes(ch.id)) {
          selectedPdfItems.push({ title: ch.title, start: ch.startPage, end: ch.endPage });
        } else if (ch.subchapters) {
          ch.subchapters.forEach(sub => {
            if (selectedIds.includes(sub.id)) {
              selectedPdfItems.push({ title: sub.title, start: sub.startPage, end: sub.endPage });
            }
          });
        }
      });

      if (selectedPdfItems.length > 0 && course.pdfBlobId) {
        const blob = await getPdfBlob(course.pdfBlobId);
        if (blob) {
          const blobUrl = URL.createObjectURL(blob);
          const doc = await loadPdfDocument(blobUrl);

          for (const item of selectedPdfItems) {
            if (item.start && item.end) {
              const text = await extractTextFromRange(doc, item.start, item.end);
              context += `\nSection: ${item.title}\n${text}\n`;
            }
          }
          URL.revokeObjectURL(blobUrl);
        }
      }

      // Add lectures
      const selectedLectures = course.lectures.filter(l => selectedIds.includes(l.id));
      if (selectedLectures.length > 0) {
        context += selectedLectures.map(l => `\nLecture: ${l.title}\n${l.transcript}\n`).join("\n");
      }

      setChatContext(context);
    } catch (e) {
      console.error("Error loading chat context:", e);
      showToast("Error loading content", "error");
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage: ChatMessage = {
      id: uuid(),
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toISOString()
    };

    // Add user message immediately
    const updatedHistory = [...(course.chatHistory || []), userMessage];
    onUpdate({ ...course, chatHistory: updatedHistory });
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await chatWithContext(
        userMessage.content,
        chatContext,
        course.title,
        updatedHistory.map(m => ({ role: m.role, content: m.content }))
      );

      const assistantMessage: ChatMessage = {
        id: uuid(),
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      };

      onUpdate({ ...course, chatHistory: [...updatedHistory, assistantMessage] });
    } catch (e) {
      showToast("Failed to get response", "error");
    } finally {
      setChatLoading(false);
    }
  };

  const clearChatHistory = () => {
    onUpdate({ ...course, chatHistory: [] });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-8">
        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4 flex items-center"><i className="fas fa-robot text-primary mr-2"></i>AI Study Generator</h3>

        {/* Selection */}
        <div className="mb-6">
          <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">1. Select Source Material</label>
          <div className="border border-slate-200 dark:border-slate-600 rounded-lg max-h-64 overflow-y-auto bg-slate-50 dark:bg-slate-700/50 p-2 space-y-3">

            {/* Chapters Section */}
            {course.chapters.length > 0 && (
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-1 mt-1">Textbook Chapters</div>
                {course.chapters.map((ch, idx) => (
                  <div key={ch.id}>
                    {/* Parent Chapter */}
                    <label className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-slate-600 rounded cursor-pointer transition-colors">
                      <input type="checkbox" checked={selectedIds.includes(ch.id)} onChange={() => toggleSelection(ch.id)} className="rounded text-primary focus:ring-primary" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200"><span className="text-slate-400 mr-1">Ch.{idx + 1}</span> {ch.title}</span>
                      <span className="text-xs text-slate-400 ml-auto bg-slate-100 dark:bg-slate-600 px-2 py-0.5 rounded">pp. {ch.startPage}-{ch.endPage}</span>
                    </label>

                    {/* Subchapters */}
                    {ch.subchapters && ch.subchapters.map((sub, sIdx) => (
                        <label key={sub.id} className="flex items-center gap-3 p-2 pl-8 hover:bg-white dark:hover:bg-slate-600 rounded cursor-pointer transition-colors border-l-2 border-slate-100 dark:border-slate-600 ml-2">
                           <input type="checkbox" checked={selectedIds.includes(sub.id)} onChange={() => toggleSelection(sub.id)} className="rounded text-blue-400 focus:ring-blue-400" />
                           <span className="text-sm font-medium text-slate-600 dark:text-slate-300 text-xs"><span className="text-slate-300 dark:text-slate-500 mr-1">{idx+1}.{sIdx+1}</span> {sub.title}</span>
                           <span className="text-[10px] text-slate-400 ml-auto border border-slate-200 dark:border-slate-500 px-1 rounded">{sub.startPage}-{sub.endPage}</span>
                        </label>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Notes/Lectures Section */}
            {course.lectures.length > 0 && (
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-1 mt-2">Notes & Lectures</div>
                {course.lectures.map((lec) => (
                  <div key={lec.id} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-slate-600 rounded transition-colors group">
                    <label className="flex items-center gap-3 flex-1 cursor-pointer">
                        <input type="checkbox" checked={selectedIds.includes(lec.id)} onChange={() => toggleSelection(lec.id)} className="rounded text-primary focus:ring-primary" />
                        <i className={`fas ${lec.sourceType === 'upload' ? 'fa-file-alt text-amber-500' : 'fa-microphone text-purple-500'} w-4`}></i>
                        <div className="flex-1 min-w-0">
                           <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{lec.title}</div>
                           <div className="text-[10px] text-slate-400">{formatDate(lec.date)}</div>
                        </div>
                    </label>
                    <button
                       onClick={(e) => { e.stopPropagation(); onViewLecture(lec); }}
                       className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-600 rounded opacity-0 group-hover:opacity-100 transition-all"
                       title="View/Play"
                    >
                        <i className="fas fa-eye"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {course.chapters.length === 0 && course.lectures.length === 0 && (
               <div className="text-sm text-slate-400 p-2 text-center">No content available. Add Chapters or Import Notes.</div>
            )}

          </div>
        </div>

        {/* AI Tutor Button - Moved to top, right under selection */}
        <div className="mb-6">
          <button
            onClick={handleOpenChat}
            disabled={generating || selectedIds.length === 0}
            className="w-full flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
          >
            <i className="fas fa-comments"></i>
            <span>Ask AI Tutor</span>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wide">Pro</span>
          </button>
          <p className="text-[10px] text-slate-400 text-center mt-2">Chat with AI about your selected content</p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-600"></div>
          <span className="text-xs font-bold text-slate-400 uppercase">Or Generate Study Materials</span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-600"></div>
        </div>

        {/* Action Buttons - Now open config modal */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <GenBtn icon="fa-bolt" label="Flashcards" onClick={() => openGenConfig(ContentType.FLASHCARDS)} loading={generating} status={status} />
          <GenBtn icon="fa-question-circle" label="Quiz" onClick={() => openGenConfig(ContentType.QUIZ)} loading={generating} status={status} />
          <GenBtn icon="fa-align-left" label="Summary" onClick={() => openGenConfig(ContentType.NOTES)} loading={generating} status={status} />
          <GenBtn icon="fa-share-nodes" label="Concepts" onClick={() => openGenConfig(ContentType.CONCEPT_CONNECTIONS)} loading={generating} status={status} />

          <GenBtn
             icon="fa-file-signature"
             label="Generate Mock Test"
             onClick={() => openGenConfig(ContentType.MOCK_TEST)}
             loading={generating}
             status={status}
             badge="Pro"
             fullWidth
          />
        </div>
      </div>

      {/* Generation Config Modal */}
      <Modal isOpen={!!genConfigModal} onClose={() => setGenConfigModal(null)} title="Configure Generation" maxWidth="max-w-md">
        <div className="space-y-6">
          {/* Preview Message */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100 rounded-xl p-5 text-center">
            <div className="text-3xl font-bold text-slate-800 mb-1">
              {genConfigModal === ContentType.MOCK_TEST ? mockCount : itemCount}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-bold text-primary">{getDifficultyLabel(difficulty)}</span>
              {' '}
              {genConfigModal && getContentTypeLabel(genConfigModal)}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              from {selectedIds.length} selected source{selectedIds.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Item Count Slider */}
          {genConfigModal !== ContentType.NOTES && (
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  {genConfigModal === ContentType.MOCK_TEST ? 'Number of Questions' : 'Number of Items'}
                </label>
                <span className="text-sm font-bold text-primary">
                  {genConfigModal === ContentType.MOCK_TEST ? mockCount : itemCount}
                </span>
              </div>
              {genConfigModal === ContentType.MOCK_TEST ? (
                <input
                  type="range"
                  min="50"
                  max="200"
                  step="10"
                  value={mockCount}
                  onChange={e => setMockCount(Number(e.target.value))}
                  className="w-full accent-purple-600 h-2 bg-slate-200 rounded-full appearance-none cursor-pointer"
                />
              ) : (
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="5"
                  value={itemCount}
                  onChange={e => setItemCount(Number(e.target.value))}
                  className="w-full accent-primary h-2 bg-slate-200 rounded-full appearance-none cursor-pointer"
                />
              )}
            </div>
          )}

          {/* Difficulty Slider */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Difficulty Level</label>
              <span className="text-sm font-bold text-primary">{getDifficultyLabel(difficulty)}</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="2"
              value={difficulty}
              onChange={e => setDifficulty(Number(e.target.value))}
              className="w-full accent-primary h-2 bg-slate-200 rounded-full appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Easy</span>
              <span>Medium</span>
              <span>Hard</span>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={startGeneration}
            className="w-full py-4 bg-primary hover:bg-blue-600 text-white rounded-xl font-bold text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <i className="fas fa-magic"></i>
            Generate {genConfigModal && getContentTypeLabel(genConfigModal)}
          </button>
        </div>
      </Modal>

      {/* AI Chat Modal (Pro) */}
      <Modal isOpen={showChat} onClose={() => setShowChat(false)} title="AI Tutor Chat" maxWidth="max-w-2xl">
        <div className="flex flex-col h-[60vh]">
          {/* Chat Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <i className="fas fa-book-open"></i>
              <span>Context: {selectedIds.length} item(s) selected</span>
            </div>
            {(course.chatHistory?.length || 0) > 0 && (
              <button
                onClick={clearChatHistory}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors"
              >
                <i className="fas fa-trash mr-1"></i> Clear History
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {(!course.chatHistory || course.chatHistory.length === 0) && !chatLoading && (
              <div className="text-center py-12 text-slate-400">
                <i className="fas fa-robot text-4xl mb-3 text-slate-300"></i>
                <p className="font-medium">Ask me anything about the selected material!</p>
                <p className="text-sm mt-1">I'll only answer based on what you've selected.</p>
              </div>
            )}

            {course.chatHistory?.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-primary text-white rounded-br-md'
                      : 'bg-slate-100 text-slate-700 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 p-3 rounded-2xl rounded-bl-md">
                  <i className="fas fa-circle-notch fa-spin text-primary"></i>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="pt-3 border-t border-slate-200 mt-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
                placeholder="Ask a question about the material..."
                className="flex-1 p-3 border border-slate-300 rounded-xl focus:border-primary focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                disabled={chatLoading || !chatContext}
              />
              <button
                onClick={handleSendChat}
                disabled={chatLoading || !chatInput.trim() || !chatContext}
                className="px-5 py-3 bg-primary text-white rounded-xl font-bold disabled:opacity-50 hover:bg-blue-600 transition-colors"
              >
                <i className="fas fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal isOpen={!!preview} onClose={() => setPreview(null)} title="Preview Generated Content" maxWidth="max-w-3xl">
        <div className={`bg-slate-50 p-4 rounded border border-slate-200 mb-4 h-[60vh] ${preview?.type === ContentType.FLASHCARDS ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
          {preview?.type === ContentType.FLASHCARDS && (
            <div className="w-full h-full">
              <FlashcardViewer 
                  cards={showDuplicates ? (preview.data as Flashcard[]) : (preview.data as Flashcard[]).filter(c => !c.isDuplicate)} 
              />
            </div>
          )}
          {(preview?.type === ContentType.QUIZ || preview?.type === ContentType.MOCK_TEST) && (
            <QuizTaker 
              questions={preview.data as Question[]} 
              onComplete={() => {}} 
              mode="preview"
            />
          )}
          {(preview?.type === ContentType.NOTES || preview?.type === ContentType.MINDMAP || preview?.type === ContentType.ACTIVE_RECALL) && (
             <div className="prose max-w-none">
               <pre className="whitespace-pre-wrap font-sans text-slate-700 text-sm">{preview.data as string}</pre>
             </div>
           )}
          {preview?.type === ContentType.CONCEPT_CONNECTIONS && (
            <div className="space-y-4">
              {(preview.data as ConceptConnection[]).map((conn, idx) => (
                <div key={conn.id || idx} className="p-5 border border-slate-200 rounded-xl bg-white shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-lg font-bold text-slate-800">{conn.concept}</h4>
                    <span className="text-xs font-bold uppercase px-2 py-1 rounded bg-cyan-100 text-cyan-700 tracking-wide">
                      {conn.relationship}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {conn.relatedConcepts.map((rel, rIdx) => (
                      <span key={rIdx} className="px-3 py-1.5 bg-cyan-50 text-cyan-700 rounded-lg text-sm font-medium border border-cyan-200">
                        {rel}
                      </span>
                    ))}
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">{conn.explanation}</p>
                  {conn.source && (
                    <p className="text-xs text-slate-400 font-bold uppercase mt-3 pt-3 border-t border-slate-100 flex items-center gap-1">
                      <i className="fas fa-book"></i> {conn.source}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer with Dupe Control */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div className="flex items-center gap-4">
              <button 
                onClick={() => handleGenerate(preview!.type)} 
                className="text-primary hover:text-blue-700 font-bold text-sm flex items-center"
                disabled={generating}
              >
                <i className={`fas fa-sync-alt mr-2 ${generating ? 'fa-spin' : ''}`}></i> Regenerate
              </button>
              
              {duplicateCount > 0 && preview?.type === ContentType.FLASHCARDS && (
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={showDuplicates} 
                        onChange={() => setShowDuplicates(!showDuplicates)} 
                        className="rounded text-amber-500 focus:ring-amber-500"
                      />
                      Include {duplicateCount} skipped duplicates
                  </label>
              )}
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setPreview(null)} className="px-4 py-2 text-slate-500 font-medium">Discard</button>
            <button onClick={saveMaterial} className="px-6 py-2 bg-primary text-white rounded font-bold hover:bg-blue-600 shadow-sm whitespace-nowrap">
                Save to Library
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
