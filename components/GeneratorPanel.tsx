
import React, { useState, useContext, useMemo, useRef, useEffect } from 'react';
import {
  Loader2, Layers, Bot, StickyNote, FileText, Plus, Trash2, Move, X, Eye, ArrowRight,
  MessageSquare, Zap, HelpCircle, AlignLeft, Share2, FileSignature, Brain,
  Info, Sparkles, BookOpen, Trash, Send, RefreshCw, ArrowsUpFromLine, PlusCircle,
  File, CloudUpload, BookMarked, Mic, Calculator, Lightbulb
} from 'lucide-react';
import { Course, ContentType, Difficulty, Flashcard, Question, StudyMaterial, Lecture, ConceptConnection, ChatMessage, PracticeProblem, Mnemonic } from '../types';
import { generateContent, fixFlashcardContent, chatWithContext, generateExamFromMaterials } from '../services/geminiService';
import { loadPdfDocument, extractTextFromRange } from '../services/pdfUtils';
import { getInitialCardState } from '../services/srs';
import { getSimilarity } from '../services/textSimilarity';
import { Modal } from './Modal';
import { QuizTaker } from './QuizTaker';
import { GenBtn } from './GenBtn';
import { FlashcardViewer } from './FlashcardViewer';
import { PracticeProblemsViewer } from './PracticeProblemsViewer';
import { MnemonicsViewer } from './MnemonicsViewer';
import { ToastContext } from '../App';
import { getPdfBlob } from '../services/storage';
import { canGenerate, deductCredit, hasFeatureAccess, getCreditsInfo } from '../services/subscriptionService';
import { FEATURES } from '../services/stripeConfig';

const uuid = () => Math.random().toString(36).substring(2, 9);
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Re-export FlashcardViewer for backwards compatibility
export { FlashcardViewer } from './FlashcardViewer';

export const GeneratorPanel = ({ course, onUpdate, onViewLecture, userId, onChapterFocus }: { course: Course, onUpdate: (c: Course) => void, onViewLecture: (l: Lecture) => void, userId?: string, onChapterFocus?: (startPage: number) => void }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [itemCount, setItemCount] = useState(10);
  const [mockCount, setMockCount] = useState(50);
  const [useSmartExam, setUseSmartExam] = useState(true); // Use existing materials for exams
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<{type: ContentType, data: any} | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(false); // Controls filtering in preview
  const { showToast } = useContext(ToastContext);

  // Generation config modal state
  const [genConfigModal, setGenConfigModal] = useState<ContentType | null>(null);

  // Move lecture modal state
  const [movingLecture, setMovingLecture] = useState<Lecture | null>(null);
  const [moveTargetChapter, setMoveTargetChapter] = useState<string>('');
  const [moveTargetSubchapter, setMoveTargetSubchapter] = useState<string>('');

  // Delete confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'lecture' | 'chapter' | 'subchapter' | 'chapter_notes' | 'subchapter_notes';
    id: string;
    parentId?: string; // for subchapter/subchapter notes
    title: string;
  } | null>(null);

  // Quick import (pre-selected chapter)
  const [quickImportChapterId, setQuickImportChapterId] = useState<string | null>(null);

  // Subscription status
  const [userStatus, setUserStatus] = useState<'free' | 'pro'>('free');

  // Load user subscription status
  useEffect(() => {
    if (userId) {
      getCreditsInfo(userId).then(info => {
        setUserStatus(info.status);
      });
    }
  }, [userId]);
  const [quickImportFile, setQuickImportFile] = useState<File | null>(null);
  const [quickImportLoading, setQuickImportLoading] = useState(false);
  const [quickImportTitle, setQuickImportTitle] = useState('');
  const [quickImportCreateSection, setQuickImportCreateSection] = useState(false);
  const [quickImportSectionTitle, setQuickImportSectionTitle] = useState('');
  const [quickImportCreateNewChapter, setQuickImportCreateNewChapter] = useState(false);
  const [quickImportNewChapterTitle, setQuickImportNewChapterTitle] = useState('');

  // Move notes state
  const [movingNotes, setMovingNotes] = useState<{
    type: 'chapter' | 'subchapter';
    chapterId: string;
    subchapterId?: string;
    notes: string;
    title: string;
    notesTitle?: string; // Preserve custom note name
  } | null>(null);
  const [moveNotesTarget, setMoveNotesTarget] = useState<string>('');
  const [moveNotesSubTarget, setMoveNotesSubTarget] = useState<string>('');

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
    // Find if this is a chapter with subchapters
    const chapter = course.chapters.find(ch => ch.id === id);
    const hasSubchapters = chapter && chapter.subchapters && chapter.subchapters.length > 0;

    // Check if this is a subchapter with notes
    let subchapter: { id: string; notes?: string; isNotesOnly?: boolean } | undefined = undefined;
    for (const ch of course.chapters) {
      const sub = ch.subchapters?.find(s => s.id === id);
      if (sub) {
        subchapter = sub;
        break;
      }
    }
    const subHasNotes = subchapter && subchapter.notes && !subchapter.isNotesOnly;

    setSelectedIds(prev => {
      const isCurrentlySelected = prev.includes(id);

      if (isCurrentlySelected) {
        // Deselecting
        let newIds = prev.filter(i => i !== id);

        // If this is a chapter, also deselect all subchapters and their notes
        if (hasSubchapters) {
          const subIds = chapter.subchapters!.map(sub => sub.id);
          const noteIds = chapter.subchapters!.filter(sub => sub.notes && !sub.isNotesOnly).map(sub => `${sub.id}_notes`);
          newIds = newIds.filter(i => !subIds.includes(i) && !noteIds.includes(i));
        }

        // If chapter has notes, also deselect chapter notes
        if (chapter && chapter.notes && !chapter.isNotesOnly) {
          newIds = newIds.filter(i => i !== `${id}_notes`);
        }

        // If this is a subchapter with notes, also deselect its notes
        if (subHasNotes) {
          newIds = newIds.filter(i => i !== `${id}_notes`);
        }

        return newIds;
      } else {
        // Selecting
        let newIds = [...prev, id];

        // If this is a chapter, also select all subchapters and their notes
        if (hasSubchapters) {
          const subIds = chapter.subchapters!.map(sub => sub.id);
          const noteIds = chapter.subchapters!.filter(sub => sub.notes && !sub.isNotesOnly).map(sub => `${sub.id}_notes`);
          newIds = [...newIds, ...subIds.filter(subId => !newIds.includes(subId)), ...noteIds.filter(nId => !newIds.includes(nId))];
        }

        // If chapter has notes, also select chapter notes
        if (chapter && chapter.notes && !chapter.isNotesOnly) {
          if (!newIds.includes(`${id}_notes`)) {
            newIds.push(`${id}_notes`);
          }
        }

        // If this is a subchapter with notes, also select its notes
        if (subHasNotes) {
          if (!newIds.includes(`${id}_notes`)) {
            newIds.push(`${id}_notes`);
          }
        }

        return newIds;
      }
    });
  };

  // Helper for content type labels
  const getContentTypeLabel = (type: ContentType) => {
    switch (type) {
      case ContentType.FLASHCARDS: return 'Flashcards';
      case ContentType.QUIZ: return 'Quiz Questions';
      case ContentType.MOCK_TEST: return 'Mock Test Questions';
      case ContentType.NOTES: return 'Summary Notes';
      case ContentType.CONCEPT_CONNECTIONS: return 'Concept Connections';
      case ContentType.PRACTICE_PROBLEMS: return 'Practice Problems';
      case ContentType.MNEMONICS: return 'Mnemonics';
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

    // Check feature access for Pro-only features
    if (userId) {
      const isProFeature = type === ContentType.CONCEPT_CONNECTIONS || type === ContentType.MOCK_TEST;
      if (isProFeature && userStatus !== 'pro') {
        showToast(`${type === ContentType.CONCEPT_CONNECTIONS ? 'Concept Maps' : 'Mock Tests'} are a Pro feature. Upgrade to access.`, 'error');
        return;
      }

      // Check if user has credits available
      const creditCheck = await canGenerate(userId);
      if (!creditCheck.allowed) {
        showToast(creditCheck.reason || 'No credits available', 'error');
        return;
      }
    }

    setGenerating(true);
    setStatus("Reading...");
    setPreview(null);
    setShowDuplicates(false); // Reset duplicate view

    try {
      let context = "";
      let totalChars = 0;
      
      // 1. Process PDF Content AND Notes
      const selectedPdfItems: {title: string, start?: number, end?: number}[] = [];
      const selectedNotesItems: {title: string, notes: string}[] = [];

      course.chapters.forEach(ch => {
        if (selectedIds.includes(ch.id)) {
            // Check if it's a notes-only chapter
            if (ch.isNotesOnly && ch.notes) {
                selectedNotesItems.push({ title: ch.title, notes: ch.notes });
            } else if (ch.startPage && ch.endPage) {
                selectedPdfItems.push({ title: ch.title, start: ch.startPage, end: ch.endPage });
            }
        }

        // Check if chapter notes are separately selected (for non-notes-only chapters)
        if (!ch.isNotesOnly && ch.notes && selectedIds.includes(`${ch.id}_notes`)) {
            selectedNotesItems.push({ title: `${ch.title} Notes`, notes: ch.notes });
        }

        // Process subchapters
        if (ch.subchapters) {
            ch.subchapters.forEach(sub => {
                if (selectedIds.includes(sub.id)) {
                    if (sub.isNotesOnly && sub.notes) {
                        selectedNotesItems.push({ title: sub.title, notes: sub.notes });
                    } else if (sub.startPage && sub.endPage) {
                        selectedPdfItems.push({ title: sub.title, start: sub.startPage, end: sub.endPage });
                    }
                }

                // Check if subchapter notes are separately selected (for non-notes-only subchapters)
                if (!sub.isNotesOnly && sub.notes && selectedIds.includes(`${sub.id}_notes`)) {
                    selectedNotesItems.push({ title: `${sub.title} Notes`, notes: sub.notes });
                }
            });
        }
      });

      // Add notes content first
      if (selectedNotesItems.length > 0) {
          setStatus("Processing notes...");
          selectedNotesItems.forEach(item => {
              context += `\nSection: ${item.title}\n${item.notes}\n`;
          });
      }

      // Then add PDF content
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

      let data: any;

      // Use smart exam generation for mock tests if enabled and have existing materials
      if (type === ContentType.MOCK_TEST && useSmartExam) {
        // Collect existing flashcards and questions from ALL course materials
        const allFlashcards: { front: string; back: string; source?: string }[] = [];
        const allQuestions: { text: string; correctAnswer: string; type: string; source?: string }[] = [];

        course.materials.forEach(mat => {
          if (mat.type === ContentType.FLASHCARDS && Array.isArray(mat.content)) {
            (mat.content as Flashcard[]).forEach(fc => {
              allFlashcards.push({ front: fc.front, back: fc.back, source: fc.source });
            });
          }
          if ((mat.type === ContentType.QUIZ || mat.type === ContentType.MOCK_TEST) && Array.isArray(mat.content)) {
            (mat.content as Question[]).forEach(q => {
              allQuestions.push({ text: q.text, correctAnswer: q.correctAnswer, type: q.type, source: q.source });
            });
          }
        });

        const totalMaterials = allFlashcards.length + allQuestions.length;

        if (totalMaterials >= 10) {
          setStatus(`Using ${allFlashcards.length} flashcards + ${allQuestions.length} questions for smart exam...`);
          try {
            data = await generateExamFromMaterials(allFlashcards, allQuestions, course.title, requestedCount, difficulty);
          } catch (error: any) {
            if (error.message === "INSUFFICIENT_MATERIALS") {
              showToast("Not enough existing materials. Generate flashcards and quizzes first.", "error");
              setGenerating(false);
              setStatus("");
              return;
            }
            throw error;
          }
        } else {
          // Fall back to standard generation with warning
          setStatus("Not enough materials - using standard generation...");
          showToast(`Only ${totalMaterials} items found. Generate more flashcards/quizzes for better exams.`, "info");
          data = await generateContent(context, type, difficulty, course.title, requestedCount);
        }
      } else {
        data = await generateContent(context, type, difficulty, course.title, requestedCount);
      }
      
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

      // Deduct credit after successful generation
      if (userId && (Array.isArray(data) ? data.length > 0 : (typeof data === 'string' && data.length > 0))) {
        try {
          await deductCredit(userId);
        } catch (e) {
          console.warn('Failed to deduct credit:', e);
        }
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
    if (preview.type === ContentType.CONCEPT_CONNECTIONS) typeLabel = 'Concept Connections';
    if (preview.type === ContentType.PRACTICE_PROBLEMS) typeLabel = 'Practice Problems';
    if (preview.type === ContentType.MNEMONICS) typeLabel = 'Mnemonics';

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

      // Build context from selected items (PDF + Notes)
      const selectedPdfItems: {title: string, start?: number, end?: number}[] = [];
      const selectedNotesItems: {title: string, notes: string}[] = [];

      course.chapters.forEach(ch => {
        if (selectedIds.includes(ch.id)) {
          if (ch.isNotesOnly && ch.notes) {
            selectedNotesItems.push({ title: ch.title, notes: ch.notes });
          } else if (ch.startPage && ch.endPage) {
            selectedPdfItems.push({ title: ch.title, start: ch.startPage, end: ch.endPage });
          }
          if (!ch.isNotesOnly && ch.notes) {
            selectedNotesItems.push({ title: `${ch.title} (Notes)`, notes: ch.notes });
          }
        }
        if (ch.subchapters) {
          ch.subchapters.forEach(sub => {
            if (selectedIds.includes(sub.id)) {
              if (sub.isNotesOnly && sub.notes) {
                selectedNotesItems.push({ title: sub.title, notes: sub.notes });
              } else if (sub.startPage && sub.endPage) {
                selectedPdfItems.push({ title: sub.title, start: sub.startPage, end: sub.endPage });
              }
              if (!sub.isNotesOnly && sub.notes) {
                selectedNotesItems.push({ title: `${sub.title} (Notes)`, notes: sub.notes });
              }
            }
          });
        }
      });

      // Add notes to context
      selectedNotesItems.forEach(item => {
        context += `\nSection: ${item.title}\n${item.notes}\n`;
      });

      // Add PDF content
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

  const handleMoveLecture = () => {
    if (!movingLecture || !moveTargetChapter) return;

    const lectureContent = movingLecture.transcript;
    const lectureTitle = movingLecture.title;

    // Update chapters to add notes
    const updatedChapters = course.chapters.map(ch => {
      if (ch.id === moveTargetChapter) {
        if (moveTargetSubchapter && ch.subchapters) {
          return {
            ...ch,
            subchapters: ch.subchapters.map(sub =>
              sub.id === moveTargetSubchapter
                ? { ...sub, notes: sub.notes ? `${sub.notes}\n\n--- ${lectureTitle} ---\n${lectureContent}` : lectureContent }
                : sub
            )
          };
        } else {
          return {
            ...ch,
            notes: ch.notes ? `${ch.notes}\n\n--- ${lectureTitle} ---\n${lectureContent}` : lectureContent
          };
        }
      }
      return ch;
    });

    // Remove from lectures
    const updatedLectures = course.lectures.filter(l => l.id !== movingLecture.id);

    onUpdate({ ...course, chapters: updatedChapters, lectures: updatedLectures });
    showToast(`Moved "${lectureTitle}" to chapter!`, 'success');
    setMovingLecture(null);
    setMoveTargetChapter('');
    setMoveTargetSubchapter('');
  };

  // Handle delete confirmation
  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;

    if (deleteConfirm.type === 'lecture') {
      onUpdate({ ...course, lectures: course.lectures.filter(l => l.id !== deleteConfirm.id) });
      showToast(`Deleted "${deleteConfirm.title}"`, 'success');
    } else if (deleteConfirm.type === 'chapter') {
      onUpdate({ ...course, chapters: course.chapters.filter(c => c.id !== deleteConfirm.id) });
      showToast(`Deleted chapter "${deleteConfirm.title}"`, 'success');
    } else if (deleteConfirm.type === 'subchapter' && deleteConfirm.parentId) {
      // Delete entire subchapter (notes-only)
      onUpdate({
        ...course,
        chapters: course.chapters.map(c => c.id === deleteConfirm.parentId ? {
          ...c,
          subchapters: c.subchapters?.filter(s => s.id !== deleteConfirm.id)
        } : c)
      });
      showToast(`Deleted section "${deleteConfirm.title}"`, 'success');
    } else if (deleteConfirm.type === 'chapter_notes') {
      onUpdate({
        ...course,
        chapters: course.chapters.map(c => c.id === deleteConfirm.id ? { ...c, notes: undefined } : c)
      });
      showToast(`Removed notes from "${deleteConfirm.title}"`, 'success');
    } else if (deleteConfirm.type === 'subchapter_notes' && deleteConfirm.parentId) {
      onUpdate({
        ...course,
        chapters: course.chapters.map(c => c.id === deleteConfirm.parentId ? {
          ...c,
          subchapters: c.subchapters?.map(s => s.id === deleteConfirm.id ? { ...s, notes: undefined } : s)
        } : c)
      });
      showToast(`Removed notes from "${deleteConfirm.title}"`, 'success');
    }
    setDeleteConfirm(null);
  };

  // Handle move notes
  const handleMoveNotes = () => {
    if (!movingNotes || !moveNotesTarget) return;

    const notesContent = movingNotes.notes;
    const customNotesTitle = movingNotes.notesTitle; // Preserve custom name

    // Find the source subchapter to check if it's notes-only and get its title
    let sourceIsNotesOnly = false;
    let sourceSubchapterTitle = '';
    let sourceNotesTitle = customNotesTitle;
    if (movingNotes.type === 'subchapter' && movingNotes.subchapterId) {
      const sourceChapter = course.chapters.find(ch => ch.id === movingNotes.chapterId);
      const sourceSubchapter = sourceChapter?.subchapters?.find(s => s.id === movingNotes.subchapterId);
      sourceIsNotesOnly = sourceSubchapter?.isNotesOnly || false;
      sourceSubchapterTitle = sourceSubchapter?.title || movingNotes.title;
      sourceNotesTitle = sourceSubchapter?.notesTitle || customNotesTitle;
    }

    // Remove notes from source
    let updatedChapters = course.chapters.map(ch => {
      if (movingNotes.type === 'chapter' && ch.id === movingNotes.chapterId) {
        // For chapters, just clear notes and notesTitle (keep the chapter)
        return { ...ch, notes: undefined, notesTitle: undefined };
      }
      if (movingNotes.type === 'subchapter' && ch.id === movingNotes.chapterId && ch.subchapters) {
        if (sourceIsNotesOnly) {
          // For notes-only subchapters, DELETE the entire subchapter
          return {
            ...ch,
            subchapters: ch.subchapters.filter(s => s.id !== movingNotes.subchapterId)
          };
        } else {
          // For PDF subchapters with attached notes, just clear the notes and notesTitle
          return {
            ...ch,
            subchapters: ch.subchapters.map(s =>
              s.id === movingNotes.subchapterId ? { ...s, notes: undefined, notesTitle: undefined } : s
            )
          };
        }
      }
      return ch;
    });

    // Add notes to target
    updatedChapters = updatedChapters.map(ch => {
      if (ch.id === moveNotesTarget) {
        if (moveNotesSubTarget && ch.subchapters) {
          // Attach notes to an existing PDF subchapter - preserve notesTitle
          return {
            ...ch,
            subchapters: ch.subchapters.map(sub =>
              sub.id === moveNotesSubTarget
                ? {
                    ...sub,
                    notes: sub.notes ? `${sub.notes}\n\n${notesContent}` : notesContent,
                    notesTitle: sub.notesTitle || sourceNotesTitle // Keep existing or use source title
                  }
                : sub
            )
          };
        } else {
          // Create a new subsection with the notes - preserve notesTitle
          const newSubTitle = sourceIsNotesOnly ? sourceSubchapterTitle : movingNotes.title;
          const newSubchapter = {
            id: uuid(),
            title: newSubTitle,
            isNotesOnly: true,
            notes: notesContent,
            notesTitle: sourceNotesTitle // Preserve custom name
          };

          return {
            ...ch,
            subchapters: [...(ch.subchapters || []), newSubchapter]
          };
        }
      }
      return ch;
    });

    const targetChapter = course.chapters.find(c => c.id === moveNotesTarget);
    const targetSubchapter = targetChapter?.subchapters?.find(s => s.id === moveNotesSubTarget);
    const targetName = moveNotesSubTarget && targetSubchapter
      ? `${targetChapter?.title} → ${targetSubchapter.title}`
      : targetChapter?.title;

    onUpdate({ ...course, chapters: updatedChapters });
    showToast(`Moved notes to ${targetName}!`, 'success');
    setMovingNotes(null);
    setMoveNotesTarget('');
    setMoveNotesSubTarget('');
  };

  const selectedMoveChapter = course.chapters.find(c => c.id === moveTargetChapter);
  const selectedMoveNotesChapter = course.chapters.find(c => c.id === moveNotesTarget);
  const selectedQuickImportChapter = course.chapters.find(c => c.id === quickImportChapterId);

  // Helper to extract text from various file types
  const extractFileContent = async (file: File): Promise<string> => {
    const fileName = file.name.toLowerCase();

    if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
      const fileUrl = URL.createObjectURL(file);
      const doc = await loadPdfDocument(fileUrl);
      const numPages = doc.numPages;
      let text = '';
      for (let i = 1; i <= numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      URL.revokeObjectURL(fileUrl);
      return text;
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const text = new TextDecoder().decode(uint8Array);
      const matches = text.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      const extractedText = matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ').replace(/\s+/g, ' ').trim();
      if (extractedText.length > 50) return extractedText;
      return text.replace(/<[^>]+>/g, ' ').replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 50000);
    } else if (fileName.endsWith('.rtf')) {
      const raw = await file.text();
      return raw.replace(/\{\\[^{}]+\}|\\[a-z]+\d*\s?/gi, '').replace(/[{}]/g, '').trim();
    } else {
      return await file.text();
    }
  };

  // Handle quick import file change
  const handleQuickImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setQuickImportFile(f);
      setQuickImportTitle(f.name.replace(/\.[^/.]+$/, ""));
    }
  };

  // Handle quick import save
  const handleQuickImportSave = async () => {
    if (!quickImportFile) return;

    // Validate based on mode
    if (quickImportCreateNewChapter && !quickImportNewChapterTitle.trim()) return;
    if (!quickImportCreateNewChapter && !quickImportChapterId) return;

    setQuickImportLoading(true);
    try {
      const content = await extractFileContent(quickImportFile);

      if (quickImportCreateNewChapter) {
        // Create a brand new chapter
        const chapterId = uuid();

        if (quickImportCreateSection && quickImportSectionTitle.trim()) {
          // New chapter with a section containing notes
          const newChapter = {
            id: chapterId,
            title: quickImportNewChapterTitle.trim(),
            isNotesOnly: true,
            subchapters: [{
              id: uuid(),
              title: quickImportSectionTitle.trim(),
              isNotesOnly: true,
              notes: content
            }]
          };
          onUpdate({ ...course, chapters: [...course.chapters, newChapter] });
          showToast(`Created chapter "${quickImportNewChapterTitle.trim()}" with section!`, 'success');
        } else {
          // New chapter with notes at chapter level
          const newChapter = {
            id: chapterId,
            title: quickImportNewChapterTitle.trim(),
            isNotesOnly: true,
            notes: content
          };
          onUpdate({ ...course, chapters: [...course.chapters, newChapter] });
          showToast(`Created chapter "${quickImportNewChapterTitle.trim()}"!`, 'success');
        }
      } else if (quickImportCreateSection && quickImportSectionTitle.trim()) {
        // Create a new section within the existing chapter
        const newSubchapter = {
          id: uuid(),
          title: quickImportSectionTitle.trim(),
          isNotesOnly: true,
          notes: content
        };

        const updatedChapters = course.chapters.map(ch => {
          if (ch.id === quickImportChapterId) {
            return {
              ...ch,
              subchapters: [...(ch.subchapters || []), newSubchapter]
            };
          }
          return ch;
        });

        onUpdate({ ...course, chapters: updatedChapters });
        showToast(`Created section "${quickImportSectionTitle.trim()}" with notes!`, 'success');
      } else {
        // Add notes directly to the existing chapter
        const updatedChapters = course.chapters.map(ch => {
          if (ch.id === quickImportChapterId) {
            const noteLabel = quickImportTitle.trim() || 'Imported Notes';
            return {
              ...ch,
              notes: ch.notes ? `${ch.notes}\n\n--- ${noteLabel} ---\n${content}` : content,
              notesTitle: ch.notesTitle || (quickImportTitle.trim() || undefined) // Preserve existing or set new
            };
          }
          return ch;
        });

        onUpdate({ ...course, chapters: updatedChapters });
        showToast(`Notes added to chapter!`, 'success');
      }

      // Reset and close
      closeQuickImport();
    } catch (e) {
      console.error(e);
      showToast('Failed to process file', 'error');
    } finally {
      setQuickImportLoading(false);
    }
  };

  // Reset quick import state when closing
  const closeQuickImport = () => {
    setQuickImportChapterId(null);
    setQuickImportFile(null);
    setQuickImportTitle('');
    setQuickImportCreateSection(false);
    setQuickImportSectionTitle('');
    setQuickImportCreateNewChapter(false);
    setQuickImportNewChapterTitle('');
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white dark:bg-slate-800 p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-8">
        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-4 flex items-center"><Bot className="w-5 h-5 text-primary mr-2" />AI Study Generator</h3>

        {/* Selection */}
        <div className="mb-6">
          <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">1. Select Source Material</label>
          <div className="border border-slate-200 dark:border-slate-600 rounded-lg max-h-64 overflow-y-auto bg-slate-50 dark:bg-slate-700/50 p-2 space-y-3">

            {/* Chapters Section */}
            {course.chapters.length > 0 && (
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-1 mt-1">Chapters & Notes</div>
                {course.chapters.map((ch, idx) => (
                  <div key={ch.id}>
                    {/* Parent Chapter */}
                    <div
                      className={`flex items-center gap-1 p-2 hover:bg-white dark:hover:bg-slate-600 rounded transition-colors group ${ch.isNotesOnly ? 'bg-amber-50/50 dark:bg-amber-900/20' : ''}`}
                      onClick={() => ch.startPage && onChapterFocus?.(ch.startPage)}
                    >
                      <label className="flex items-center gap-3 flex-1 cursor-pointer">
                        <input type="checkbox" checked={selectedIds.includes(ch.id)} onChange={() => toggleSelection(ch.id)} className={`rounded focus:ring-primary ${ch.isNotesOnly ? 'text-amber-500' : 'text-primary'}`} />
                        {ch.isNotesOnly ? (
                          <StickyNote className="w-4 h-4 text-amber-500" />
                        ) : (
                          <File className="w-4 h-4 text-blue-400" />
                        )}
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200"><span className="text-slate-400 mr-1">Ch.{idx + 1}</span> {ch.title}</span>
                        {ch.isNotesOnly ? (
                          <span className="text-[10px] text-amber-600 ml-auto bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded font-bold flex items-center">
                            <StickyNote className="w-3 h-3 mr-1" />{ch.notes ? `${ch.notes.split(/\s+/).length}w` : 'Notes'}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-600 px-2 py-0.5 rounded ml-auto">pp. {ch.startPage}-{ch.endPage}</span>
                        )}
                      </label>
                      {/* Quick action buttons */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Quick import button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setQuickImportChapterId(ch.id); }}
                          className="p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                          title="Add notes to this chapter"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        {/* Delete chapter (notes-only) */}
                        {ch.isNotesOnly && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'chapter', id: ch.id, title: ch.title }); }}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                            title="Delete chapter"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Attached Notes (shown under chapter) - NOW SELECTABLE */}
                    {ch.notes && !ch.isNotesOnly && (
                      <div className="ml-6 pl-2 pr-2 border-l-2 border-green-200 dark:border-green-800 py-1.5 flex items-center gap-2 text-xs bg-green-50/50 dark:bg-green-900/20 rounded-r group/notes">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(`${ch.id}_notes`)}
                          onChange={() => toggleSelection(`${ch.id}_notes`)}
                          className="rounded text-green-500 focus:ring-green-400 w-4 h-4"
                        />
                        <StickyNote className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-green-700 dark:text-green-400 font-medium truncate flex-1 min-w-0">
                          {ch.notesTitle || `${ch.title} Notes`} ({ch.notes.split(/\s+/).length} words)
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setMovingNotes({ type: 'chapter', chapterId: ch.id, notes: ch.notes!, title: `Notes from ${ch.title}`, notesTitle: ch.notesTitle });
                            }}
                            className="text-green-500 hover:text-blue-500 p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                            title="Move notes"
                          >
                            <Move className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteConfirm({ type: 'chapter_notes', id: ch.id, title: ch.title });
                            }}
                            className="text-green-500 hover:text-red-500 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                            title="Remove notes"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Subchapters */}
                    {ch.subchapters && ch.subchapters.map((sub, sIdx) => (
                        <React.Fragment key={sub.id}>
                        <div
                          className={`flex items-center gap-1 p-2 pl-8 hover:bg-white dark:hover:bg-slate-600 rounded transition-colors border-l-2 ml-2 group/sub ${sub.isNotesOnly ? 'border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-900/10' : 'border-slate-100 dark:border-slate-600'}`}
                          onClick={() => sub.startPage && onChapterFocus?.(sub.startPage)}
                        >
                           <label className="flex items-center gap-3 flex-1 cursor-pointer min-w-0">
                             <input type="checkbox" checked={selectedIds.includes(sub.id)} onChange={() => toggleSelection(sub.id)} className={`rounded focus:ring-blue-400 ${sub.isNotesOnly ? 'text-amber-500' : 'text-blue-400'}`} />
                             {sub.isNotesOnly ? (
                               <StickyNote className="w-3 h-3 text-amber-500 flex-shrink-0" />
                             ) : (
                               <FileText className="w-3 h-3 text-slate-400 flex-shrink-0" />
                             )}
                             <span className="text-sm font-medium text-slate-600 dark:text-slate-300 text-xs truncate"><span className="text-slate-300 dark:text-slate-500 mr-1">{idx+1}.{sIdx+1}</span> {sub.title}</span>
                             {sub.isNotesOnly ? (
                               <span className="text-[10px] text-amber-600 ml-auto bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded font-bold flex-shrink-0 flex items-center">
                                 <StickyNote className="w-2.5 h-2.5 mr-1" />{sub.notes ? `${sub.notes.split(/\s+/).length}w` : 'Notes'}
                               </span>
                             ) : (
                               <span className="text-[10px] text-slate-400 border border-slate-200 dark:border-slate-500 px-1 rounded ml-auto flex-shrink-0">{sub.startPage}-{sub.endPage}</span>
                             )}
                           </label>
                           {/* Action buttons for notes-only subchapters */}
                           {sub.isNotesOnly && (
                             <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                               <button
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setMovingNotes({ type: 'subchapter', chapterId: ch.id, subchapterId: sub.id, notes: sub.notes!, title: sub.title });
                                 }}
                                 className="p-1 text-amber-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                                 title="Move section"
                               >
                                 <Move className="w-2.5 h-2.5" />
                               </button>
                               <button
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setDeleteConfirm({ type: 'subchapter', id: sub.id, parentId: ch.id, title: sub.title });
                                 }}
                                 className="p-1 text-amber-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                 title="Delete section"
                               >
                                 <Trash2 className="w-2.5 h-2.5" />
                               </button>
                             </div>
                           )}
                        </div>
                        {/* Attached Notes (shown under subchapter) - NOW SELECTABLE */}
                        {sub.notes && !sub.isNotesOnly && (
                          <div className="ml-12 pl-2 pr-2 border-l-2 border-green-200 dark:border-green-800 py-1.5 flex items-center gap-2 text-[11px] bg-green-50/50 dark:bg-green-900/20 rounded-r group/subnotes">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(`${sub.id}_notes`)}
                              onChange={() => toggleSelection(`${sub.id}_notes`)}
                              className="rounded text-green-500 focus:ring-green-400 w-3.5 h-3.5"
                            />
                            <StickyNote className="w-2.5 h-2.5 text-green-500 flex-shrink-0" />
                            <span className="text-green-700 dark:text-green-400 font-medium truncate flex-1 min-w-0">
                              {sub.notesTitle || `${sub.title} Notes`} ({sub.notes.split(/\s+/).length}w)
                            </span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setMovingNotes({ type: 'subchapter', chapterId: ch.id, subchapterId: sub.id, notes: sub.notes!, title: `Notes from ${sub.title}`, notesTitle: sub.notesTitle });
                                }}
                                className="text-green-500 hover:text-blue-500 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                title="Move notes"
                              >
                                <Move className="w-2.5 h-2.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setDeleteConfirm({ type: 'subchapter_notes', id: sub.id, parentId: ch.id, title: sub.title });
                                }}
                                className="text-green-500 hover:text-red-500 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                title="Remove notes"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        )}
                        </React.Fragment>
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
                        {lec.sourceType === 'upload' ? <FileText className="w-4 h-4 text-amber-500" /> : <Mic className="w-4 h-4 text-purple-500" />}
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
                        <Eye className="w-4 h-4" />
                    </button>
                    {course.chapters.length > 0 && (
                      <button
                         onClick={(e) => {
                           e.stopPropagation();
                           setMovingLecture(lec);
                           setMoveTargetChapter('');
                           setMoveTargetSubchapter('');
                         }}
                         className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded opacity-0 group-hover:opacity-100 transition-all"
                         title="Move to chapter"
                      >
                          <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                    <button
                       onClick={(e) => {
                         e.stopPropagation();
                         setDeleteConfirm({ type: 'lecture', id: lec.id, title: lec.title });
                       }}
                       className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded opacity-0 group-hover:opacity-100 transition-all"
                       title="Delete"
                    >
                        <Trash2 className="w-4 h-4" />
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
            disabled={generating || selectedIds.length === 0 || userStatus !== 'pro'}
            className={`w-full flex items-center justify-center gap-3 p-4 rounded-xl font-bold transition-all shadow-md ${
              userStatus !== 'pro'
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span>Ask AI Tutor</span>
            {userStatus !== 'pro' && (
              <span className="text-[10px] bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full uppercase tracking-wide font-bold">Pro</span>
            )}
          </button>
          <p className="text-[10px] text-slate-400 text-center mt-2">
            {userStatus !== 'pro' ? 'Upgrade to Pro to unlock AI Tutor' : 'Chat with AI about your selected content'}
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-600"></div>
          <span className="text-xs font-bold text-slate-400 uppercase">Or Generate Study Materials</span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-600"></div>
        </div>

        {/* Action Buttons - Now open config modal */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <GenBtn icon={<Zap className="w-5 h-5" />} label="Flashcards" onClick={() => openGenConfig(ContentType.FLASHCARDS)} loading={generating} status={status} />
          <GenBtn icon={<HelpCircle className="w-5 h-5" />} label="Quiz" onClick={() => openGenConfig(ContentType.QUIZ)} loading={generating} status={status} />
          <GenBtn icon={<AlignLeft className="w-5 h-5" />} label="Summary" onClick={() => openGenConfig(ContentType.NOTES)} loading={generating} status={status} />
          <GenBtn
            icon={<Share2 className="w-5 h-5" />}
            label="Concept Connections"
            onClick={() => openGenConfig(ContentType.CONCEPT_CONNECTIONS)}
            loading={generating}
            status={status}
            badge={userStatus !== 'pro' ? 'Pro' : undefined}
            disabled={userStatus !== 'pro'}
          />
          <GenBtn
            icon={<Calculator className="w-5 h-5" />}
            label="Practice Problems"
            onClick={() => openGenConfig(ContentType.PRACTICE_PROBLEMS)}
            loading={generating}
            status={status}
            badge={userStatus !== 'pro' ? 'Pro' : 'STEM'}
            disabled={userStatus !== 'pro'}
          />
          <GenBtn
            icon={<Lightbulb className="w-5 h-5" />}
            label="Mnemonics"
            onClick={() => openGenConfig(ContentType.MNEMONICS)}
            loading={generating}
            status={status}
            badge={userStatus !== 'pro' ? 'Pro' : undefined}
            disabled={userStatus !== 'pro'}
          />

          <GenBtn
             icon={<FileSignature className="w-5 h-5" />}
             label="Generate Mock Test"
             onClick={() => openGenConfig(ContentType.MOCK_TEST)}
             loading={generating}
             status={status}
             badge={userStatus !== 'pro' ? 'Pro' : undefined}
             disabled={userStatus !== 'pro'}
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

          {/* Smart Exam Toggle - Only for Mock Tests */}
          {genConfigModal === ContentType.MOCK_TEST && (
            <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSmartExam}
                  onChange={(e) => setUseSmartExam(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                />
                <div>
                  <div className="font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-500" />
                    Smart Exam Mode
                    <span className="text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full font-bold">NEW</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Generate exam from your existing flashcards and quiz questions.
                    Creates varied questions while avoiding token limits.
                  </p>
                  <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 flex items-center">
                    <Info className="w-3 h-3 mr-1" />
                    {course.materials.filter(m => m.type === ContentType.FLASHCARDS || m.type === ContentType.QUIZ).length > 0
                      ? `${course.materials.reduce((acc, m) => acc + (Array.isArray(m.content) && (m.type === ContentType.FLASHCARDS || m.type === ContentType.QUIZ) ? m.content.length : 0), 0)} items available`
                      : "Generate flashcards/quizzes first"
                    }
                  </p>
                </div>
              </label>
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
            <Sparkles className="w-5 h-5" />
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
              <BookOpen className="w-4 h-4" />
              <span>Context: {selectedIds.length} item(s) selected</span>
            </div>
            {(course.chatHistory?.length || 0) > 0 && (
              <button
                onClick={clearChatHistory}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3 h-3 mr-1" /> Clear History
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {(!course.chatHistory || course.chatHistory.length === 0) && !chatLoading && (
              <div className="text-center py-12 text-slate-400">
                <Bot className="w-10 h-10 mb-3 text-slate-300" />
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
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
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
                <Send className="w-4 h-4" />
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
                      <BookMarked className="w-3 h-3" /> {conn.source}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          {preview?.type === ContentType.PRACTICE_PROBLEMS && (
            <PracticeProblemsViewer problems={preview.data as PracticeProblem[]} />
          )}
          {preview?.type === ContentType.MNEMONICS && (
            <MnemonicsViewer mnemonics={preview.data as Mnemonic[]} />
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
                <RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} /> Regenerate
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

      {/* Move Lecture Modal */}
      <Modal isOpen={!!movingLecture} onClose={() => setMovingLecture(null)} title="Move Notes to Chapter" maxWidth="max-w-md">
        <div className="space-y-4">
          {/* What we're moving */}
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase mb-1">Moving</div>
            <div className="font-bold text-slate-800 dark:text-slate-200">{movingLecture?.title}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {movingLecture?.transcript ? `${movingLecture.transcript.split(/\s+/).length} words` : ''}
            </div>
          </div>

          {/* Target selection */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Move to Chapter</label>
            <select
              value={moveTargetChapter}
              onChange={(e) => { setMoveTargetChapter(e.target.value); setMoveTargetSubchapter(''); }}
              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
            >
              <option value="">-- Select Chapter --</option>
              {course.chapters.map((ch, idx) => (
                <option key={ch.id} value={ch.id}>
                  Ch.{idx + 1}: {ch.title}
                </option>
              ))}
            </select>
          </div>

          {selectedMoveChapter?.subchapters && selectedMoveChapter.subchapters.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Section (optional)</label>
              <select
                value={moveTargetSubchapter}
                onChange={(e) => setMoveTargetSubchapter(e.target.value)}
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value="">-- Add to chapter level --</option>
                {selectedMoveChapter.subchapters.map((sub, sIdx) => (
                  <option key={sub.id} value={sub.id}>
                    {course.chapters.indexOf(selectedMoveChapter) + 1}.{sIdx + 1}: {sub.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {moveTargetChapter && (
            <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
              <Info className="w-3 h-3 mr-1 inline" />
              Notes will be attached to the chapter and combined with PDF content when generating.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setMovingLecture(null)}
              className="flex-1 px-4 py-3 text-slate-500 font-medium border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleMoveLecture}
              disabled={!moveTargetChapter}
              className="flex-1 px-4 py-3 bg-primary text-white rounded-lg font-bold disabled:opacity-50 hover:bg-blue-600 transition-colors"
            >
              <ArrowRight className="w-4 h-4 mr-2" />Move
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirm Delete" maxWidth="max-w-sm">
        <div className="space-y-4">
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Are you sure you want to delete{' '}
              <span className="font-bold text-slate-800 dark:text-slate-100">"{deleteConfirm?.title}"</span>?
            </p>
            {deleteConfirm?.type === 'chapter' && (
              <p className="text-xs text-red-500 mt-2">This will delete the chapter and all its contents.</p>
            )}
            {deleteConfirm?.type === 'subchapter' && (
              <p className="text-xs text-red-500 mt-2">This will delete the section and its notes.</p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="flex-1 px-4 py-3 text-slate-500 font-medium border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-2" />Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Move Notes Modal */}
      <Modal isOpen={!!movingNotes} onClose={() => setMovingNotes(null)} title="Move Notes" maxWidth="max-w-md">
        <div className="space-y-4">
          {/* What we're moving */}
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase mb-1">Moving Notes</div>
            <div className="font-bold text-slate-800 dark:text-slate-200">{movingNotes?.title}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {movingNotes?.notes ? `${movingNotes.notes.split(/\s+/).length} words` : ''}
            </div>
          </div>

          {/* Target chapter selection */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Move to Chapter</label>
            <select
              value={moveNotesTarget}
              onChange={(e) => { setMoveNotesTarget(e.target.value); setMoveNotesSubTarget(''); }}
              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
            >
              <option value="">-- Select Chapter --</option>
              {course.chapters.map((ch, idx) => (
                <option key={ch.id} value={ch.id}>
                  Ch.{idx + 1}: {ch.title}
                </option>
              ))}
            </select>
          </div>

          {/* Target subchapter selection - show all subchapters */}
          {moveNotesTarget && selectedMoveNotesChapter?.subchapters && selectedMoveNotesChapter.subchapters.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Attach to Section (optional)</label>
              <select
                value={moveNotesSubTarget}
                onChange={(e) => setMoveNotesSubTarget(e.target.value)}
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value="">-- Create new section --</option>
                {selectedMoveNotesChapter.subchapters.map((sub, sIdx) => (
                  <option key={sub.id} value={sub.id}>
                    {course.chapters.indexOf(selectedMoveNotesChapter) + 1}.{sIdx + 1}: {sub.title}
                    {sub.isNotesOnly ? ' (notes)' : ` (p.${sub.startPage}-${sub.endPage})`}
                    {sub.notes ? ' +notes' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {moveNotesTarget && (
            <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
              <Info className="w-3 h-3 mr-1 inline" />
              {moveNotesSubTarget
                ? 'Notes will be attached to the selected PDF section.'
                : 'Notes will be moved as a new section in the selected chapter.'}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setMovingNotes(null)}
              className="flex-1 px-4 py-3 text-slate-500 font-medium border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleMoveNotes}
              disabled={!moveNotesTarget}
              className="flex-1 px-4 py-3 bg-primary text-white rounded-lg font-bold disabled:opacity-50 hover:bg-blue-600 transition-colors"
            >
              <Move className="w-4 h-4 mr-2" />Move
            </button>
          </div>
        </div>
      </Modal>

      {/* Quick Import Modal - Functional file upload */}
      {quickImportChapterId && (
        <Modal isOpen={true} onClose={closeQuickImport} title="Add Notes" maxWidth="max-w-md">
          <div className="space-y-4">
            {/* Mode toggle: Add to existing vs Create new chapter */}
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <button
                onClick={() => setQuickImportCreateNewChapter(false)}
                className={`flex-1 px-3 py-2 text-sm font-bold rounded-md transition-all ${!quickImportCreateNewChapter ? 'bg-white dark:bg-slate-600 text-primary shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
              >
                <Layers className="w-4 h-4 mr-2" />Add to Chapter
              </button>
              <button
                onClick={() => setQuickImportCreateNewChapter(true)}
                className={`flex-1 px-3 py-2 text-sm font-bold rounded-md transition-all ${quickImportCreateNewChapter ? 'bg-white dark:bg-slate-600 text-amber-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
              >
                <PlusCircle className="w-4 h-4 mr-2" />New Chapter
              </button>
            </div>

            {/* Target chapter info (when adding to existing) */}
            {!quickImportCreateNewChapter && (
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Adding notes to</div>
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedQuickImportChapter?.title}
                </div>
              </div>
            )}

            {/* New chapter title input */}
            {quickImportCreateNewChapter && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <label className="block text-xs font-bold text-amber-600 dark:text-amber-400 uppercase mb-1">New Chapter Name</label>
                <input
                  type="text"
                  value={quickImportNewChapterTitle}
                  onChange={(e) => setQuickImportNewChapterTitle(e.target.value)}
                  placeholder="e.g., Week 5, Unit 3, Midterm Review..."
                  className="w-full p-2 border border-amber-300 dark:border-amber-700 rounded text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-amber-400 outline-none"
                />
              </div>
            )}

            {/* File upload */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Upload Notes File</label>
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors relative group cursor-pointer">
                <input
                  type="file"
                  accept=".txt,.md,.pdf,.docx,.rtf,.doc"
                  onChange={handleQuickImportFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {quickImportFile ? (
                  <div className="text-primary">
                    <FileText className="w-6 h-6 mx-auto mb-1" />
                    <p className="font-bold text-sm truncate px-4">{quickImportFile.name}</p>
                    <p className="text-xs text-slate-400 mt-1">Click to replace</p>
                  </div>
                ) : (
                  <div className="text-slate-400">
                    <CloudUpload className="w-6 h-6 mx-auto mb-1 group-hover:text-primary transition-colors" />
                    <p className="font-bold text-sm text-slate-600 dark:text-slate-300">Click to Upload</p>
                    <p className="text-xs mt-1">PDF, DOCX, TXT, MD, RTF</p>
                  </div>
                )}
              </div>
            </div>

            {quickImportFile && (
              <>
                {/* Note label (only for adding to existing chapter without section) */}
                {!quickImportCreateNewChapter && !quickImportCreateSection && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Note Label (optional)</label>
                    <input
                      type="text"
                      value={quickImportTitle}
                      onChange={(e) => setQuickImportTitle(e.target.value)}
                      placeholder="e.g., Monday Lecture, Lab Notes..."
                      className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-primary outline-none"
                    />
                  </div>
                )}

                {/* Create as section toggle */}
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-600">
                  <input
                    type="checkbox"
                    checked={quickImportCreateSection}
                    onChange={(e) => setQuickImportCreateSection(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded text-green-500 focus:ring-green-400"
                  />
                  <div>
                    <div className="font-bold text-sm text-slate-700 dark:text-slate-200">
                      {quickImportCreateNewChapter ? 'Add as section within chapter' : 'Create as new section'}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {quickImportCreateNewChapter
                        ? 'Creates chapter with a subsection containing notes'
                        : 'Creates a subsection within this chapter'}
                    </p>
                  </div>
                </label>

                {/* Section title input */}
                {quickImportCreateSection && (
                  <div className="ml-7">
                    <label className="block text-xs font-bold text-green-600 dark:text-green-400 uppercase mb-1">Section Name</label>
                    <input
                      type="text"
                      value={quickImportSectionTitle}
                      onChange={(e) => setQuickImportSectionTitle(e.target.value)}
                      placeholder="e.g., Lecture 5, Reading Notes..."
                      className="w-full p-2 border border-green-300 dark:border-green-700 rounded text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-green-400 outline-none"
                    />
                  </div>
                )}
              </>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={closeQuickImport}
                className="flex-1 px-4 py-3 text-slate-500 font-medium border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickImportSave}
                disabled={
                  !quickImportFile ||
                  quickImportLoading ||
                  (quickImportCreateSection && !quickImportSectionTitle.trim()) ||
                  (quickImportCreateNewChapter && !quickImportNewChapterTitle.trim())
                }
                className="flex-1 px-4 py-3 bg-primary text-white rounded-lg font-bold disabled:opacity-50 hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                {quickImportLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {quickImportLoading ? 'Importing...' : 'Import Notes'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
