
// Domain Models

export enum ContentType {
  FLASHCARDS = 'FLASHCARDS',
  QUIZ = 'QUIZ',
  MOCK_TEST = 'MOCK_TEST',
  NOTES = 'NOTES',
  MINDMAP = 'MINDMAP',
  ACTIVE_RECALL = 'ACTIVE_RECALL',
  CONCEPT_CONNECTIONS = 'CONCEPT_CONNECTIONS',
  PRACTICE_PROBLEMS = 'PRACTICE_PROBLEMS',
  MNEMONICS = 'MNEMONICS'
}

export enum Difficulty {
  EASY = 1,
  MEDIUM = 3,
  HARD = 5
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  source?: string; // Origin (e.g. "Biology 2e - Ch 3, Page 12" or "Lecture 1")
  mastered: boolean;
  // SRS Fields
  dueDate?: string;     // ISO Date string
  interval?: number;    // Days
  easeFactor?: number;  // Multiplier
  reps?: number;        // Consecutive successful reviews
  lapses?: number;      // Times forgotten
  isDuplicate?: boolean; // Transient flag for generation preview
}

export interface Question {
  id: string;
  text: string;
  type: 'MC' | 'TF' | 'OPEN' | 'FILL_BLANK' | 'MATCHING' | 'SHORT_ANSWER';
  options?: string[]; // For MC options or Matching Word Bank
  correctAnswer: string;
  explanation: string;
  source?: string; // New: Source citation for the question
  keywords?: string[]; // For basic Short Answer checking
}

export interface ConceptConnection {
  id: string;
  concept: string;           // Main concept name
  relatedConcepts: string[]; // 3-5 related terms/concepts
  relationship: string;      // Type of relationship (e.g., "causes", "is part of", "requires")
  explanation: string;       // 1-2 sentence explanation of how they connect
  source?: string;           // Page citation
}

export interface PracticeProblem {
  id: string;
  problem: string;           // The problem statement (supports LaTeX with $...$)
  givens?: string[];         // Given values (e.g., ["m = 5 kg", "a = 9.8 m/s²"])
  find?: string;             // What to find (e.g., "F = ?")
  steps: {                   // Step-by-step solution
    explanation: string;     // What we're doing in this step
    math?: string;           // The mathematical expression (LaTeX)
  }[];
  answer: string;            // Final answer (e.g., "F = 49 N")
  formula?: string;          // Key formula used (e.g., "F = ma")
  difficulty: 'easy' | 'medium' | 'hard';
  topic?: string;            // Topic/concept being tested
  source?: string;           // Page citation
}

export interface Mnemonic {
  id: string;
  items: string[];           // The list of items to remember (e.g., ["Red", "Orange", "Yellow", "Green", "Blue", "Indigo", "Violet"])
  mnemonic: string;          // The memory aid (e.g., "ROY G. BIV" or "Richard Of York Gave Battle In Vain")
  type: 'acronym' | 'acrostic' | 'rhyme' | 'story' | 'visual';
  explanation: string;       // How the mnemonic helps remember the items
  topic?: string;            // What subject/concept this helps with
  source?: string;           // Page citation
}

export interface QuizResult {
  date: string;
  score: number;
  total: number;
  chapterIds?: string[]; // IDs of chapters this quiz covered
  materialTitle?: string; // Title of the quiz material
}

export interface StudyMaterial {
  id: string;
  type: ContentType;
  title: string;
  createdAt: string;
  difficulty?: Difficulty;
  content: Flashcard[] | Question[] | ConceptConnection[] | PracticeProblem[] | Mnemonic[] | string; // string for Notes/Mindmap(SVG/Text)
  sourceChapterIds?: string[];
}

export interface Subchapter {
  id: string;
  title: string;
  startPage?: number;  // Optional - not needed if using notes only
  endPage?: number;    // Optional - not needed if using notes only
  notes?: string;      // User's lecture notes for this section
  notesTitle?: string; // Custom title for the attached notes
  isNotesOnly?: boolean; // True if this section has no PDF pages, just notes
}

export interface Chapter {
  id: string;
  title: string;
  startPage?: number;   // Optional - not needed if using notes only
  endPage?: number;     // Optional - not needed if using notes only
  extractedText?: string;
  notes?: string;       // User's notes for this chapter
  notesTitle?: string;  // Custom title for the attached notes
  isNotesOnly?: boolean; // True if chapter has no PDF, just notes
  isSuggested?: boolean;
  subchapters?: Subchapter[]; // Nested sections
}

export interface Lecture {
  id: string;
  title: string;
  date: string;
  audioUrl?: string; // Transient URL for playback
  audioBlobId?: string; // Persistent ID for IndexedDB
  transcript: string;
  sourceType?: 'recording' | 'upload'; // New field
  fileName?: string; // New field for imports
  // Smart Lecture Notes
  summary?: string;             // AI-generated summary of the transcript
  keyPoints?: string[];         // Key points extracted from the lecture
  actionItems?: string[];       // Action items/todos mentioned
  summaryGeneratedAt?: string;  // When the summary was generated
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Course {
  id: string;
  title: string;
  subtitle?: string;
  semester: string;
  code: string;
  description: string;
  pdfName?: string;
  pdfBlobId?: string;
  pdfUrl?: string;
  pdfThumbnail?: string; // Base64 thumbnail of first page
  cloudPdfPath?: string; // Firebase Storage path for Pro users
  chapters: Chapter[];
  lectures: Lecture[];
  materials: StudyMaterial[];
  quizHistory: QuizResult[];
  chatHistory?: ChatMessage[]; // Pro feature: AI chat history
}

export interface AppState {
  courses: Course[];
  user: { name: string; email: string } | null;
}

// Friends & Sharing Types

export interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  photoURL?: string;
  createdAt: string;
}

export interface Friend {
  odId: string;
  status: 'pending' | 'accepted';
  direction: 'sent' | 'received';
  friendEmail: string;
  friendName: string;
  friendPhoto?: string;
  createdAt: string;
  acceptedAt?: string;
}

export interface SharedCourse {
  shareId: string;
  courseId: string;
  courseTitle: string;
  courseSubtitle?: string;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  permission: 'view' | 'copy';
  sharedAt: string;
}

// Study Groups & Leaderboards

export interface StudyGroup {
  id: string;
  name: string;
  description?: string;
  school?: string;              // e.g., "Stanford University"
  course?: string;              // e.g., "PHYS 101"
  professor?: string;           // e.g., "Dr. Smith"
  inviteCode: string;           // 6-char code to join
  createdBy: string;            // User ID of creator
  createdAt: string;
  memberCount: number;
}

export interface GroupMember {
  odId: string;
  odName: string;
  odEmail: string;
  odPhoto?: string;
  joinedAt: string;
  role: 'admin' | 'member';
  // Leaderboard stats
  totalScore: number;           // Sum of all quiz scores (percentage points)
  quizzesTaken: number;
  correctAnswers: number;
  totalQuestions: number;
  currentStreak: number;        // Days in a row with activity
  lastActiveAt?: string;
}

export interface LeaderboardEntry {
  odId: string;
  odName: string;
  odPhoto?: string;
  totalScore: number;
  quizzesTaken: number;
  accuracy: number;             // correctAnswers / totalQuestions * 100
  rank: number;
}
