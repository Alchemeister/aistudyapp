import React, { useState, useEffect, useContext, type FC } from 'react';
import {
  Users, Plus, Copy, Check, Trophy, Crown, Medal, Award, ChevronRight,
  LogOut, Loader2, User, School, BookOpen, GraduationCap, Hash
} from 'lucide-react';
import { StudyGroup, LeaderboardEntry, UserProfile } from '../types';
import {
  createGroup, joinGroup, leaveGroup, getMyGroups, getGroupLeaderboard, isStudyGroupsAvailable
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

  // Load leaderboard when group selected
  useEffect(() => {
    if (selectedGroup) {
      setLeaderboardLoading(true);
      getGroupLeaderboard(selectedGroup.id)
        .then(setLeaderboard)
        .finally(() => setLeaderboardLoading(false));
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

  const handleLeaveGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to leave this group?')) return;

    setProcessing(true);
    try {
      const success = await leaveGroup(userId, groupId);
      if (success) {
        setGroups(prev => prev.filter(g => g.id !== groupId));
        setSelectedGroup(null);
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
            onClick={() => handleLeaveGroup(selectedGroup.id)}
            disabled={processing}
            className="text-sm text-red-500 hover:text-red-600 font-bold flex items-center gap-1"
          >
            <LogOut className="w-4 h-4" /> Leave Group
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

        {/* Leaderboard */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-700 dark:text-slate-200">Leaderboard</h3>
          </div>

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
        </div>
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
