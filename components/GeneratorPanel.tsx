import React, { useState, useContext } from 'react';
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

const GenBtn = ({ icon, label, onClick, loading, status, disabled, badge }: any) => (
  <button 
    onClick={onClick} 
    disabled={loading || disabled} 
    className={`relative flex flex-col items-center justify-center p-4 border rounded-xl transition-all group h-24 ${
      disabled 
        ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed' 
        : 'border-slate-200 hover:border-primary hover:bg-blue-50 cursor-pointer'
    }`}
  >
    {loading ? (
      <>
        <i className="fas fa-circle-notch fa-spin text-primary mb-2"></i>
        <span className="text-[10px] text-slate-500 animate-pulse">{status}</span>
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

  if (!cards || cards.length === 0) return <div className="text-slate-400">No flashcards available.</div>;

  const card = cards[index];
  const isBroken = !card.front || !card.back || !card.front.trim() || !card.back.trim();

  return (
    <div className="flex flex-col items-center w-full max-w-lg h-full justify-center">
      <div 
        className="w-full aspect-[3/2] cursor-pointer group perspective"
        style={{ perspective: '1000px' }}
        onClick={() => !isBroken && setFlipped(!flipped)}
      >
        <div 
          className="relative w-full h-full transition-transform duration-500"
          style={{ transformStyle: 'preserve-3d', transform: flipped && !isBroken ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          {/* Front */}
          <div 
            className="absolute inset-0 backface-hidden bg-white border border-slate-200 shadow-sm rounded-xl flex flex-col items-center justify-center p-8 text-center"
            style={{ backfaceVisibility: 'hidden' }}
          >
            {isBroken ? (
               <div className="flex flex-col items-center text-amber-500">
                  <i className="fas fa-exclamation-triangle text-3xl mb-2"></i>
                  <h4 className="font-bold">Invalid Card Content</h4>
                  <p className="text-xs text-slate-400 mt-1 mb-4">Front or back is missing.</p>
                  {onFixCard && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onFixCard(card); }}
                      className="px-4 py-2 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600 shadow-sm"
                    >
                       <i className="fas fa-magic mr-2"></i>Fix Card
                    </button>
                  )}
               </div>
            ) : (
               <>
                 <h4 className="text-xl font-bold text-slate-800">{card.front}</h4>
                 <span className="mt-4 text-xs text-slate-400 font-medium uppercase tracking-wider">Tap to Flip</span>
               </>
            )}
          </div>

          {/* Back */}
          <div 
            className="absolute inset-0 backface-hidden bg-blue-50 border border-blue-200 shadow-sm rounded-xl flex flex-col items-center justify-center p-8 text-center"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <h4 className="text-lg font-medium text-blue-900">{card.back}</h4>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button 
          onClick={(e) => { e.stopPropagation(); setFlipped(false); setIndex(Math.max(0, index - 1)); }}
          disabled={index === 0}
          className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors"
        >
          <i className="fas fa-chevron-left text-slate-600"></i>
        </button>
        <span className="text-sm font-bold text-slate-500">{index + 1} / {cards.length}</span>
        <button 
          onClick={(e) => { e.stopPropagation(); setFlipped(false); setIndex(Math.min(cards.length - 1, index + 1)); }}
          disabled={index === cards.length - 1}
          className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors"
        >
          <i className="fas fa-chevron-right text-slate-600"></i>
        </button>
      </div>
    </div>
  );
};

export const GeneratorPanel = ({ course, onUpdate }: { course: Course, onUpdate: (c: Course) => void }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [itemCount, setItemCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<{type: ContentType, data: any} | null>(null);
  const { showToast } = useContext(ToastContext);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleGenerate = async (type: ContentType) => {
    if (selectedIds.length === 0) return alert("Please select at least one chapter or note source.");
    setGenerating(true);
    setStatus("Preparing...");
    setPreview(null);
    
    try {
      let context = "";
      
      // 1. Process Chapters (Try PDF Text first)
      const selectedChapters = course.chapters.filter(c => selectedIds.includes(c.id));
      if (selectedChapters.length > 0) {
          if (course.pdfBlobId) {
            setStatus("Loading PDF...");
            const blob = await getPdfBlob(course.pdfBlobId);
            if (blob) {
              const blobUrl = URL.createObjectURL(blob);
              setStatus("Reading Chapters...");
              const doc = await loadPdfDocument(blobUrl);
              
              for (const ch of selectedChapters) {
                if (ch.startPage && ch.endPage) {
                  const text = await extractTextFromRange(doc, ch.startPage, ch.endPage);
                  context += `\nChapter: ${ch.title}\n${text}\n`;
                }
              }
              URL.revokeObjectURL(blobUrl);
            }
          } else {
             // Fallback text
             context += selectedChapters.map(c => c.extractedText || "").join("\n");
          }
      }

      // 2. Process Lectures / Notes
      const selectedLectures = course.lectures.filter(l => selectedIds.includes(l.id));
      if (selectedLectures.length > 0) {
          setStatus("Reading Notes...");
          context += selectedLectures.map(l => `\nSource: ${l.title}\n${l.transcript}\n`).join("\n");
      }
      
      if (!context.trim()) {
         context = "(Mock Context as no text was extracted)";
      }

      setStatus("Thinking...");
      const data = await generateContent(context, type, difficulty, course.title, itemCount);
      setPreview({ type, data });
    } catch (e) {
      console.error(e);
      showToast("Generation failed. See console.", 'error');
    } finally {
      setGenerating(false);
      setStatus("");
    }
  };

  const saveMaterial = () => {
    if (!preview) return;
    
    // Auto-generate Title
    let baseTitle = "Mixed Sources";
    const selectedChapters = course.chapters.filter(c => selectedIds.includes(c.id));
    const selectedLectures = course.lectures.filter(l => selectedIds.includes(l.id));

    if (selectedIds.length === 1) {
       if (selectedChapters.length) baseTitle = `Ch.${course.chapters.indexOf(selectedChapters[0]) + 1}: ${selectedChapters[0].title}`;
       if (selectedLectures.length) baseTitle = selectedLectures[0].title;
    } else if (selectedChapters.length > 0 && selectedLectures.length === 0) {
       // Only Chapters logic
       const indices = selectedChapters.map(c => course.chapters.indexOf(c) + 1).sort((a,b) => a-b);
       baseTitle = `Ch.${indices[0]}${indices.length > 1 ? `-${indices[indices.length-1]}` : ''}`;
    } else if (selectedLectures.length > 0 && selectedChapters.length === 0) {
       baseTitle = `${selectedLectures.length} Notes`;
    }
    
    // Truncate
    if (baseTitle.length > 30) baseTitle = baseTitle.substring(0, 30) + "...";

    const typeLabel = preview.type === ContentType.FLASHCARDS ? 'Flashcards' : preview.type === ContentType.QUIZ ? 'Quiz' : 'Notes';
    const title = `${typeLabel}: ${baseTitle}`;

    // Initialize SRS if Flashcards
    let contentToSave = preview.data;
    if (preview.type === ContentType.FLASHCARDS) {
        contentToSave = (preview.data as Flashcard[]).map(fc => ({
            ...fc,
            ...getInitialCardState(false)
        }));
    }

    const newMat: StudyMaterial = {
      id: uuid(),
      type: preview.type,
      title: title,
      createdAt: new Date().toISOString(),
      difficulty: difficulty,
      content: contentToSave,
      sourceChapterIds: selectedIds // Now stores mixed IDs
    };
    onUpdate({ ...course, materials: [newMat, ...course.materials] });
    setPreview(null);
    setSelectedIds([]);
    showToast("Material saved to library!");
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
        <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center"><i className="fas fa-robot text-primary mr-2"></i>AI Study Generator</h3>
        
        {/* Selection */}
        <div className="mb-6">
          <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">1. Select Source Material</label>
          <div className="border border-slate-200 rounded-lg max-h-56 overflow-y-auto bg-slate-50 p-2 space-y-3">
            
            {/* Chapters Section */}
            {course.chapters.length > 0 && (
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-1 mt-1">Textbook Chapters</div>
                {course.chapters.map((ch, idx) => (
                  <label key={ch.id} className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer transition-colors">
                    <input type="checkbox" checked={selectedIds.includes(ch.id)} onChange={() => toggleSelection(ch.id)} className="rounded text-primary focus:ring-primary" />
                    <span className="text-sm font-medium text-slate-700"><span className="text-slate-400 mr-1">Ch.{idx + 1}</span> {ch.title}</span>
                    <span className="text-xs text-slate-400 ml-auto bg-slate-100 px-2 py-0.5 rounded">pp. {ch.startPage}-{ch.endPage}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Notes/Lectures Section */}
            {course.lectures.length > 0 && (
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-1 mt-2">Notes & Lectures</div>
                {course.lectures.map((lec) => (
                  <label key={lec.id} className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer transition-colors">
                    <input type="checkbox" checked={selectedIds.includes(lec.id)} onChange={() => toggleSelection(lec.id)} className="rounded text-primary focus:ring-primary" />
                    <i className={`fas ${lec.sourceType === 'upload' ? 'fa-file-alt text-amber-500' : 'fa-microphone text-purple-500'} w-4`}></i>
                    <div className="flex-1">
                       <div className="text-sm font-medium text-slate-700">{lec.title}</div>
                       <div className="text-[10px] text-slate-400">{formatDate(lec.date)}</div>
                    </div>
                  </label>
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
              <span className="text-xs font-bold text-primary">{difficulty === 1 ? 'Basic' : difficulty === 3 ? 'Intermediate' : 'Advanced'}</span>
            </div>
            <input type="range" min="1" max="5" step="2" value={difficulty} onChange={e => setDifficulty(Number(e.target.value))} className="w-full accent-primary h-1 bg-slate-200 rounded appearance-none" />
          </div>
          <div>
             <div className="flex justify-between mb-2">
              <label className="text-xs font-bold text-slate-400 uppercase">3. Item Count</label>
              <span className="text-xs font-bold text-primary">{itemCount} items</span>
            </div>
            <input type="range" min="5" max="30" step="5" value={itemCount} onChange={e => setItemCount(Number(e.target.value))} className="w-full accent-primary h-1 bg-slate-200 rounded appearance-none" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <GenBtn icon="fa-bolt" label="Flashcards" onClick={() => handleGenerate(ContentType.FLASHCARDS)} loading={generating} status={status} />
          <GenBtn icon="fa-question-circle" label="Quiz" onClick={() => handleGenerate(ContentType.QUIZ)} loading={generating} status={status} />
          <GenBtn icon="fa-align-left" label="Summary" onClick={() => handleGenerate(ContentType.NOTES)} loading={generating} status={status} />
        </div>
      </div>

      {/* Preview Modal */}
      <Modal isOpen={!!preview} onClose={() => setPreview(null)} title="Preview Generated Content" maxWidth="max-w-3xl">
        <div className="bg-slate-50 p-4 rounded border border-slate-200 mb-4 h-[60vh] overflow-y-auto">
          {preview?.type === ContentType.FLASHCARDS && (
            <div className="flex items-center justify-center h-full">
              <FlashcardViewer cards={preview.data as Flashcard[]} />
            </div>
          )}
          {preview?.type === ContentType.QUIZ && (
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
        <div className="flex justify-between items-center">
          <button 
             onClick={() => handleGenerate(preview!.type)} 
             className="text-primary hover:text-blue-700 font-bold text-sm flex items-center"
             disabled={generating}
          >
             <i className={`fas fa-sync-alt mr-2 ${generating ? 'fa-spin' : ''}`}></i> Regenerate
          </button>
          <div className="flex gap-2">
            <button onClick={() => setPreview(null)} className="px-4 py-2 text-slate-500">Discard</button>
            <button onClick={saveMaterial} className="px-6 py-2 bg-primary text-white rounded font-bold hover:bg-blue-600 shadow-sm">Save to Library</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};