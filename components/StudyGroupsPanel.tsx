import React, { useState, useEffect, useContext, type FC } from 'react';
import {
  Users, Plus, Copy, Check, Trophy, Crown, Medal, Award, ChevronRight,
  LogOut, Loader2, User, School, BookOpen, GraduationCap, Hash,
  Share2, Heart, Download, Trash2, FileText, Brain, HelpCircle, Lightbulb
} from 'lucide-react';
import { StudyGroup, LeaderboardEntry, UserProfile, SharedContent, ContentType } from '../types';
import {
  createGroup, joinGroup, leaveGroup, getMyGroups, getGroupLeaderboard, isStudyGroupsAvailable,
  getGroupSharedContent, toggleLikeContent, deleteSharedContent
} from '../services/studyGroupsService';
import { getUserProfile } from '../services/friendsService';
import { Modal } from './Modal';
import { ToastContext } from '../App';

interface Props {
  userId: string;
}

export const StudyGroupsPanel: FC<Props> = ({ userId }) => {
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const { showToast } = useContext(ToastContext);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    school: '',
    course: '',
    professor: ''
  });
  const [joinCode, setJoinCode] = useState('');
  const [processing, setProcessing] = useState(false);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Tabs & Shared Content
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'shared'>('leaderboard');
  const [sharedContent, setSharedContent] = useState<SharedContent[]>([]);
  const [sharedContentLoading, setSharedContentLoading] = useState(false);

  // Load user's groups
  useEffect(() => {
    const loadData = async () => {
      if (!isStudyGroupsAvailable()) {
        setLoading(false);
        return;
      }

      try {
        const [profile, userGroups] = await Promise.all([
          getUserProfile(userId),
          getMyGroups(userId)
        ]);
        setUserProfile(profile);
        setGroups(userGroups);
      } catch (error) {
        console.error('Load groups error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId]);

  // Load leaderboard or shared content when group selected or tab changes
  useEffect(() => {
    if (selectedGroup) {
      if (activeTab === 'leaderboard') {
        setLeaderboardLoading(true);
        getGroupLeaderboard(selectedGroup.id)
          .then(setLeaderboard)
          .finally(() => setLeaderboardLoading(false));
      } else {
        setSharedContentLoading(true);
        getGroupSharedContent(selectedGroup.id)
          .then(setSharedContent)
          .finally(() => setSharedContentLoading(false));
      }
    }
  }, [selectedGroup, activeTab]);

  // Reset tab when leaving group view
  useEffect(() => {
    if (!selectedGroup) {
      setActiveTab('leaderboard');
    }
  }, [selectedGroup]);

  const handleCreateGroup = async () => {
    if (!userProfile || !createForm.name.trim()) {
      showToast('Please enter a group name', 'error');
      return;
    }

    setProcessing(true);
    try {
      const newGroup = await createGroup(userId, userProfile, {
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        school: createForm.school.trim() || undefined,
        course: createForm.course.trim() || undefined,
        professor: createForm.professor.trim() || undefined
      });

      if (newGroup) {
        setGroups(prev => [newGroup, ...prev]);
        setShowCreateModal(false);
        setCreateForm({ name: '', description: '', school: '', course: '', professor: '' });
        showToast('Study group created!');
      } else {
        showToast('Failed to create group', 'error');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!userProfile || !joinCode.trim()) {
      showToast('Please enter an invite code', 'error');
      return;
    }

    setProcessing(true);
    try {
      const group = await joinGroup(userId, userProfile, joinCode.trim());

      if (group) {
        // Check if already in list
        if (!groups.find(g => g.id === group.id)) {
          setGroups(prev => [group, ...prev]);
        }
        setShowJoinModal(false);
        setJoinCode('');
        showToast(`Joined "${group.name}"!`);
      } else {
        showToast('Invalid invite code', 'error');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroup) return;

    setProcessing(true);
    try {
      const success = await leaveGroup(userId, selectedGroup.id);
      if (success) {
        setGroups(prev => prev.filter(g => g.id !== selectedGroup.id));
        setSelectedGroup(null);
        setShowLeaveModal(false);
        showToast('Left group');
      } else {
        showToast('Failed to leave group', 'error');
      }
    } finally {
      setProcessing(false);
    }
  };

  const copyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    showToast('Invite code copied!');
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-amber-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-slate-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-700" />;
    return <span className="w-5 h-5 text-center text-slate-500 font-bold text-sm">{rank}</span>;
  };

  const getContentTypeIcon = (type: ContentType) => {
    switch (type) {
      case ContentType.FLASHCARDS: return <Brain className="w-4 h-4" />;
      case ContentType.QUIZ: return <HelpCircle className="w-4 h-4" />;
      case ContentType.NOTES: return <FileText className="w-4 h-4" />;
      case ContentType.MOCK_TEST: return <FileText className="w-4 h-4" />;
      default: return <Lightbulb className="w-4 h-4" />;
    }
  };

  const getContentTypeLabel = (type: ContentType) => {
    switch (type) {
      case ContentType.FLASHCARDS: return 'Flashcards';
      case ContentType.QUIZ: return 'Quiz';
      case ContentType.NOTES: return 'Notes';
      case ContentType.MOCK_TEST: return 'Mock Test';
      case ContentType.CONCEPT_CONNECTIONS: return 'Connections';
      case ContentType.PRACTICE_PROBLEMS: return 'Problems';
      case ContentType.MNEMONICS: return 'Mnemonics';
      case ContentType.MINDMAP: return 'Mind Map';
      case ContentType.ACTIVE_RECALL: return 'Active Recall';
      default: return type;
    }
  };

  const handleToggleLike = async (content: SharedContent) => {
    if (!selectedGroup) return;
    const newLikedState = await toggleLikeContent(selectedGroup.id, content.id, userId);
    // Update local state
    setSharedContent(prev => prev.map(c => {
      if (c.id === content.id) {
        const newLikes = newLikedState
          ? [...c.likes, userId]
          : c.likes.filter(id => id !== userId);
        return { ...c, likes: newLikes };
      }
      return c;
    }));
  };

  const handleDeleteSharedContent = async (content: SharedContent) => {
    if (!selectedGroup) return;
    if (!confirm(`Delete "${content.title}" from shared content?`)) return;

    const success = await deleteSharedContent(selectedGroup.id, content.id, userId);
    if (success) {
      setSharedContent(prev => prev.filter(c => c.id !== content.id));
      showToast('Content removed from group');
    } else {
      showToast('Failed to delete content', 'error');
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!isStudyGroupsAvailable()) {
    return (
      <div className="text-center py-16 px-4">
        <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
        <h3 className="font-bold text-slate-500 dark:text-slate-400 mb-2">Study Groups Unavailable</h3>
        <p className="text-sm text-slate-400">Sign in to access study groups and leaderboards.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Group detail view
  if (selectedGroup) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setSelectedGroup(null)}
            className="text-sm text-primary hover:text-blue-600 font-bold flex items-center gap-1"
          >
            <ChevronRight className="w-4 h-4 rotate-180" /> Back to Groups
          </button>
          <button
            onClick={() => setShowLeaveModal(true)}
            disabled={processing}
            className="text-sm text-red-500 hover:text-red-600 font-bold flex items-center gap-1"
          >
            <LogOut className="w-4 h-4" /> Leave
          </button>
        </div>

        {/* Group Info */}
        <div className="bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">{selectedGroup.name}</h2>
          {selectedGroup.description && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{selectedGroup.description}</p>
          )}
          <div className="flex flex-wrap gap-3 text-xs">
            {selectedGroup.school && (
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <School className="w-3 h-3" /> {selectedGroup.school}
              </span>
            )}
            {selectedGroup.course && (
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <BookOpen className="w-3 h-3" /> {selectedGroup.course}
              </span>
            )}
            {selectedGroup.professor && (
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <GraduationCap className="w-3 h-3" /> {selectedGroup.professor}
              </span>
            )}
            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <Users className="w-3 h-3" /> {selectedGroup.memberCount} members
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-slate-400 uppercase font-bold">Invite Code:</span>
            <code className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded font-mono text-sm text-slate-700 dark:text-slate-200">
              {selectedGroup.inviteCode}
            </code>
            <button
              onClick={() => copyInviteCode(selectedGroup.inviteCode)}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
            >
              {copiedCode ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-colors ${
              activeTab === 'leaderboard'
                ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Trophy className="w-4 h-4" /> Leaderboard
          </button>
          <button
            onClick={() => setActiveTab('shared')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-colors ${
              activeTab === 'shared'
                ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Share2 className="w-4 h-4" /> Shared
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'leaderboard' ? (
            // Leaderboard Tab
            <>
              {leaderboardLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : leaderboard.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">
                  Complete quizzes to appear on the leaderboard!
                </p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry) => (
                    <div
                      key={entry.odId}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${
                        entry.odId === userId
                          ? 'bg-primary/5 border-primary/30'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="w-8 flex justify-center">{getRankIcon(entry.rank)}</div>
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden">
                        {entry.odPhoto ? (
                          <img src={entry.odPhoto} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate">
                          {entry.odName}
                          {entry.odId === userId && <span className="text-primary ml-1">(You)</span>}
                        </div>
                        <div className="text-xs text-slate-400">
                          {entry.quizzesTaken} quizzes • {entry.accuracy}% accuracy
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-lg text-primary">{entry.totalScore}</div>
                        <div className="text-xs text-slate-400">points</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            // Shared Content Tab
            <>
              {sharedContentLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : sharedContent.length === 0 ? (
                <div className="text-center py-8">
                  <Share2 className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-sm text-slate-400 mb-2">No shared content yet</p>
                  <p className="text-xs text-slate-400">
                    Share flashcards, quizzes, and notes from your courses!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sharedContent.map((content) => {
                    const isLiked = content.likes.includes(userId);
                    const isOwner = content.sharedBy === userId;
                    return (
                      <div
                        key={content.id}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4"
                      >
                        <div className="flex items-start gap-3">
                          {/* Content Type Icon */}
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                            {getContentTypeIcon(content.type)}
                          </div>

                          {/* Content Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-bold text-slate-700 dark:text-slate-200 line-clamp-1">
                                  {content.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                                  <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                    {getContentTypeLabel(content.type)}
                                  </span>
                                  <span>{content.itemCount} items</span>
                                  {content.difficulty && (
                                    <span className="capitalize">{content.difficulty}</span>
                                  )}
                                </div>
                              </div>
                              {isOwner && (
                                <button
                                  onClick={() => handleDeleteSharedContent(content)}
                                  className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            {/* Source Info */}
                            <div className="mt-2 text-xs text-slate-400">
                              From <span className="font-medium">{content.courseName}</span>
                              {content.chapterNames && content.chapterNames.length > 0 && (
                                <span> • {content.chapterNames.join(', ')}</span>
                              )}
                            </div>

                            {/* Shared By & Actions */}
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden">
                                  {content.sharedByPhoto ? (
                                    <img src={content.sharedByPhoto} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="w-3 h-3 text-slate-400" />
                                  )}
                                </div>
                                <span>{content.sharedByName}</span>
                                <span>•</span>
                                <span>{formatRelativeTime(content.sharedAt)}</span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleLike(content)}
                                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                                    isLiked
                                      ? 'bg-red-50 dark:bg-red-900/30 text-red-500'
                                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'
                                  }`}
                                >
                                  <Heart className={`w-3 h-3 ${isLiked ? 'fill-current' : ''}`} />
                                  {content.likes.length}
                                </button>
                                <span className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-500">
                                  <Download className="w-3 h-3" />
                                  {content.cloneCount}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Leave Group Confirmation Modal */}
        <Modal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)} title="Leave Group">
          <div className="space-y-4">
            <p className="text-slate-600 dark:text-slate-300">
              Are you sure you want to leave <span className="font-bold">{selectedGroup.name}</span>?
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You'll need an invite code to rejoin this group.
            </p>
            <div className="flex gap-2 pt-4">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 px-4 py-2 text-slate-500 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveGroup}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing && <Loader2 className="w-4 h-4 animate-spin" />}
                Leave Group
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // Groups list view
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-slate-700 dark:text-slate-200">Study Groups</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowJoinModal(true)}
            className="px-3 py-1.5 text-sm font-bold text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-1"
          >
            <Hash className="w-4 h-4" /> Join
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 text-sm font-bold bg-primary text-white hover:bg-blue-600 rounded-lg transition-colors flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Create
          </button>
        </div>
      </div>

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="font-bold text-slate-500 dark:text-slate-400 mb-2">No Groups Yet</h3>
            <p className="text-sm text-slate-400 mb-4">
              Create a study group or join one with an invite code.
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setShowJoinModal(true)}
                className="px-4 py-2 text-sm font-bold border border-primary text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                Join Group
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 text-sm font-bold bg-primary text-white hover:bg-blue-600 rounded-lg transition-colors"
              >
                Create Group
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => setSelectedGroup(group)}
                className="w-full text-left p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-primary/50 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-700 dark:text-slate-200">{group.name}</h3>
                    {group.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">
                        {group.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {group.memberCount}
                      </span>
                      {group.school && (
                        <span className="flex items-center gap-1">
                          <School className="w-3 h-3" /> {group.school}
                        </span>
                      )}
                      {group.course && (
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> {group.course}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Study Group">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">
              Group Name *
            </label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="e.g., Physics 101 Study Squad"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              placeholder="What's this group about?"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">
                School
              </label>
              <input
                type="text"
                value={createForm.school}
                onChange={(e) => setCreateForm({ ...createForm, school: e.target.value })}
                placeholder="e.g., Stanford"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">
                Course
              </label>
              <input
                type="text"
                value={createForm.course}
                onChange={(e) => setCreateForm({ ...createForm, course: e.target.value })}
                placeholder="e.g., PHYS 101"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">
              Professor
            </label>
            <input
              type="text"
              value={createForm.professor}
              onChange={(e) => setCreateForm({ ...createForm, professor: e.target.value })}
              placeholder="e.g., Dr. Smith"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="flex gap-2 pt-4">
            <button
              onClick={() => setShowCreateModal(false)}
              className="flex-1 px-4 py-2 text-slate-500 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateGroup}
              disabled={processing || !createForm.name.trim()}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Group
            </button>
          </div>
        </div>
      </Modal>

      {/* Join Group Modal */}
      <Modal isOpen={showJoinModal} onClose={() => setShowJoinModal(false)} title="Join Study Group">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">
              Invite Code
            </label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter 6-character code"
              maxLength={6}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-mono text-center text-xl tracking-widest uppercase"
            />
            <p className="text-xs text-slate-400 mt-2 text-center">
              Ask your study buddy for the invite code
            </p>
          </div>
          <div className="flex gap-2 pt-4">
            <button
              onClick={() => setShowJoinModal(false)}
              className="flex-1 px-4 py-2 text-slate-500 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleJoinGroup}
              disabled={processing || joinCode.length !== 6}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin" />}
              Join Group
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
