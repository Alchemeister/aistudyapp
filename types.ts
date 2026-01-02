
// Domain Models

export enum ContentType {
  FLASHCARDS = 'FLASHCARDS',
  QUIZ = 'QUIZ',
  MOCK_TEST = 'MOCK_TEST',
  NOTES = 'NOTES',
  MINDMAP = 'MINDMAP',
  ACTIVE_RECALL = 'ACTIVE_RECALL'
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
  content: Flashcard[] | Question[] | string; // string for Notes/Mindmap(SVG/Text)
  sourceChapterIds?: string[];
}

export interface Subchapter {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
}

export interface Chapter {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
  extractedText?: string;
  isSuggested?: boolean;
  subchapters?: Subchapter[]; // New field for nesting
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
  chapters: Chapter[];
  lectures: Lecture[];
  materials: StudyMaterial[];
  quizHistory: QuizResult[];
}

export interface AppState {
  courses: Course[];
  user: { name: string; email: string } | null;
}
