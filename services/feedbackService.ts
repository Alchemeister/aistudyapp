
import { db, isConfigured, collection } from './firebase';
import { addDoc, serverTimestamp } from 'firebase/firestore';

// Feedback types
export type FeedbackType = 'bug' | 'suggestion' | 'question' | 'other';

export interface FeedbackSubmission {
  type: FeedbackType;
  message: string;
  email?: string; // Optional contact email
  page?: string; // Current page/route when submitted
}

interface FeedbackDocument extends FeedbackSubmission {
  userId: string;
  userEmail: string | null;
  createdAt: any; // Firestore timestamp
  appVersion: string;
  userAgent: string;
}

const FEEDBACK_COLLECTION = 'feedback';
const APP_VERSION = '2.2.0';

/**
 * Submit feedback to Firestore
 * Stored in root `feedback` collection for easy admin access
 */
export const submitFeedback = async (
  userId: string,
  userEmail: string | null,
  feedback: FeedbackSubmission
): Promise<{ success: boolean; error?: string }> => {
  if (!isConfigured || !db) {
    return { success: false, error: 'Firebase not configured' };
  }

  if (!feedback.message.trim()) {
    return { success: false, error: 'Message cannot be empty' };
  }

  try {
    const feedbackDoc: FeedbackDocument = {
      userId,
      userEmail,
      type: feedback.type,
      message: feedback.message.trim(),
      email: feedback.email?.trim() || undefined,
      page: feedback.page || window.location.hash,
      createdAt: serverTimestamp(),
      appVersion: APP_VERSION,
      userAgent: navigator.userAgent,
    };

    await addDoc(collection(db, FEEDBACK_COLLECTION), feedbackDoc);
    console.log('✉️ Feedback submitted successfully');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to submit feedback:', error);
    return { success: false, error: error.message || 'Failed to submit feedback' };
  }
};
