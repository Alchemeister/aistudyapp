import React, { useEffect, useRef, useState, type FC } from 'react';
import { loadPdfDocument, renderPageToCanvas, PdfDocument } from '../services/pdfUtils';

interface Props {
  url: string;
  initialPage?: number;
}

export const PdfViewer: FC<Props> = ({ url, initialPage = 1 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  const [pageNum, setPageNum] = useState(initialPage);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const doc = await loadPdfDocument(url);
        if (active) {
          setPdf(doc);
          setLoading(false);
        }
      } catch (e) {
        if (active) {
          setError("Failed to load PDF. Security restrictions may block some OpenStax URLs.");
          setLoading(false);
        }
      }
    };
    if (url) load();
    return () => { active = false; };
  }, [url]);

  useEffect(() => {
    if (pdf && canvasRef.current) {
      renderPageToCanvas(pdf, pageNum, canvasRef.current, scale);
    }
  }, [pdf, pageNum, scale]);

  const changePage = (offset: number) => {
    if (!pdf) return;
    setPageNum(prev => Math.min(Math.max(1, prev + offset), pdf.numPages));
  };

  if (!url) return <div className="h-full flex items-center justify-center text-slate-400">No PDF Loaded</div>;
  if (loading) return <div className="h-full flex items-center justify-center text-primary"><i className="fas fa-circle-notch fa-spin text-3xl"></i></div>;
  if (error) return <div className="h-full flex flex-col items-center justify-center text-red-400 p-4 text-center"><i className="fas fa-exclamation-circle text-3xl mb-2"></i><p>{error}</p></div>;

  return (
    <div className="flex flex-col h-full bg-slate-100">
      {/* Toolbar */}
      <div className="bg-slate-800 text-white p-2 flex justify-between items-center shadow-md z-10">
        <div className="flex items-center gap-1 sm:gap-2">
           <button onClick={() => changePage(-1)} disabled={pageNum <= 1} className="p-2 sm:px-3 bg-slate-700 rounded hover:bg-slate-600 disabled:opacity-50 min-w-[40px] min-h-[40px] flex items-center justify-center"><i className="fas fa-chevron-left"></i></button>
           <span className="text-xs sm:text-sm font-mono px-1">{pageNum} / {pdf?.numPages}</span>
           <button onClick={() => changePage(1)} disabled={pageNum >= (pdf?.numPages || 0)} className="p-2 sm:px-3 bg-slate-700 rounded hover:bg-slate-600 disabled:opacity-50 min-w-[40px] min-h-[40px] flex items-center justify-center"><i className="fas fa-chevron-right"></i></button>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-2 hover:text-blue-300 min-w-[40px] min-h-[40px] flex items-center justify-center"><i className="fas fa-minus-circle"></i></button>
          <span className="text-xs font-mono w-10 sm:w-12 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3.0, s + 0.25))} className="p-2 hover:text-blue-300 min-w-[40px] min-h-[40px] flex items-center justify-center"><i className="fas fa-plus-circle"></i></button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-auto flex justify-center p-4 bg-slate-200">
        <div className="shadow-lg">
          <canvas ref={canvasRef} className="bg-white" />
        </div>
      </div>
    </div>
  );
};