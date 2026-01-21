/**
 * PDF Cloud Storage Service
 * Handles Firebase Storage for Pro user PDFs
 */

import { storage, isConfigured, ref, uploadBytes, getDownloadURL, getBlob, deleteObject } from './firebase';
import { hasCloudPdfAccess } from './subscriptionService';

// Storage limits
export const STORAGE_LIMITS = {
  FREE: {
    enabled: false,
    maxPdfSize: 0,
    totalStorage: 0
  },
  PRO: {
    enabled: true,
    maxPdfSize: 250 * 1024 * 1024, // 250MB per PDF (handles large textbooks)
    totalStorage: 2 * 1024 * 1024 * 1024 // 2GB total
  }
};

/**
 * Upload a PDF to Firebase Storage
 * Returns the storage path (not URL) for persistence
 */
export const uploadPdfToCloud = async (
  userId: string,
  courseId: string,
  file: File | Blob,
  fileName?: string
): Promise<string | null> => {
  // Check if storage is configured
  if (!isConfigured || !storage) {
    console.log('Firebase Storage not configured');
    return null;
  }

  // Check if user has cloud access
  try {
    const hasAccess = await hasCloudPdfAccess(userId);
    if (!hasAccess) {
      console.log('User does not have cloud PDF access (Free tier)');
      return null;
    }
  } catch (e) {
    console.error('Error checking cloud access:', e);
    return null;
  }

  // Check file size
  if (file.size > STORAGE_LIMITS.PRO.maxPdfSize) {
    console.error(`PDF too large: ${file.size} bytes (max: ${STORAGE_LIMITS.PRO.maxPdfSize})`);
    throw new Error('PDF file is too large. Maximum size is 250MB.');
  }

  // Generate storage path
  const name = fileName || (file instanceof File ? file.name : `${courseId}.pdf`);
  const safeName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `users/${userId}/pdfs/${courseId}/${safeName}`;

  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    console.log(`Uploaded PDF to cloud: ${path}`);
    return path;
  } catch (error) {
    console.error('Failed to upload PDF to cloud:', error);
    throw error;
  }
};

/**
 * Get a download URL for a cloud PDF
 * URLs expire, so this should be called when needed, not stored
 */
export const getCloudPdfUrl = async (path: string): Promise<string | null> => {
  if (!isConfigured || !storage) {
    console.log('Firebase Storage not configured');
    return null;
  }

  try {
    const storageRef = ref(storage, path);
    const url = await getDownloadURL(storageRef);
    return url;
  } catch (error: any) {
    if (error.code === 'storage/object-not-found') {
      console.log('Cloud PDF not found:', path);
      return null;
    }
    console.error('Failed to get cloud PDF URL:', error);
    return null;
  }
};

/**
 * Download a PDF from cloud storage as a Blob
 * Uses Firebase SDK's getBlob to avoid CORS issues
 */
export const downloadCloudPdf = async (path: string): Promise<Blob | null> => {
  if (!isConfigured || !storage) {
    console.log('Firebase Storage not configured');
    return null;
  }

  try {
    const storageRef = ref(storage, path);
    const blob = await getBlob(storageRef);
    console.log(`Downloaded cloud PDF: ${path} (${blob.size} bytes)`);
    return blob;
  } catch (error: any) {
    if (error.code === 'storage/object-not-found') {
      console.log('Cloud PDF not found:', path);
      return null;
    }
    console.error('Failed to download cloud PDF:', error);
    return null;
  }
};

/**
 * Delete a PDF from cloud storage
 */
export const deleteCloudPdf = async (path: string): Promise<void> => {
  if (!isConfigured || !storage) {
    console.log('Firebase Storage not configured');
    return;
  }

  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    console.log(`Deleted cloud PDF: ${path}`);
  } catch (error: any) {
    if (error.code === 'storage/object-not-found') {
      // Already deleted, no problem
      return;
    }
    console.error('Failed to delete cloud PDF:', error);
    throw error;
  }
};

/**
 * Check if a cloud PDF exists
 */
export const cloudPdfExists = async (path: string): Promise<boolean> => {
  const url = await getCloudPdfUrl(path);
  return url !== null;
};

/**
 * Upload a thumbnail image to Firebase Storage
 * Returns the storage path
 */
export const uploadThumbnailToCloud = async (
  userId: string,
  courseId: string,
  thumbnailBlob: Blob
): Promise<string | null> => {
  if (!isConfigured || !storage) {
    console.log('Firebase Storage not configured');
    return null;
  }

  // Check if user has cloud access
  try {
    const hasAccess = await hasCloudPdfAccess(userId);
    if (!hasAccess) {
      console.log('User does not have cloud access (Free tier)');
      return null;
    }
  } catch (e) {
    console.error('Error checking cloud access:', e);
    return null;
  }

  const path = `users/${userId}/thumbnails/${courseId}.jpg`;

  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, thumbnailBlob, { contentType: 'image/jpeg' });
    console.log(`Uploaded thumbnail to cloud: ${path}`);
    return path;
  } catch (error) {
    console.error('Failed to upload thumbnail to cloud:', error);
    return null;
  }
};

/**
 * Download a thumbnail from cloud storage
 */
export const downloadCloudThumbnail = async (path: string): Promise<Blob | null> => {
  if (!isConfigured || !storage) {
    return null;
  }

  try {
    const storageRef = ref(storage, path);
    const blob = await getBlob(storageRef);
    console.log(`Downloaded cloud thumbnail: ${path} (${blob.size} bytes)`);
    return blob;
  } catch (error: any) {
    if (error.code === 'storage/object-not-found') {
      return null;
    }
    console.error('Failed to download cloud thumbnail:', error);
    return null;
  }
};

/**
 * Get download URL for a cloud thumbnail
 */
export const getCloudThumbnailUrl = async (path: string): Promise<string | null> => {
  if (!isConfigured || !storage) {
    return null;
  }

  try {
    const storageRef = ref(storage, path);
    return await getDownloadURL(storageRef);
  } catch (error: any) {
    if (error.code === 'storage/object-not-found') {
      return null;
    }
    console.error('Failed to get cloud thumbnail URL:', error);
    return null;
  }
};

export const PDF_CLOUD_STORAGE_VERSION = '1.0.0';
