
import { useState, useContext, useMemo } from 'react';
import { Course, ContentType, Difficulty, Flashcard, Question, StudyMaterial, Lecture } from '../types';
import { generateContent, fixFlashcardContent } from '../services/geminiService';
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
    className={`relative flex flex-col items-center justify-center p-4 border rounded-xl transition-all group h-24 ${fullWidth ? 'col-span-2 md:col-span-3 bg-blue-50 border-blue-200' : ''} ${
      disabled 
        ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed' 
        : 'border-slate-200 hover:border-primary hover:bg-blue-50 cursor-pointer'
    }`}
  >
    {loading && fullWidth ? (
       <div className="flex items-center gap-3">
          <i className="fas fa-circle-notch fa-spin text-primary"></i>
          <span className="text-slate-600 font-bold">{status}</span>
       </div>
    ) : loading ? (
      <>
        <i className="fas fa-circle-notch fa-spin text-primary mb-2"></i>
        <span className="text-[10px] text-slate-500 animate-pulse text-center leading-tight px-1">{status}</span>
      </>
    ) : (
      <>
        <i className={`fas ${icon} mb-2 text-xl ${disabled ? 'text-slate-300' : 'text-slate-400 group-hover:text-primary'}`}></i>
        <span className={`text-xs font-bold ${disabled ? 'text-slate-400' : 'text-slate-600 group-hover:text-primary'}`}>{label}</span>
      </>
    )}
    {badge && (
      <span className="absolute top-2 right-2 text-[8px] font-bold bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
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
            className={`absolute inset-0 backface-hidden bg-white border shadow-sm rounded-xl flex flex-col items-center justify-center p-8 text-center overflow-hidden ${card.isDuplicate ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'}`}
            style={{ backfaceVisibility: 'hidden' }}
          >
            {card.isDuplicate && (
                <div className="absolute top-3 right-3 bg-amber-100 text-amber-600 text-[10px] font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1 z-10">
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
                    <h4 className={`text-2xl font-bold leading-relaxed ${card.isDuplicate ? 'text-slate-500 opacity-70' : 'text-slate-800'}`}>{card.front}</h4>
                 </div>
                 <span className="absolute bottom-6 text-sm text-slate-400 font-medium uppercase tracking-wider">Tap to Flip</span>
               </>
            )}
          </div>

          {/* Back */}
          <div 
            className={`absolute inset-0 backface-hidden border shadow-sm rounded-xl flex flex-col items-center justify-center p-8 text-center ${card.isDuplicate ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
             <div className="overflow-y-auto w-full max-h-full">
                <h4 className={`text-xl font-medium leading-relaxed ${card.isDuplicate ? 'text-slate-600 opacity-80' : 'text-blue-900'}`}>{card.back}</h4>
                {card.source && (
                    <div className="mt-6 pt-4 border-t border-blue-100 w-full">
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

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
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

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
        <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center"><i className="fas fa-robot text-primary mr-2"></i>AI Study Generator</h3>
        
        {/* Selection */}
        <div className="mb-6">
          <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">1. Select Source Material</label>
          <div className="border border-slate-200 rounded-lg max-h-64 overflow-y-auto bg-slate-50 p-2 space-y-3">
            
            {/* Chapters Section */}
            {course.chapters.length > 0 && (
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-1 mt-1">Textbook Chapters</div>
                {course.chapters.map((ch, idx) => (
                  <div key={ch.id}>
                    {/* Parent Chapter */}
                    <label className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer transition-colors">
                      <input type="checkbox" checked={selectedIds.includes(ch.id)} onChange={() => toggleSelection(ch.id)} className="rounded text-primary focus:ring-primary" />
                      <span className="text-sm font-medium text-slate-700"><span className="text-slate-400 mr-1">Ch.{idx + 1}</span> {ch.title}</span>
                      <span className="text-xs text-slate-400 ml-auto bg-slate-100 px-2 py-0.5 rounded">pp. {ch.startPage}-{ch.endPage}</span>
                    </label>
                    
                    {/* Subchapters */}
                    {ch.subchapters && ch.subchapters.map((sub, sIdx) => (
                        <label key={sub.id} className="flex items-center gap-3 p-2 pl-8 hover:bg-white rounded cursor-pointer transition-colors border-l-2 border-slate-100 ml-2">
                           <input type="checkbox" checked={selectedIds.includes(sub.id)} onChange={() => toggleSelection(sub.id)} className="rounded text-blue-400 focus:ring-blue-400" />
                           <span className="text-sm font-medium text-slate-600 text-xs"><span className="text-slate-300 mr-1">{idx+1}.{sIdx+1}</span> {sub.title}</span>
                           <span className="text-[10px] text-slate-400 ml-auto border border-slate-200 px-1 rounded">{sub.startPage}-{sub.endPage}</span>
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
                  <div key={lec.id} className="flex items-center gap-3 p-2 hover:bg-white rounded transition-colors group">
                    <label className="flex items-center gap-3 flex-1 cursor-pointer">
                        <input type="checkbox" checked={selectedIds.includes(lec.id)} onChange={() => toggleSelection(lec.id)} className="rounded text-primary focus:ring-primary" />
                        <i className={`fas ${lec.sourceType === 'upload' ? 'fa-file-alt text-amber-500' : 'fa-microphone text-purple-500'} w-4`}></i>
                        <div className="flex-1 min-w-0">
                           <div className="text-sm font-medium text-slate-700 truncate">{lec.title}</div>
                           <div className="text-[10px] text-slate-400">{formatDate(lec.date)}</div>
                        </div>
                    </label>
                    <button 
                       onClick={(e) => { e.stopPropagation(); onViewLecture(lec); }}
                       className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded opacity-0 group-hover:opacity-100 transition-all"
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

        {/* Difficulty & Count */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-bold text-slate-400 uppercase">2. Difficulty</label>
              <span className="text-xs font-bold text-primary">{difficulty === 1 ? 'Easy' : difficulty === 3 ? 'Medium' : 'Hard'}</span>
            </div>
            <input type="range" min="1" max="5" step="2" value={difficulty} onChange={e => setDifficulty(Number(e.target.value))} className="w-full accent-primary h-1 bg-slate-200 rounded appearance-none" />
            <p className="text-[10px] text-slate-400 mt-1">Difficulty level of generated questions.</p>
          </div>
          <div>
             <div className="flex justify-between mb-2">
              <label className="text-xs font-bold text-slate-400 uppercase">3. Item Count</label>
              <span className="text-xs font-bold text-primary">{itemCount} items</span>
            </div>
            <input type="range" min="5" max="30" step="5" value={itemCount} onChange={e => setItemCount(Number(e.target.value))} className="w-full accent-primary h-1 bg-slate-200 rounded appearance-none" />
          </div>
        </div>

        {/* Mock Test Settings */}
        <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
           <div className="flex justify-between mb-2">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                 <i className="fas fa-file-signature text-purple-500"></i> Mock Test Settings
              </label>
              <span className="text-xs font-bold text-purple-600">{mockCount} Questions</span>
           </div>
           <input type="range" min="50" max="200" step="10" value={mockCount} onChange={e => setMockCount(Number(e.target.value))} className="w-full accent-purple-600 h-1 bg-slate-200 rounded appearance-none" />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <GenBtn icon="fa-bolt" label="Flashcards" onClick={() => handleGenerate(ContentType.FLASHCARDS)} loading={generating} status={status} />
          <GenBtn icon="fa-question-circle" label="Quiz" onClick={() => handleGenerate(ContentType.QUIZ)} loading={generating} status={status} />
          <GenBtn icon="fa-align-left" label="Summary" onClick={() => handleGenerate(ContentType.NOTES)} loading={generating} status={status} />
          
          <GenBtn 
             icon="fa-file-signature" 
             label="Generate Mock Test" 
             onClick={() => handleGenerate(ContentType.MOCK_TEST)} 
             loading={generating} 
             status={status}
             badge="Pro"
             fullWidth
          />
        </div>
      </div>

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
