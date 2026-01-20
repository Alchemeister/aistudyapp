import React, { useEffect, useRef, useState, type FC } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { loadPdfDocument, renderPageToCanvas } from '../services/pdfUtils';

interface Props {
  pdfUrl?: string;
  className?: string;
}

export const PdfThumbnail: FC<Props> = ({ pdfUrl, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!pdfUrl || !canvasRef.current) {
      setLoading(false);
      setError(true);
      return;
    }

    let active = true;

    const renderThumbnail = async () => {
      try {
        const pdf = await loadPdfDocument(pdfUrl);
        if (!active || !canvasRef.current) return;

        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.3 }); // Small scale for thumbnail

        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        await page.render({
          canvasContext: ctx,
          viewport: viewport,
        }).promise;

        if (active) {
          setLoading(false);
          setError(false);
        }
      } catch (e) {
        if (active) {
          setLoading(false);
          setError(true);
        }
      }
    };

    renderThumbnail();
    return () => { active = false; };
  }, [pdfUrl]);

  if (!pdfUrl || error) {
    return (
      <div className={`flex items-center justify-center bg-slate-50 dark:bg-slate-700 ${className}`}>
        <FileText className="w-6 h-6 text-slate-300 dark:text-slate-500" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-slate-100 dark:bg-slate-700 ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`w-full h-full object-cover ${loading ? 'opacity-0' : 'opacity-100'}`}
        style={{ transition: 'opacity 0.2s' }}
      />
    </div>
  );
};
