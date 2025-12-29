import { get, set, del } from 'idb-keyval';
import { Course, ContentType, Difficulty } from '../types';

const COURSES_KEY = 'studyai_courses_v3';
const BLOB_PREFIX = 'pdf_blob_';

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
    return rest;
  });
  await set(COURSES_KEY, toSave);
};

export const loadCourses = async (): Promise<Course[]> => {
  const courses = await get<Course[]>(COURSES_KEY) || [];
  
  // Rehydrate Blob URLs
  const hydrated = await Promise.all(courses.map(async (c) => {
    if (c.pdfBlobId) {
      const blob = await get<Blob>(c.pdfBlobId);
      if (blob) {
        return { ...c, pdfUrl: URL.createObjectURL(blob) };
      }
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

export const getPdfBlob = async (blobId: string): Promise<Blob | undefined> => {
  return await get<Blob>(blobId);
};

export const deleteCourseData = async (course: Course): Promise<void> => {
  if (course.pdfBlobId) {
    await del(course.pdfBlobId);
  }
  // If we had audio blobs, we'd delete them here too
};

export const seedInitialData = async (): Promise<Course[]> => {
  const existing = await loadCourses();
  if (existing.length === 0) {
    await saveCourses(SAMPLE_DATA);
    return SAMPLE_DATA;
  }
  return existing;
};