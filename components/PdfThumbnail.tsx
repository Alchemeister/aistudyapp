import React, { useEffect, useRef, useState, type FC } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { get, set } from 'idb-keyval';
import { loadPdfDocument } from '../services/pdfUtils';

// Cache key prefix for thumbnails
const THUMB_CACHE_PREFIX = 'pdf_thumb_';

// Generate cache key from URL (use last part of blob URL as identifier)
const getCacheKey = (url: string): string => {
  // For blob URLs, extract the unique ID
  if (url.startsWith('blob:')) {
    const id = url.split('/').pop() || url;
    return `${THUMB_CACHE_PREFIX}${id}`;
  }
  // For other URLs, use a simple hash
  return `${THUMB_CACHE_PREFIX}${url.slice(-50).replace(/[^a-zA-Z0-9]/g, '_')}`;
};

interface Props {
  pdfUrl?: string;
  courseId?: string; // Optional stable ID for caching
  className?: string;
}

export const PdfThumbnail: FC<Props> = ({ pdfUrl, courseId, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cachedImage, setCachedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!pdfUrl) {
      setLoading(false);
      setError(true);
      return;
    }

    let active = true;
    const cacheKey = courseId ? `${THUMB_CACHE_PREFIX}${courseId}` : getCacheKey(pdfUrl);

    const loadThumbnail = async () => {
      // Try cache first
      try {
        const cached = await get<string>(cacheKey);
        if (cached && active) {
          setCachedImage(cached);
          setLoading(false);
          return;
        }
      } catch (e) {
        // Cache miss, continue to render
      }

      // Render from PDF
      if (!canvasRef.current) return;

      try {
        const pdf = await loadPdfDocument(pdfUrl);
        if (!active || !canvasRef.current) return;

        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.3 });

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
          // Cache the rendered thumbnail
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          set(cacheKey, dataUrl).catch(() => {}); // Fire and forget

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

    loadThumbnail();
    return () => { active = false; };
  }, [pdfUrl, courseId]);

  if (!pdfUrl || error) {
    return (
      <div className={`flex items-center justify-center bg-slate-50 dark:bg-slate-700 ${className}`}>
        <FileText className="w-6 h-6 text-slate-300 dark:text-slate-500" />
      </div>
    );
  }

  // Show cached image if available
  if (cachedImage) {
    return (
      <div className={`overflow-hidden bg-slate-100 dark:bg-slate-700 ${className}`}>
        <img src={cachedImage} alt="PDF thumbnail" className="w-full h-full object-cover" />
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
