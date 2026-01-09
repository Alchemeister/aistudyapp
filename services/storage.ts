
import { get, set, del, clear } from 'idb-keyval';
import { Course, ContentType, Difficulty } from '../types';
import { uploadPdfToCloud, downloadCloudPdf, deleteCloudPdf, getCloudPdfUrl } from './pdfCloudStorage';

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
    // 1. Rehydrate PDF - try local first, then cloud
    if (c.pdfBlobId) {
      const blob = await get<Blob>(c.pdfBlobId);
      if (blob) {
        c.pdfUrl = URL.createObjectURL(blob);
      } else if (c.cloudPdfPath) {
        // Local blob missing but cloud path exists - download from cloud
        console.log(`Downloading PDF from cloud for course: ${c.title}`);
        const cloudBlob = await downloadCloudPdf(c.cloudPdfPath);
        if (cloudBlob) {
          // Save to local IndexedDB for offline access
          await set(c.pdfBlobId, cloudBlob);
          c.pdfUrl = URL.createObjectURL(cloudBlob);
          console.log(`Cached cloud PDF locally: ${c.title}`);
        }
      }
    } else if (c.cloudPdfPath) {
      // No local blob ID but cloud path exists (new device scenario)
      console.log(`Downloading PDF from cloud (new device) for course: ${c.title}`);
      const cloudBlob = await downloadCloudPdf(c.cloudPdfPath);
      if (cloudBlob) {
        // Create local blob ID and save
        const blobId = `${BLOB_PREFIX}${c.id}_${Date.now()}`;
        await set(blobId, cloudBlob);
        c.pdfBlobId = blobId;
        c.pdfUrl = URL.createObjectURL(cloudBlob);
        console.log(`Cached cloud PDF locally: ${c.title}`);
      }
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

export const savePdfBlob = async (courseId: string, file: File | Blob): Promise<string> => {
  const blobId = `${BLOB_PREFIX}${courseId}_${Date.now()}`;
  await set(blobId, file);
  return blobId;
};

/**
 * Save PDF both locally and to cloud (for Pro users)
 * Returns { blobId, cloudPdfPath }
 */
export const savePdfWithCloud = async (
  userId: string,
  courseId: string,
  file: File | Blob,
  fileName?: string
): Promise<{ blobId: string; cloudPdfPath: string | null }> => {
  // Always save locally first
  const blobId = await savePdfBlob(courseId, file);

  // Try to upload to cloud (will check Pro status internally)
  let cloudPdfPath: string | null = null;
  try {
    cloudPdfPath = await uploadPdfToCloud(userId, courseId, file, fileName);
    if (cloudPdfPath) {
      console.log(`PDF uploaded to cloud: ${cloudPdfPath}`);
    }
  } catch (e) {
    console.error('Cloud upload failed (continuing with local only):', e);
  }

  return { blobId, cloudPdfPath };
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
