
import { db, isConfigured, doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc } from './firebase';
import { UserProfile, Friend, SharedCourse, Course } from '../types';

// Collection paths
const PROFILES_COLLECTION = 'userProfiles'; // Top-level for searchability
const FRIENDS_SUBCOLLECTION = 'friends';
const SHARED_SUBCOLLECTION = 'sharedWithMe';

// Helper to get user's friends path
const getUserFriendsPath = (userId: string) => `users/${userId}/${FRIENDS_SUBCOLLECTION}`;
const getUserSharedPath = (userId: string) => `users/${userId}/${SHARED_SUBCOLLECTION}`;

// ============ USER PROFILE ============

// Create or update user profile (called on login)
export const createOrUpdateProfile = async (user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }): Promise<void> => {
  if (!isConfigured || !db || !user.uid) return;

  try {
    const profileRef = doc(db, PROFILES_COLLECTION, user.uid);
    const existing = await getDoc(profileRef);

    const profileData: UserProfile = {
      userId: user.uid,
      displayName: user.displayName || 'Student',
      email: user.email || '',
      photoURL: user.photoURL || undefined,
      createdAt: existing.exists() ? existing.data().createdAt : new Date().toISOString()
    };

    await setDoc(profileRef, profileData, { merge: true });
    console.log('👤 Profile synced');
  } catch (error) {
    console.error('Profile sync failed:', error);
  }
};

// Search for user by email
export const searchUserByEmail = async (email: string): Promise<UserProfile | null> => {
  if (!isConfigured || !db) return null;

  try {
    const profilesRef = collection(db, PROFILES_COLLECTION);
    const q = query(profilesRef, where('email', '==', email.toLowerCase().trim()));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as UserProfile;
  } catch (error) {
    console.error('User search failed:', error);
    return null;
  }
};

// Get user profile by ID
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!isConfigured || !db) return null;

  try {
    const profileRef = doc(db, PROFILES_COLLECTION, userId);
    const snapshot = await getDoc(profileRef);
    if (!snapshot.exists()) return null;
    return snapshot.data() as UserProfile;
  } catch (error) {
    console.error('Get profile failed:', error);
    return null;
  }
};

// ============ FRIENDS ============

// Send friend request
export const sendFriendRequest = async (
  userId: string,
  userProfile: UserProfile,
  friendProfile: UserProfile
): Promise<boolean> => {
  if (!isConfigured || !db) return false;

  try {
    // Add to sender's friends (direction: sent)
    const senderFriendRef = doc(db, getUserFriendsPath(userId), friendProfile.userId);
    await setDoc(senderFriendRef, {
      odId: friendProfile.userId,
      status: 'pending',
      direction: 'sent',
      friendEmail: friendProfile.email,
      friendName: friendProfile.displayName,
      friendPhoto: friendProfile.photoURL || null,
      createdAt: new Date().toISOString()
    });

    // Add to receiver's friends (direction: received)
    const receiverFriendRef = doc(db, getUserFriendsPath(friendProfile.userId), userId);
    await setDoc(receiverFriendRef, {
      odId: userId,
      status: 'pending',
      direction: 'received',
      friendEmail: userProfile.email,
      friendName: userProfile.displayName,
      friendPhoto: userProfile.photoURL || null,
      createdAt: new Date().toISOString()
    });

    console.log('📨 Friend request sent');
    return true;
  } catch (error) {
    console.error('Send friend request failed:', error);
    return false;
  }
};

// Accept friend request
export const acceptFriendRequest = async (userId: string, friendId: string): Promise<boolean> => {
  if (!isConfigured || !db) return false;

  try {
    const acceptedAt = new Date().toISOString();

    // Update user's friend entry
    const userFriendRef = doc(db, getUserFriendsPath(userId), friendId);
    await setDoc(userFriendRef, { status: 'accepted', acceptedAt }, { merge: true });

    // Update friend's entry for this user
    const friendFriendRef = doc(db, getUserFriendsPath(friendId), userId);
    await setDoc(friendFriendRef, { status: 'accepted', acceptedAt }, { merge: true });

    console.log('✅ Friend request accepted');
    return true;
  } catch (error) {
    console.error('Accept friend request failed:', error);
    return false;
  }
};

// Decline/cancel friend request
export const declineFriendRequest = async (userId: string, friendId: string): Promise<boolean> => {
  if (!isConfigured || !db) return false;

  try {
    // Remove from both users
    await deleteDoc(doc(db, getUserFriendsPath(userId), friendId));
    await deleteDoc(doc(db, getUserFriendsPath(friendId), userId));

    console.log('❌ Friend request declined/cancelled');
    return true;
  } catch (error) {
    console.error('Decline friend request failed:', error);
    return false;
  }
};

// Remove friend
export const removeFriend = async (userId: string, friendId: string): Promise<boolean> => {
  if (!isConfigured || !db) return false;

  try {
    await deleteDoc(doc(db, getUserFriendsPath(userId), friendId));
    await deleteDoc(doc(db, getUserFriendsPath(friendId), userId));

    console.log('🗑️ Friend removed');
    return true;
  } catch (error) {
    console.error('Remove friend failed:', error);
    return false;
  }
};

// Get all friends (accepted)
export const getFriends = async (userId: string): Promise<Friend[]> => {
  if (!isConfigured || !db) return [];

  try {
    const friendsRef = collection(db, getUserFriendsPath(userId));
    const q = query(friendsRef, where('status', '==', 'accepted'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => doc.data() as Friend);
  } catch (error) {
    console.error('Get friends failed:', error);
    return [];
  }
};

// Get pending friend requests (received)
export const getPendingRequests = async (userId: string): Promise<Friend[]> => {
  if (!isConfigured || !db) return [];

  try {
    const friendsRef = collection(db, getUserFriendsPath(userId));
    const q = query(friendsRef, where('status', '==', 'pending'), where('direction', '==', 'received'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => doc.data() as Friend);
  } catch (error) {
    console.error('Get pending requests failed:', error);
    return [];
  }
};

// Get sent requests (pending, sent by user)
export const getSentRequests = async (userId: string): Promise<Friend[]> => {
  if (!isConfigured || !db) return [];

  try {
    const friendsRef = collection(db, getUserFriendsPath(userId));
    const q = query(friendsRef, where('status', '==', 'pending'), where('direction', '==', 'sent'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => doc.data() as Friend);
  } catch (error) {
    console.error('Get sent requests failed:', error);
    return [];
  }
};

// ============ SHARING ============

// Share course with friend
export const shareCourse = async (
  userId: string,
  userProfile: UserProfile,
  course: Course,
  friendId: string,
  permission: 'view' | 'copy' = 'view'
): Promise<boolean> => {
  if (!isConfigured || !db) return false;

  try {
    const shareId = `${course.id}_${userId}`;
    const sharedRef = doc(db, getUserSharedPath(friendId), shareId);

    const sharedData: SharedCourse = {
      shareId,
      courseId: course.id,
      courseTitle: course.title,
      courseSubtitle: course.subtitle,
      ownerUserId: userId,
      ownerName: userProfile.displayName,
      ownerEmail: userProfile.email,
      permission,
      sharedAt: new Date().toISOString()
    };

    await setDoc(sharedRef, sharedData);
    console.log('📤 Course shared');
    return true;
  } catch (error) {
    console.error('Share course failed:', error);
    return false;
  }
};

// Get courses shared with user
export const getSharedWithMe = async (userId: string): Promise<SharedCourse[]> => {
  if (!isConfigured || !db) return [];

  try {
    const sharedRef = collection(db, getUserSharedPath(userId));
    const snapshot = await getDocs(sharedRef);

    return snapshot.docs.map(doc => doc.data() as SharedCourse);
  } catch (error) {
    console.error('Get shared courses failed:', error);
    return [];
  }
};

// Get full course data from share (for viewing)
export const getSharedCourseData = async (share: SharedCourse): Promise<Course | null> => {
  if (!isConfigured || !db) return null;

  try {
    const courseRef = doc(db, `users/${share.ownerUserId}/courses`, share.courseId);
    const snapshot = await getDoc(courseRef);

    if (!snapshot.exists()) return null;
    return snapshot.data() as Course;
  } catch (error) {
    console.error('Get shared course data failed:', error);
    return null;
  }
};

// Remove shared course
export const removeSharedCourse = async (userId: string, shareId: string): Promise<boolean> => {
  if (!isConfigured || !db) return false;

  try {
    await deleteDoc(doc(db, getUserSharedPath(userId), shareId));
    console.log('🗑️ Shared course removed');
    return true;
  } catch (error) {
    console.error('Remove shared course failed:', error);
    return false;
  }
};

// Check if Firebase is configured
export const isFriendsAvailable = (): boolean => {
  return isConfigured && !!db;
};
