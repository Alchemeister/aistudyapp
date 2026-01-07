
import * as pdfjsLib from 'pdfjs-dist';

// Handle ESM/CJS interop for pdfjs-dist
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// CRITICAL: Match this worker version exactly with package.json "pdfjs-dist" version.
pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export interface PdfDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<any>;
}

export const loadPdfDocument = async (url: string): Promise<PdfDocument> => {
  if (!url) {
    throw new Error("PDF URL is missing");
  }

  try {
     if (typeof url !== 'string') throw new Error("URL must be a string");
     if (!url.startsWith('blob:') && !url.startsWith('data:')) {
        new URL(url, window.location.href);
     }
  } catch (e) {
     console.error("Invalid URL:", url);
     throw new Error("Invalid PDF URL format.");
  }

  try {
    const loadingTask = pdfjs.getDocument(url);
    const pdf = await loadingTask.promise;
    return pdf;
  } catch (error: any) {
    console.error("Error loading PDF:", error);
    if (error.message && error.message.includes('version')) {
        throw new Error(`PDF Version Mismatch: Main thread is v${pdfjs.version}, Worker is v3.11.174.`);
    }
    throw new Error("Failed to load PDF. Security restrictions may block this file.");
  }
};

export const extractTextFromRange = async (
  pdf: PdfDocument, 
  startPage: number, 
  endPage: number,
  onProgress?: (current: number, total: number) => void
): Promise<string> => {
  const start = Math.max(1, startPage);
  const end = Math.min(pdf.numPages, endPage);
  const totalPages = end - start + 1;
  
  // Create an array of page numbers to fetch
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => start + i);

  let completed = 0;

  const pagePromises = pageNumbers.map(async (pageNum) => {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Improved text joining strategy
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim();

      completed++;
      if (onProgress) onProgress(completed, totalPages);

      return `[Page ${pageNum}]\n${pageText}`;
    } catch (e) {
      console.warn(`Failed to extract text from page ${pageNum}`, e);
      return `[Page ${pageNum}] (Extraction Failed)`;
    }
  });

  const pageTexts = await Promise.all(pagePromises);
  return pageTexts.join('\n\n');
};

export const extractAllText = async (pdf: PdfDocument): Promise<string> => {
  return await extractTextFromRange(pdf, 1, pdf.numPages);
};

// Extract text from a page range for TOC detection
export const extractTOCText = async (
  pdf: PdfDocument,
  startPage: number = 1,
  endPage: number = 30,
  onProgress?: (current: number, total: number) => void
): Promise<string> => {
  const start = Math.max(1, startPage);
  const end = Math.min(endPage, pdf.numPages);
  return await extractTextFromRange(pdf, start, end, onProgress);
};

export const renderPageToCanvas = async (
  pdf: PdfDocument,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.0
) => {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const outputScale = window.devicePixelRatio || 1;

  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = Math.floor(viewport.width) + "px";
  canvas.style.height = Math.floor(viewport.height) + "px";

  const transform = outputScale !== 1 
    ? [outputScale, 0, 0, outputScale, 0, 0] 
    : null;

  const renderContext = {
    canvasContext: canvas.getContext('2d')!,
    transform: transform,
    viewport: viewport,
  };

  await page.render(renderContext).promise;
};

// Generate a small thumbnail of the first page as base64
export const generatePdfThumbnail = async (
  pdf: PdfDocument,
  width: number = 200
): Promise<string> => {
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.0 });

  // Calculate scale to fit desired width
  const scale = width / viewport.width;
  const scaledViewport = page.getViewport({ scale });

  // Create offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;

  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx,
    viewport: scaledViewport,
  }).promise;

  // Convert to base64 JPEG (smaller than PNG)
  return canvas.toDataURL('image/jpeg', 0.7);
};
