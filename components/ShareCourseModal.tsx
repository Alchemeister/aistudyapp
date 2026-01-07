import React, { useState, useEffect, useContext } from 'react';
import { ToastContext } from '../App';
import { Friend, Course, UserProfile } from '../types';
import { getFriends, shareCourse, getUserProfile, isFriendsAvailable } from '../services/friendsService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  user: any; // Firebase user
}

export const ShareCourseModal: React.FC<Props> = ({ isOpen, onClose, course, user }) => {
  const { showToast } = useContext(ToastContext);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!isOpen || !user?.uid) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [friendsList, profile] = await Promise.all([
          getFriends(user.uid),
          getUserProfile(user.uid)
        ]);
        setFriends(friendsList);
        setUserProfile(profile);
      } catch (error) {
        console.error('Failed to load friends:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, user?.uid]);

  const toggleFriend = (friendId: string) => {
    setSelectedFriends(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleShare = async () => {
    if (selectedFriends.length === 0 || !userProfile) return;

    setSharing(true);
    try {
      let successCount = 0;
      for (const friendId of selectedFriends) {
        const success = await shareCourse(user.uid, userProfile, course, friendId, 'view');
        if (success) successCount++;
      }

      if (successCount > 0) {
        showToast(`Shared with ${successCount} friend${successCount > 1 ? 's' : ''}!`, 'success');
        onClose();
        setSelectedFriends([]);
      } else {
        showToast('Failed to share course', 'error');
      }
    } catch (error) {
      showToast('Failed to share course', 'error');
    } finally {
      setSharing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md animate-fade-in-up overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-700">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <i className="fas fa-share-alt text-primary"></i>
            Share Course
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Course Info */}
          <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-book text-primary"></i>
              </div>
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-200">{course.title}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{course.code}</div>
              </div>
            </div>
          </div>

          {!isFriendsAvailable() ? (
            <div className="text-center py-6 text-slate-400">
              <i className="fas fa-cloud-slash text-3xl mb-2"></i>
              <p>Cloud sync required for sharing</p>
            </div>
          ) : loading ? (
            <div className="text-center py-8 text-slate-400">
              <i className="fas fa-circle-notch fa-spin text-2xl mb-2"></i>
              <p>Loading friends...</p>
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-6 text-slate-400">
              <i className="fas fa-user-friends text-3xl mb-3 opacity-50"></i>
              <p className="font-medium">No friends yet</p>
              <p className="text-sm">Add friends first to share courses!</p>
            </div>
          ) : (
            <>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Select Friends to Share With
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {friends.map((friend) => (
                  <label
                    key={friend.odId}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      selectedFriends.includes(friend.odId)
                        ? 'bg-primary/10 border-2 border-primary'
                        : 'bg-slate-50 dark:bg-slate-700 border-2 border-transparent hover:bg-slate-100 dark:hover:bg-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFriends.includes(friend.odId)}
                      onChange={() => toggleFriend(friend.odId)}
                      className="rounded text-primary focus:ring-primary"
                    />
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden">
                      {friend.friendPhoto ? (
                        <img src={friend.friendPhoto} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <i className="fas fa-user text-slate-400 text-sm"></i>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-800 dark:text-slate-200 truncate">{friend.friendName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{friend.friendEmail}</div>
                    </div>
                    {selectedFriends.includes(friend.odId) && (
                      <i className="fas fa-check-circle text-primary"></i>
                    )}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700 border-t border-slate-100 dark:border-slate-600 flex justify-between items-center">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {selectedFriends.length > 0 ? `${selectedFriends.length} selected` : 'Select friends to share'}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-500 font-medium hover:text-slate-700 dark:hover:text-slate-300"
            >
              Cancel
            </button>
            <button
              onClick={handleShare}
              disabled={selectedFriends.length === 0 || sharing || friends.length === 0}
              className="px-5 py-2 bg-primary text-white rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {sharing ? (
                <>
                  <i className="fas fa-circle-notch fa-spin"></i>
                  Sharing...
                </>
              ) : (
                <>
                  <i className="fas fa-share"></i>
                  Share
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
