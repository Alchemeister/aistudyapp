import React, { useState, useEffect, useContext } from 'react';
import { ToastContext } from '../App';
import { Friend, UserProfile } from '../types';
import {
  searchUserByEmail,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  getFriends,
  getPendingRequests,
  getSentRequests,
  getUserProfile,
  isFriendsAvailable
} from '../services/friendsService';

interface Props {
  user: any; // Firebase user
}

export const FriendsPanel: React.FC<Props> = ({ user }) => {
  const { showToast } = useContext(ToastContext);
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<UserProfile | null>(null);
  const [searchError, setSearchError] = useState('');

  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [sentRequests, setSentRequests] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Load user profile and friends on mount
  useEffect(() => {
    if (!user?.uid) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [profile, friendsList, pending, sent] = await Promise.all([
          getUserProfile(user.uid),
          getFriends(user.uid),
          getPendingRequests(user.uid),
          getSentRequests(user.uid)
        ]);
        setUserProfile(profile);
        setFriends(friendsList);
        setPendingRequests(pending);
        setSentRequests(sent);
      } catch (error) {
        console.error('Failed to load friends data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.uid]);

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearchResult(null);

    try {
      const result = await searchUserByEmail(searchEmail.trim());
      if (result) {
        // Check if already a friend or pending
        if (result.userId === user.uid) {
          setSearchError("That's you!");
        } else if (friends.some(f => f.odId === result.userId)) {
          setSearchError('Already friends!');
        } else if (sentRequests.some(r => r.odId === result.userId)) {
          setSearchError('Request already sent!');
        } else if (pendingRequests.some(r => r.odId === result.userId)) {
          setSearchError('They already sent you a request!');
        } else {
          setSearchResult(result);
        }
      } else {
        setSearchError('No user found with that email');
      }
    } catch (error) {
      setSearchError('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchResult || !userProfile) return;

    const success = await sendFriendRequest(user.uid, userProfile, searchResult);
    if (success) {
      showToast('Friend request sent!', 'success');
      setSentRequests([...sentRequests, {
        odId: searchResult.userId,
        status: 'pending',
        direction: 'sent',
        friendEmail: searchResult.email,
        friendName: searchResult.displayName,
        friendPhoto: searchResult.photoURL,
        createdAt: new Date().toISOString()
      }]);
      setSearchResult(null);
      setSearchEmail('');
    } else {
      showToast('Failed to send request', 'error');
    }
  };

  const handleAccept = async (friendId: string) => {
    const success = await acceptFriendRequest(user.uid, friendId);
    if (success) {
      const accepted = pendingRequests.find(r => r.odId === friendId);
      if (accepted) {
        setPendingRequests(pendingRequests.filter(r => r.odId !== friendId));
        setFriends([...friends, { ...accepted, status: 'accepted', acceptedAt: new Date().toISOString() }]);
      }
      showToast('Friend request accepted!', 'success');
    } else {
      showToast('Failed to accept', 'error');
    }
  };

  const handleDecline = async (friendId: string, isSent: boolean) => {
    const success = await declineFriendRequest(user.uid, friendId);
    if (success) {
      if (isSent) {
        setSentRequests(sentRequests.filter(r => r.odId !== friendId));
        showToast('Request cancelled', 'info');
      } else {
        setPendingRequests(pendingRequests.filter(r => r.odId !== friendId));
        showToast('Request declined', 'info');
      }
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!confirm('Remove this friend?')) return;
    const success = await removeFriend(user.uid, friendId);
    if (success) {
      setFriends(friends.filter(f => f.odId !== friendId));
      showToast('Friend removed', 'info');
    }
  };

  if (!isFriendsAvailable()) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
          <i className="fas fa-cloud-slash text-amber-500 text-3xl mb-3"></i>
          <h3 className="text-lg font-bold text-amber-800 dark:text-amber-200 mb-2">Cloud Sync Required</h3>
          <p className="text-amber-600 dark:text-amber-300 text-sm">
            Friends feature requires Firebase to be configured. Please set up Firebase in your environment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
        <i className="fas fa-user-friends text-primary"></i>
        Friends
      </h1>

      {/* Add Friend Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Add Friend</h2>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="Enter friend's email..."
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-primary outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !searchEmail.trim()}
            className="px-5 py-2 bg-primary text-white rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {searching ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-search"></i>}
            Search
          </button>
        </div>

        {searchError && (
          <p className="mt-3 text-sm text-red-500 dark:text-red-400 flex items-center gap-2">
            <i className="fas fa-exclamation-circle"></i>
            {searchError}
          </p>
        )}

        {searchResult && (
          <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden">
                {searchResult.photoURL ? (
                  <img src={searchResult.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <i className="fas fa-user text-slate-400"></i>
                )}
              </div>
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-200">{searchResult.displayName}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{searchResult.email}</div>
              </div>
            </div>
            <button
              onClick={handleSendRequest}
              className="px-4 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition-colors flex items-center gap-2"
            >
              <i className="fas fa-user-plus"></i>
              Add Friend
            </button>
          </div>
        )}
      </div>

      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <i className="fas fa-inbox text-amber-500"></i>
            Friend Requests ({pendingRequests.length})
          </h2>
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <div key={req.odId} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden">
                    {req.friendPhoto ? (
                      <img src={req.friendPhoto} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <i className="fas fa-user text-slate-400"></i>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">{req.friendName}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{req.friendEmail}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(req.odId)}
                    className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-bold hover:bg-green-600 transition-colors"
                  >
                    <i className="fas fa-check mr-1"></i>Accept
                  </button>
                  <button
                    onClick={() => handleDecline(req.odId, false)}
                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                  >
                    <i className="fas fa-times mr-1"></i>Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sent Requests Section */}
      {sentRequests.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <i className="fas fa-paper-plane text-blue-500"></i>
            Pending Sent ({sentRequests.length})
          </h2>
          <div className="space-y-3">
            {sentRequests.map((req) => (
              <div key={req.odId} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden">
                    {req.friendPhoto ? (
                      <img src={req.friendPhoto} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <i className="fas fa-user text-slate-400"></i>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">{req.friendName}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{req.friendEmail}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleDecline(req.odId, true)}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                >
                  <i className="fas fa-times mr-1"></i>Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <i className="fas fa-users text-green-500"></i>
          My Friends ({friends.length})
        </h2>

        {loading ? (
          <div className="text-center py-8 text-slate-400">
            <i className="fas fa-circle-notch fa-spin text-2xl mb-2"></i>
            <p>Loading friends...</p>
          </div>
        ) : friends.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <i className="fas fa-user-friends text-3xl mb-3 opacity-50"></i>
            <p className="font-medium">No friends yet</p>
            <p className="text-sm">Search by email to add friends!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map((friend) => (
              <div key={friend.odId} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden">
                    {friend.friendPhoto ? (
                      <img src={friend.friendPhoto} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <i className="fas fa-user text-slate-400"></i>
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">{friend.friendName}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">{friend.friendEmail}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveFriend(friend.odId)}
                  className="px-3 py-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove friend"
                >
                  <i className="fas fa-user-minus"></i>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
