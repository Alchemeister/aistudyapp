
import { db, isConfigured, doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc, updateDoc, arrayUnion, arrayRemove, increment } from './firebase';
import { StudyGroup, GroupMember, LeaderboardEntry, UserProfile, SharedContent, StudyMaterial, Flashcard, Question } from '../types';

// Collection paths
const GROUPS_COLLECTION = 'studyGroups';
const MEMBERS_SUBCOLLECTION = 'members';
const SHARED_CONTENT_SUBCOLLECTION = 'sharedContent';
const USER_GROUPS_SUBCOLLECTION = 'myGroups'; // User's group references

// Helper to generate 6-char invite code
const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (0, O, 1, I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Helper paths
const getGroupMembersPath = (groupId: string) => `${GROUPS_COLLECTION}/${groupId}/${MEMBERS_SUBCOLLECTION}`;
const getGroupSharedContentPath = (groupId: string) => `${GROUPS_COLLECTION}/${groupId}/${SHARED_CONTENT_SUBCOLLECTION}`;
const getUserGroupsPath = (userId: string) => `users/${userId}/${USER_GROUPS_SUBCOLLECTION}`;

// ============ GROUP MANAGEMENT ============

// Create a new study group
export const createGroup = async (
  userId: string,
  userProfile: UserProfile,
  groupData: { name: string; description?: string; school?: string; course?: string; professor?: string }
): Promise<StudyGroup | null> => {
  if (!isConfigured || !db) return null;

  try {
    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const inviteCode = generateInviteCode();
    const now = new Date().toISOString();

    const group: StudyGroup = {
      id: groupId,
      name: groupData.name,
      description: groupData.description,
      school: groupData.school,
      course: groupData.course,
      professor: groupData.professor,
      inviteCode,
      createdBy: userId,
      createdAt: now,
      memberCount: 1
    };

    // Create the group document
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);
    await setDoc(groupRef, group);

    // Add creator as admin member
    const memberRef = doc(db, getGroupMembersPath(groupId), userId);
    const memberData: GroupMember = {
      odId: userId,
      odName: userProfile.displayName,
      odEmail: userProfile.email,
      odPhoto: userProfile.photoURL,
      joinedAt: now,
      role: 'admin',
      totalScore: 0,
      quizzesTaken: 0,
      correctAnswers: 0,
      totalQuestions: 0,
      currentStreak: 0
    };
    await setDoc(memberRef, memberData);

    // Add reference in user's groups
    const userGroupRef = doc(db, getUserGroupsPath(userId), groupId);
    await setDoc(userGroupRef, {
      groupId,
      groupName: group.name,
      inviteCode,
      joinedAt: now,
      role: 'admin'
    });

    console.log('🎉 Study group created:', group.name);
    return group;
  } catch (error) {
    console.error('Create group failed:', error);
    return null;
  }
};

// Join a group via invite code
export const joinGroup = async (
  userId: string,
  userProfile: UserProfile,
  inviteCode: string
): Promise<StudyGroup | null> => {
  if (!isConfigured || !db) return null;

  try {
    // Find group by invite code
    const groupsRef = collection(db, GROUPS_COLLECTION);
    const q = query(groupsRef, where('inviteCode', '==', inviteCode.toUpperCase().trim()));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.warn('Invalid invite code');
      return null;
    }

    const groupDoc = snapshot.docs[0];
    const group = groupDoc.data() as StudyGroup;

    // Check if already a member
    const memberRef = doc(db, getGroupMembersPath(group.id), userId);
    const existingMember = await getDoc(memberRef);
    if (existingMember.exists()) {
      console.warn('Already a member of this group');
      return group;
    }

    const now = new Date().toISOString();

    // Add as member
    const memberData: GroupMember = {
      odId: userId,
      odName: userProfile.displayName,
      odEmail: userProfile.email,
      odPhoto: userProfile.photoURL,
      joinedAt: now,
      role: 'member',
      totalScore: 0,
      quizzesTaken: 0,
      correctAnswers: 0,
      totalQuestions: 0,
      currentStreak: 0
    };
    await setDoc(memberRef, memberData);

    // Update member count
    const groupRef = doc(db, GROUPS_COLLECTION, group.id);
    await setDoc(groupRef, { memberCount: group.memberCount + 1 }, { merge: true });

    // Add reference in user's groups
    const userGroupRef = doc(db, getUserGroupsPath(userId), group.id);
    await setDoc(userGroupRef, {
      groupId: group.id,
      groupName: group.name,
      inviteCode: group.inviteCode,
      joinedAt: now,
      role: 'member'
    });

    console.log('✅ Joined group:', group.name);
    return { ...group, memberCount: group.memberCount + 1 };
  } catch (error) {
    console.error('Join group failed:', error);
    return null;
  }
};

// Leave a group
export const leaveGroup = async (userId: string, groupId: string): Promise<boolean> => {
  if (!isConfigured || !db) return false;

  try {
    // Get group to check member count and admin status
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);
    const groupSnap = await getDoc(groupRef);
    if (!groupSnap.exists()) return false;

    const group = groupSnap.data() as StudyGroup;

    // Remove member
    await deleteDoc(doc(db, getGroupMembersPath(groupId), userId));

    // Remove from user's groups
    await deleteDoc(doc(db, getUserGroupsPath(userId), groupId));

    // Update member count or delete group if empty
    if (group.memberCount <= 1) {
      // Delete the group
      await deleteDoc(groupRef);
      console.log('🗑️ Group deleted (no members remaining)');
    } else {
      await setDoc(groupRef, { memberCount: group.memberCount - 1 }, { merge: true });
    }

    console.log('👋 Left group:', group.name);
    return true;
  } catch (error) {
    console.error('Leave group failed:', error);
    return false;
  }
};

// Get all groups user is a member of
export const getMyGroups = async (userId: string): Promise<StudyGroup[]> => {
  if (!isConfigured || !db) return [];

  try {
    const userGroupsRef = collection(db, getUserGroupsPath(userId));
    const snapshot = await getDocs(userGroupsRef);

    const groupIds = snapshot.docs.map(doc => doc.data().groupId);

    // Fetch full group data
    const groups: StudyGroup[] = [];
    for (const groupId of groupIds) {
      const groupRef = doc(db, GROUPS_COLLECTION, groupId);
      const groupSnap = await getDoc(groupRef);
      if (groupSnap.exists()) {
        groups.push(groupSnap.data() as StudyGroup);
      }
    }

    return groups;
  } catch (error) {
    console.error('Get my groups failed:', error);
    return [];
  }
};

// Get group details
export const getGroup = async (groupId: string): Promise<StudyGroup | null> => {
  if (!isConfigured || !db) return null;

  try {
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);
    const snapshot = await getDoc(groupRef);
    if (!snapshot.exists()) return null;
    return snapshot.data() as StudyGroup;
  } catch (error) {
    console.error('Get group failed:', error);
    return null;
  }
};

// ============ LEADERBOARD ============

// Get leaderboard for a group
export const getGroupLeaderboard = async (groupId: string): Promise<LeaderboardEntry[]> => {
  if (!isConfigured || !db) return [];

  try {
    const membersRef = collection(db, getGroupMembersPath(groupId));
    const snapshot = await getDocs(membersRef);

    const members = snapshot.docs.map(doc => doc.data() as GroupMember);

    // Sort by total score (descending), then by accuracy
    const sorted = members.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      const aAcc = a.totalQuestions > 0 ? a.correctAnswers / a.totalQuestions : 0;
      const bAcc = b.totalQuestions > 0 ? b.correctAnswers / b.totalQuestions : 0;
      return bAcc - aAcc;
    });

    // Convert to LeaderboardEntry with ranks
    return sorted.map((member, index) => ({
      odId: member.odId,
      odName: member.odName,
      odPhoto: member.odPhoto,
      totalScore: member.totalScore,
      quizzesTaken: member.quizzesTaken,
      accuracy: member.totalQuestions > 0
        ? Math.round((member.correctAnswers / member.totalQuestions) * 100)
        : 0,
      rank: index + 1
    }));
  } catch (error) {
    console.error('Get leaderboard failed:', error);
    return [];
  }
};

// Submit quiz score to all user's groups
export const submitQuizScore = async (
  userId: string,
  score: number,        // Percentage (0-100)
  correct: number,      // Number of correct answers
  total: number         // Total questions
): Promise<void> => {
  if (!isConfigured || !db) return;

  try {
    // Get all user's groups
    const userGroupsRef = collection(db, getUserGroupsPath(userId));
    const snapshot = await getDocs(userGroupsRef);

    const now = new Date().toISOString();

    // Update stats in each group
    for (const groupDoc of snapshot.docs) {
      const groupId = groupDoc.data().groupId;
      const memberRef = doc(db, getGroupMembersPath(groupId), userId);
      const memberSnap = await getDoc(memberRef);

      if (memberSnap.exists()) {
        const member = memberSnap.data() as GroupMember;

        // Calculate streak
        let streak = member.currentStreak || 0;
        if (member.lastActiveAt) {
          const lastActive = new Date(member.lastActiveAt);
          const today = new Date();
          const daysDiff = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

          if (daysDiff === 0) {
            // Same day, keep streak
          } else if (daysDiff === 1) {
            // Next day, increment streak
            streak += 1;
          } else {
            // Gap, reset streak
            streak = 1;
          }
        } else {
          streak = 1;
        }

        await setDoc(memberRef, {
          totalScore: member.totalScore + score,
          quizzesTaken: member.quizzesTaken + 1,
          correctAnswers: member.correctAnswers + correct,
          totalQuestions: member.totalQuestions + total,
          currentStreak: streak,
          lastActiveAt: now
        }, { merge: true });
      }
    }

    console.log('📊 Quiz score submitted to groups');
  } catch (error) {
    console.error('Submit quiz score failed:', error);
  }
};

// Check if study groups feature is available
export const isStudyGroupsAvailable = (): boolean => {
  return isConfigured && !!db;
};

// ============ SHARED CONTENT ============

// Helper to count items in content
const getItemCount = (material: StudyMaterial): number => {
  if (Array.isArray(material.content)) {
    return material.content.length;
  }
  return 1; // Notes, mindmaps, etc.
};

// Share a study material to a group
export const shareContentToGroup = async (
  groupId: string,
  userId: string,
  userProfile: UserProfile,
  material: StudyMaterial,
  courseName: string,
  chapterNames?: string[]
): Promise<SharedContent | null> => {
  if (!isConfigured || !db) return null;

  try {
    const contentId = `shared_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const sharedContent: SharedContent = {
      id: contentId,
      groupId,
      sharedBy: userId,
      sharedByName: userProfile.displayName,
      sharedByPhoto: userProfile.photoURL,
      sharedAt: now,
      type: material.type,
      title: material.title,
      content: material.content,
      difficulty: material.difficulty,
      itemCount: getItemCount(material),
      courseName,
      chapterNames,
      cloneCount: 0,
      likes: []
    };

    const contentRef = doc(db, getGroupSharedContentPath(groupId), contentId);
    await setDoc(contentRef, sharedContent);

    console.log('📤 Shared content to group:', material.title);
    return sharedContent;
  } catch (error) {
    console.error('Share content failed:', error);
    return null;
  }
};

// Get all shared content for a group
export const getGroupSharedContent = async (groupId: string): Promise<SharedContent[]> => {
  if (!isConfigured || !db) return [];

  try {
    const contentRef = collection(db, getGroupSharedContentPath(groupId));
    const snapshot = await getDocs(contentRef);

    const content = snapshot.docs.map(doc => doc.data() as SharedContent);

    // Sort by newest first
    return content.sort((a, b) =>
      new Date(b.sharedAt).getTime() - new Date(a.sharedAt).getTime()
    );
  } catch (error) {
    console.error('Get shared content failed:', error);
    return [];
  }
};

// Toggle like on shared content
export const toggleLikeContent = async (
  groupId: string,
  contentId: string,
  userId: string
): Promise<boolean> => {
  if (!isConfigured || !db) return false;

  try {
    const contentRef = doc(db, getGroupSharedContentPath(groupId), contentId);
    const contentSnap = await getDoc(contentRef);

    if (!contentSnap.exists()) return false;

    const content = contentSnap.data() as SharedContent;
    const isLiked = content.likes.includes(userId);

    if (isLiked) {
      await updateDoc(contentRef, {
        likes: arrayRemove(userId)
      });
    } else {
      await updateDoc(contentRef, {
        likes: arrayUnion(userId)
      });
    }

    return !isLiked; // Return new liked state
  } catch (error) {
    console.error('Toggle like failed:', error);
    return false;
  }
};

// Increment clone count when content is cloned
export const incrementCloneCount = async (groupId: string, contentId: string): Promise<void> => {
  if (!isConfigured || !db) return;

  try {
    const contentRef = doc(db, getGroupSharedContentPath(groupId), contentId);
    await updateDoc(contentRef, {
      cloneCount: increment(1)
    });
  } catch (error) {
    console.error('Increment clone count failed:', error);
  }
};

// Delete shared content (only by the person who shared it)
export const deleteSharedContent = async (
  groupId: string,
  contentId: string,
  userId: string
): Promise<boolean> => {
  if (!isConfigured || !db) return false;

  try {
    const contentRef = doc(db, getGroupSharedContentPath(groupId), contentId);
    const contentSnap = await getDoc(contentRef);

    if (!contentSnap.exists()) return false;

    const content = contentSnap.data() as SharedContent;

    // Only allow delete if user is the one who shared it
    if (content.sharedBy !== userId) {
      console.warn('Cannot delete: not the owner');
      return false;
    }

    await deleteDoc(contentRef);
    console.log('🗑️ Deleted shared content:', content.title);
    return true;
  } catch (error) {
    console.error('Delete shared content failed:', error);
    return false;
  }
};
