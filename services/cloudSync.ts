
import { db, isConfigured, doc, setDoc, getDoc, collection, getDocs, deleteDoc, writeBatch } from './firebase';
import { Course } from '../types';

// Cloud sync service for Firestore
// Blobs (PDFs, audio) stay in IndexedDB - only metadata syncs to cloud

const COURSES_COLLECTION = 'courses';

// Helper to remove undefined values (Firestore doesn't accept them)
const removeUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(removeUndefined);
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefined(value);
      }
    }
    return cleaned;
  }
  return obj;
};

// Helper to strip transient data before saving to cloud
const prepareForCloud = (course: Course): Record<string, any> => {
  const { pdfUrl, pdfThumbnail, pdfBlobId, ...rest } = course;
  // Strip lecture audioUrls and audioBlobIds (transient/local only)
  const cleanedLectures = rest.lectures.map(l => {
    const { audioUrl, audioBlobId, ...lRest } = l;
    return lRest;
  });

  return removeUndefined({
    ...rest,
    lectures: cleanedLectures,
    // Store blob IDs as null if they exist (so we know there WAS a file)
    hasPdf: !!pdfBlobId,
  });
};

// Get user's courses collection path
const getUserCoursesPath = (userId: string) => `users/${userId}/${COURSES_COLLECTION}`;

// Save a single course to Firestore
export const saveCloudCourse = async (userId: string, course: Course): Promise<void> => {
  if (!isConfigured || !db) {
    console.log('Cloud sync skipped: Firebase not configured');
    return;
  }

  try {
    const cloudData = prepareForCloud(course);
    const docRef = doc(db, getUserCoursesPath(userId), course.id);
    await setDoc(docRef, {
      ...cloudData,
      updatedAt: new Date().toISOString()
    });
    console.log(`☁️ Synced course: ${course.title}`);
  } catch (error) {
    console.error('Cloud sync failed for course:', course.id, error);
    throw error;
  }
};

// Save all courses to Firestore (batch write for efficiency)
export const saveAllCloudCourses = async (userId: string, courses: Course[]): Promise<void> => {
  if (!isConfigured || !db) {
    console.log('Cloud sync skipped: Firebase not configured');
    return;
  }

  try {
    const batch = writeBatch(db);

    for (const course of courses) {
      const cloudData = prepareForCloud(course);
      const docRef = doc(db, getUserCoursesPath(userId), course.id);
      batch.set(docRef, {
        ...cloudData,
        updatedAt: new Date().toISOString()
      });
    }

    await batch.commit();
    console.log(`☁️ Synced ${courses.length} courses to cloud`);
  } catch (error) {
    console.error('Cloud batch sync failed:', error);
    throw error;
  }
};

// Load all courses from Firestore
export const loadCloudCourses = async (userId: string): Promise<Course[]> => {
  if (!isConfigured || !db) {
    console.log('Cloud load skipped: Firebase not configured');
    return [];
  }

  try {
    const coursesRef = collection(db, getUserCoursesPath(userId));
    const snapshot = await getDocs(coursesRef);

    const courses: Course[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as Course & { updatedAt?: string };
      // Remove our internal updatedAt field
      const { updatedAt, ...courseData } = data;
      courses.push(courseData as Course);
    });

    console.log(`☁️ Loaded ${courses.length} courses from cloud`);
    return courses;
  } catch (error) {
    console.error('Cloud load failed:', error);
    throw error;
  }
};

// Delete a course from Firestore
export const deleteCloudCourse = async (userId: string, courseId: string): Promise<void> => {
  if (!isConfigured || !db) {
    console.log('Cloud delete skipped: Firebase not configured');
    return;
  }

  try {
    const docRef = doc(db, getUserCoursesPath(userId), courseId);
    await deleteDoc(docRef);
    console.log(`☁️ Deleted course from cloud: ${courseId}`);
  } catch (error) {
    console.error('Cloud delete failed:', error);
    throw error;
  }
};

// Merge local and cloud courses (cloud wins for conflicts, keeps local blobs)
export const mergeCourses = (local: Course[], cloud: Course[]): Course[] => {
  const merged = new Map<string, Course>();

  // Add all local courses first (preserves blob IDs and URLs)
  local.forEach(c => merged.set(c.id, c));

  // Merge cloud data, keeping local blob references
  cloud.forEach(cloudCourse => {
    const localCourse = merged.get(cloudCourse.id);

    if (localCourse) {
      // Merge: cloud data + local blob references
      merged.set(cloudCourse.id, {
        ...cloudCourse,
        pdfUrl: localCourse.pdfUrl,
        pdfBlobId: localCourse.pdfBlobId,
        pdfThumbnail: localCourse.pdfThumbnail,
        lectures: cloudCourse.lectures.map(cloudLecture => {
          const localLecture = localCourse.lectures.find(l => l.id === cloudLecture.id);
          return {
            ...cloudLecture,
            audioUrl: localLecture?.audioUrl,
            audioBlobId: localLecture?.audioBlobId
          };
        })
      });
    } else {
      // New cloud course, add it (won't have local blobs)
      merged.set(cloudCourse.id, cloudCourse);
    }
  });

  return Array.from(merged.values());
};

// Debounced sync helper
let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingCourses: Course[] | null = null;

export const debouncedCloudSync = (userId: string, courses: Course[], delay: number = 2000): void => {
  pendingCourses = courses;

  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(async () => {
    if (pendingCourses) {
      try {
        await saveAllCloudCourses(userId, pendingCourses);
      } catch (error) {
        console.error('Debounced sync failed:', error);
      }
      pendingCourses = null;
    }
  }, delay);
};

// Force immediate sync (for important changes like course creation/deletion)
export const immediateCloudSync = async (userId: string, courses: Course[]): Promise<void> => {
  // Clear any pending debounced sync
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }
  pendingCourses = null;

  await saveAllCloudCourses(userId, courses);
};

// Check if cloud sync is available
export const isCloudSyncAvailable = (): boolean => {
  return isConfigured && !!db;
};
