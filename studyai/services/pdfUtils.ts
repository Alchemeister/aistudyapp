import * as pdfjsLib from 'pdfjs-dist';

// Handle ESM/CJS interop for pdfjs-dist
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

if (pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

export interface PdfDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<any>;
}

export const loadPdfDocument = async (url: string): Promise<PdfDocument> => {
  try {
    const loadingTask = pdfjs.getDocument(url);
    const pdf = await loadingTask.promise;
    return pdf;
  } catch (error) {
    console.error("Error loading PDF:", error);
    throw new Error("Failed to load PDF document.");
  }
};

export const extractTextFromRange = async (
  pdf: PdfDocument, 
  startPage: number, 
  endPage: number,
  onProgress?: (current: number) => void
): Promise<string> => {
  let fullText = "";
  const start = Math.max(1, startPage);
  const end = Math.min(pdf.numPages, endPage);

  for (let i = start; i <= end; i++) {
    if (onProgress) onProgress(i);
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');
      // Adding clear delimiters helps the AI understand page boundaries vs content
      fullText += `[Page ${i}]\n${pageText}\n`;
    } catch (e) {
      console.warn(`Failed to extract text from page ${i}`, e);
    }
  }
  return fullText;
};

export const extractAllText = async (pdf: PdfDocument): Promise<string> => {
  return await extractTextFromRange(pdf, 1, pdf.numPages);
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