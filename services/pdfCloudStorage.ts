/**
 * PDF CLOUD STORAGE SERVICE - PLACEHOLDER
 *
 * This file will handle cloud storage for PDFs.
 * Currently PDFs are stored locally in IndexedDB only.
 *
 * RECOMMENDED: Cloudflare R2 (cheaper than Firebase Storage)
 *
 * SETUP REQUIRED:
 * 1. Create Cloudflare account
 * 2. Enable R2 in dashboard
 * 3. Create bucket for PDFs
 * 4. Set up worker for signed URLs (or use Firebase Storage)
 *
 * ALTERNATIVE: Firebase Storage
 * 1. Enable Storage in Firebase Console
 * 2. Set up security rules
 * 3. Install: Already included with firebase package
 *
 * COMPRESSION:
 * Before uploading, compress PDFs to save storage:
 * - Use pdf-lib to remove metadata
 * - Target: < 10MB per PDF
 * - Reject files > 50MB
 */

import { hasCloudPdfAccess } from './subscriptionService';

// Storage limits
export const STORAGE_LIMITS = {
  FREE: {
    enabled: false,
    maxPdfSize: 0, // No cloud storage
    totalStorage: 0
  },
  PRO: {
    enabled: true,
    maxPdfSize: 50 * 1024 * 1024, // 50MB per PDF
    totalStorage: 1 * 1024 * 1024 * 1024 // 1GB total
  },
  STUDENT: {
    enabled: true,
    maxPdfSize: 50 * 1024 * 1024,
    totalStorage: 1 * 1024 * 1024 * 1024
  }
};

/**
 * TODO: Upload PDF to cloud storage
 *
 * Flow:
 * 1. Check user has Pro subscription
 * 2. Compress PDF if needed
 * 3. Generate unique storage path: users/{userId}/pdfs/{courseId}/{filename}
 * 4. Upload to R2/Firebase Storage
 * 5. Store download URL in Firestore course document
 *
 * Example with Firebase Storage:
 *
 * import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
 *
 * export const uploadPdfToCloud = async (
 *   userId: string,
 *   courseId: string,
 *   file: File
 * ): Promise<string | null> => {
 *   if (!await hasCloudPdfAccess(userId)) {
 *     console.log('User does not have cloud PDF access');
 *     return null;
 *   }
 *
 *   const storage = getStorage();
 *   const path = `users/${userId}/pdfs/${courseId}/${file.name}`;
 *   const storageRef = ref(storage, path);
 *
 *   await uploadBytes(storageRef, file);
 *   const url = await getDownloadURL(storageRef);
 *
 *   return url;
 * };
 */

/**
 * TODO: Download PDF from cloud storage
 *
 * Example:
 * export const downloadPdfFromCloud = async (url: string): Promise<Blob> => {
 *   const response = await fetch(url);
 *   return response.blob();
 * };
 */

/**
 * TODO: Delete PDF from cloud storage
 *
 * Example:
 * export const deletePdfFromCloud = async (path: string): Promise<void> => {
 *   const storage = getStorage();
 *   const storageRef = ref(storage, path);
 *   await deleteObject(storageRef);
 * };
 */

/**
 * TODO: Sync local PDFs to cloud on subscription upgrade
 *
 * When user upgrades to Pro:
 * 1. Find all courses with local PDFs (pdfBlobId set)
 * 2. Read blob from IndexedDB
 * 3. Upload to cloud
 * 4. Update course with cloudPdfUrl
 */

/**
 * TODO: Download cloud PDFs on new device
 *
 * When user logs in on new device:
 * 1. Load courses from Firestore
 * 2. Check for cloudPdfUrl on each course
 * 3. Download and store in local IndexedDB
 * 4. Update pdfUrl for viewing
 */

// Placeholder exports
export const uploadPdfToCloud = async (userId: string, courseId: string, file: File): Promise<string | null> => {
  console.log('PDF cloud storage not implemented yet');
  console.log(`Would upload: ${file.name} (${file.size} bytes) for course ${courseId}`);
  return null;
};

export const PDF_CLOUD_STORAGE_VERSION = '0.1.0-placeholder';
