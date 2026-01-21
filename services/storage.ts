
import { get, set, del, clear } from 'idb-keyval';
import { Course, ContentType, Difficulty } from '../types';
import { uploadPdfToCloud, deleteCloudPdf, downloadCloudPdf, uploadThumbnailToCloud, downloadCloudThumbnail } from './pdfCloudStorage';
import { loadPdfDocument } from './pdfUtils';

const COURSES_KEY = 'studystack_courses_v3';
const BLOB_PREFIX = 'pdf_blob_';
const MEDIA_PREFIX = 'media_blob_';

// --- Seed Data ---
const SAMPLE_DATA: Course[] = [
  {
    id: 'seed-bio-101',
    title: 'Introduction to Biology',
    subtitle: 'Fall 2024 - Prof. Smith',
    semester: 'Fall 2024',
    code: 'BIO101',
    description: 'A comprehensive introduction to cell biology, genetics, and evolution.',
    pdfName: 'OpenStax Biology 2e (Sample)',
    chapters: [
      {
        id: 'ch-1',
        title: 'The Cell Structure',
        startPage: 15,
        endPage: 45,
        extractedText: "Cells are the basic units of life. The plasma membrane allows nutrients to enter. Mitochondria generate ATP through cellular respiration."
      }
    ],
    lectures: [],
    materials: [
      {
        id: 'mat-1',
        type: ContentType.FLASHCARDS,
        title: 'Cell Basics Flashcards',
        difficulty: Difficulty.EASY,
        createdAt: new Date().toISOString(),
        sourceChapterIds: ['ch-1'],
        content: [
          { 
            id: 'fc-1', 
            front: 'What is the powerhouse of the cell?', 
            back: 'Mitochondria', 
            mastered: false,
            dueDate: new Date().toISOString(), // Due now
            interval: 0,
            easeFactor: 2.5,
            reps: 0,
            lapses: 0
          },
          { 
            id: 'fc-2', 
            front: 'What defines a Eukaryotic cell?', 
            back: 'Presence of a membrane-bound nucleus', 
            mastered: true,
            dueDate: new Date(Date.now() + 86400000 * 3).toISOString(), // Due in 3 days
            interval: 3,
            easeFactor: 2.6,
            reps: 1,
            lapses: 0
          }
        ]
      }
    ],
    quizHistory: []
  }
];

// --- API ---

export const saveCourses = async (courses: Course[]): Promise<void> => {
  // We strip transient URLs before saving to DB
  const toSave = courses.map(c => {
    const { pdfUrl, ...rest } = c;
    // Also strip lecture audioUrls
    rest.lectures = rest.lectures.map(l => {
        const { audioUrl, ...lRest } = l;
        return lRest;
    });
    return rest;
  });
  await set(COURSES_KEY, toSave);
};

export const loadCourses = async (): Promise<Course[]> => {
  const courses = await get<Course[]>(COURSES_KEY) || [];

  // Rehydrate Blob URLs (PDF and Audio)
  const hydrated = await Promise.all(courses.map(async (c) => {
    // 1. Rehydrate PDF - try local first, then cloud for Pro users
    let pdfLoaded = false;

    // Try local blob first (fastest)
    if (c.pdfBlobId) {
      const blob = await get<Blob>(c.pdfBlobId);
      if (blob) {
        c.pdfUrl = URL.createObjectURL(blob);
        pdfLoaded = true;
      }
    }

    // If local missing but cloud path exists, try downloading from cloud (Pro users)
    if (!pdfLoaded && c.cloudPdfPath) {
      try {
        console.log(`[loadCourses] Downloading PDF from cloud for: ${c.title}`);
        const cloudBlob = await downloadCloudPdf(c.cloudPdfPath);
        if (cloudBlob) {
          // Save to local for faster access next time
          const blobId = `pdf_blob_${c.id}_${Date.now()}`;
          await set(blobId, cloudBlob);
          c.pdfBlobId = blobId;
          c.pdfUrl = URL.createObjectURL(cloudBlob);
          pdfLoaded = true;
          console.log(`[loadCourses] Cloud PDF downloaded and cached locally: ${c.title}`);
        }
      } catch (e) {
        console.error(`[loadCourses] Failed to download cloud PDF for: ${c.title}`, e);
      }
    }

    if (!pdfLoaded && (c.pdfBlobId || c.cloudPdfPath)) {
      console.log(`[loadCourses] PDF not available for: ${c.title} (re-upload required)`);
    }

    // 2. Rehydrate Lectures
    if (c.lectures) {
        c.lectures = await Promise.all(c.lectures.map(async (l) => {
            if (l.audioBlobId) {
                const blob = await get<Blob>(l.audioBlobId);
                if (blob) {
                    return { ...l, audioUrl: URL.createObjectURL(blob) };
                }
            }
            return l;
        }));
    }

    // Backward compatibility for existing data
    if (!c.semester) c.semester = 'Fall 2024';
    return c;
  }));

  return hydrated;
};

/**
 * Rehydrate cloud thumbnails for courses (fast - only small images)
 * PDFs are downloaded lazily when course is opened
 * Call this AFTER merging cloud data on a new device
 */
export const rehydrateCloudPdfs = async (courses: Course[]): Promise<Course[]> => {
  console.log(`[rehydrateCloudThumbnails] Starting for ${courses.length} courses`);

  const updated = await Promise.all(courses.map(async (c) => {
    // Skip if already has local PDF URL (fully loaded)
    if (c.pdfUrl) {
      return c;
    }

    // Skip if no cloud thumbnail path
    if (!c.cloudThumbnailPath) {
      return c;
    }

    // Skip if already have local thumbnail cached
    const thumbCacheKey = `pdf_thumb_${c.id}`;
    const existingThumb = await get<string>(thumbCacheKey);
    if (existingThumb) {
      return c;
    }

    try {
      console.log(`[rehydrateCloudThumbnails] ${c.title}: Downloading thumbnail`);
      const thumbBlob = await downloadCloudThumbnail(c.cloudThumbnailPath);
      if (thumbBlob) {
        // Cache thumbnail as data URL for fast display
        const dataUrl = await blobToDataUrl(thumbBlob);
        await set(thumbCacheKey, dataUrl);
        console.log(`[rehydrateCloudThumbnails] ${c.title}: Cached thumbnail (${thumbBlob.size} bytes)`);
      }
    } catch (e) {
      console.error(`[rehydrateCloudThumbnails] ${c.title}: Thumbnail download failed`, e);
    }

    return c;
  }));

  console.log(`[rehydrateCloudThumbnails] Complete`);
  return updated;
};

/**
 * Convert blob to data URL
 */
const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Download PDF on demand when opening a course
 * Returns updated course with pdfUrl and pdfBlobId
 */
export const downloadPdfOnDemand = async (course: Course): Promise<Course> => {
  // Already has local PDF
  if (course.pdfUrl && course.pdfBlobId) {
    return course;
  }

  // No cloud path to download from
  if (!course.cloudPdfPath) {
    return course;
  }

  console.log(`[downloadPdfOnDemand] ${course.title}: Downloading PDF...`);

  try {
    const cloudBlob = await downloadCloudPdf(course.cloudPdfPath);
    if (cloudBlob) {
      const blobId = `pdf_blob_${course.id}_${Date.now()}`;
      await set(blobId, cloudBlob);
      const pdfUrl = URL.createObjectURL(cloudBlob);
      console.log(`[downloadPdfOnDemand] ${course.title}: Downloaded ${cloudBlob.size} bytes`);

      return {
        ...course,
        pdfBlobId: blobId,
        pdfUrl,
      };
    }
  } catch (e) {
    console.error(`[downloadPdfOnDemand] ${course.title}: Download failed`, e);
  }

  return course;
};

export const savePdfBlob = async (courseId: string, file: File | Blob): Promise<string> => {
  const blobId = `${BLOB_PREFIX}${courseId}_${Date.now()}`;
  await set(blobId, file);
  return blobId;
};

/**
 * Generate a thumbnail blob from a PDF
 */
const generateThumbnailFromPdf = async (pdfBlob: Blob): Promise<Blob | null> => {
  try {
    const url = URL.createObjectURL(pdfBlob);
    const pdf = await loadPdfDocument(url);
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.4 }); // Small thumbnail

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(url);
      return null;
    }

    await page.render({ canvasContext: ctx, viewport }).promise;
    URL.revokeObjectURL(url);

    // Convert to JPEG blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
    });
  } catch (e) {
    console.error('Failed to generate thumbnail:', e);
    return null;
  }
};

/**
 * Save PDF both locally and to cloud (for Pro users)
 * Also generates and uploads a thumbnail for fast loading
 * Returns { blobId, cloudPdfPath, cloudThumbnailPath }
 */
export const savePdfWithCloud = async (
  userId: string,
  courseId: string,
  file: File | Blob,
  fileName?: string
): Promise<{ blobId: string; cloudPdfPath: string | null; cloudThumbnailPath: string | null }> => {
  // Always save locally first
  const blobId = await savePdfBlob(courseId, file);

  // Try to upload to cloud (will check Pro status internally)
  let cloudPdfPath: string | null = null;
  let cloudThumbnailPath: string | null = null;

  try {
    cloudPdfPath = await uploadPdfToCloud(userId, courseId, file, fileName);
    if (cloudPdfPath) {
      console.log(`PDF uploaded to cloud: ${cloudPdfPath}`);

      // Generate and upload thumbnail
      const thumbnailBlob = await generateThumbnailFromPdf(file);
      if (thumbnailBlob) {
        cloudThumbnailPath = await uploadThumbnailToCloud(userId, courseId, thumbnailBlob);
        if (cloudThumbnailPath) {
          console.log(`Thumbnail uploaded to cloud: ${cloudThumbnailPath}`);
        }
      }
    }
  } catch (e) {
    console.error('Cloud upload failed (continuing with local only):', e);
  }

  return { blobId, cloudPdfPath, cloudThumbnailPath };
};

export const saveMediaBlob = async (courseId: string, file: Blob): Promise<string> => {
    const blobId = `${MEDIA_PREFIX}${courseId}_${Date.now()}`;
    await set(blobId, file);
    return blobId;
};

export const getPdfBlob = async (blobId: string): Promise<Blob | undefined> => {
  return await get<Blob>(blobId);
};

export const getMediaBlob = async (blobId: string): Promise<Blob | undefined> => {
    return await get<Blob>(blobId);
};

export const deleteCourseData = async (course: Course): Promise<void> => {
  // Delete local PDF blob
  if (course.pdfBlobId) {
    await del(course.pdfBlobId);
  }

  // Delete cloud PDF if exists
  if (course.cloudPdfPath) {
    try {
      await deleteCloudPdf(course.cloudPdfPath);
    } catch (e) {
      console.error('Failed to delete cloud PDF:', e);
    }
  }

  // Delete all audio blobs associated with lectures
  for (const l of course.lectures) {
      if (l.audioBlobId) {
          await del(l.audioBlobId);
      }
  }
};

export const clearDatabase = async (): Promise<void> => {
    await clear();
};

export const seedInitialData = async (isDemoAccount: boolean = false): Promise<Course[]> => {
  const existing = await loadCourses();
  // Only seed demo data for demo accounts with no existing courses
  if (existing.length === 0 && isDemoAccount) {
    await saveCourses(SAMPLE_DATA);
    return SAMPLE_DATA;
  }
  return existing;
};
