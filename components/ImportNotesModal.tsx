import React, { useState, type FC, type ChangeEvent } from 'react';
import { loadPdfDocument, extractAllText } from '../services/pdfUtils';
import { Lecture } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (note: Partial<Lecture>) => void;
  onToast: (msg: string, type: 'success'|'error'|'info') => void;
}

const uuid = () => Math.random().toString(36).substring(2, 9);

export const ImportNotesModal: FC<Props> = ({ isOpen, onClose, onSave, onToast }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      // Auto-set title from filename (remove extension)
      setTitle(f.name.replace(/\.[^/.]+$/, ""));
    }
  };

  // Extract text from DOCX (simplified - extracts raw text from XML)
  const extractDocxText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // DOCX is a ZIP file - find document.xml content
    // Simple extraction without full ZIP library
    const text = new TextDecoder().decode(uint8Array);

    // Look for text between <w:t> tags (Word text elements)
    const matches = text.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
    const extractedText = matches
      .map(m => m.replace(/<[^>]+>/g, ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (extractedText.length > 50) {
      return extractedText;
    }

    // Fallback: try to extract any readable text
    const readable = text.replace(/<[^>]+>/g, ' ').replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ').trim();
    return readable.substring(0, 50000); // Limit size
  };

  const processFile = async () => {
    if (!file) return;
    setLoading(true);
    try {
      let content = "";
      const fileName = file.name.toLowerCase();

      if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
        const fileUrl = URL.createObjectURL(file);
        const doc = await loadPdfDocument(fileUrl);
        content = await extractAllText(doc);
        URL.revokeObjectURL(fileUrl);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
        content = await extractDocxText(file);
      } else if (fileName.endsWith('.rtf')) {
        // Basic RTF - strip RTF codes
        const raw = await file.text();
        content = raw.replace(/\{\\[^{}]+\}|\\[a-z]+\d*\s?/gi, '').replace(/[{}]/g, '').trim();
      } else {
        // Plain text, Markdown, or other text files
        content = await file.text();
      }

      const note: Partial<Lecture> = {
        id: uuid(),
        title: title || "Imported Note",
        date: new Date().toISOString(),
        transcript: content,
        sourceType: 'upload',
        fileName: file.name
      };

      onSave(note);
      onToast("Notes imported successfully!", "success");
      onClose();
      setFile(null);
      setTitle('');
    } catch (e) {
      console.error(e);
      onToast("Failed to parse file.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md animate-fade-in-up overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">Import Notes</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times"></i></button>
        </div>
        
        <div className="p-6 space-y-6">
           {/* Drop Area */}
           <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors relative group cursor-pointer">
              <input
                type="file"
                accept=".txt,.md,.pdf,.docx,.rtf,.doc"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {file ? (
                <div className="text-primary">
                    <i className="fas fa-file-alt text-3xl mb-2"></i>
                    <p className="font-bold text-sm truncate px-4">{file.name}</p>
                    <p className="text-xs text-slate-400 mt-1">Click to replace</p>
                </div>
              ) : (
                <div className="text-slate-400">
                    <i className="fas fa-cloud-upload-alt text-3xl mb-2 group-hover:text-primary transition-colors"></i>
                    <p className="font-bold text-sm text-slate-600">Click to Upload</p>
                    <p className="text-xs mt-1">PDF, DOCX, TXT, MD, RTF</p>
                </div>
              )}
           </div>

           {file && (
             <div>
               <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Title</label>
               <input 
                 className="w-full p-2 border border-slate-300 rounded text-sm font-bold text-slate-800 focus:ring-primary outline-none"
                 value={title}
                 onChange={(e) => setTitle(e.target.value)}
                 placeholder="Name your notes"
               />
             </div>
           )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-500 font-medium hover:text-slate-700">Cancel</button>
          <button 
            onClick={processFile} 
            disabled={!file || loading}
            className="px-6 py-2 bg-primary text-white rounded-lg font-bold disabled:opacity-50 flex items-center gap-2 hover:bg-blue-600 transition-colors"
          >
            {loading && <i className="fas fa-circle-notch fa-spin"></i>}
            {loading ? 'Importing...' : 'Import Notes'}
          </button>
        </div>
      </div>
    </div>
  );
};