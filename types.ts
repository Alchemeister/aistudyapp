// Domain Models

export enum ContentType {
  FLASHCARDS = 'FLASHCARDS',
  QUIZ = 'QUIZ',
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
  mastered: boolean;
  // SRS Fields
  dueDate?: string;     // ISO Date string
  interval?: number;    // Days
  easeFactor?: number;  // Multiplier
  reps?: number;        // Consecutive successful reviews
  lapses?: number;      // Times forgotten
}

export interface Question {
  id: string;
  text: string;
  type: 'MC' | 'TF' | 'OPEN';
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export interface QuizResult {
  date: string;
  score: number;
  total: number;
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

export interface Chapter {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
  extractedText?: string;
  isSuggested?: boolean;
}

export interface Lecture {
  id: string;
  title: string;
  date: string;
  audioUrl?: string;
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