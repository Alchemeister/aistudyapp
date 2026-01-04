# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
npm install        # Install dependencies
npm run dev        # Start development server (Vite)
npm run build      # TypeScript compile + production build
npm run preview    # Preview production build locally
```

## Environment Setup

Copy `.env.example` to `.env.local` and set:
- `GEMINI_API_KEY` - Google Gemini API key (required for AI features)
- Firebase config variables (optional - app works offline without Firebase)

## Architecture Overview

This is a React 18 + TypeScript study application with AI-powered content generation and spaced repetition learning.

### Key Directories

- `components/` - React UI components
- `services/` - Business logic and external integrations
- `types.ts` - TypeScript domain models (Course, Chapter, Flashcard, Question, etc.)
- `App.tsx` - Main app component with routing, auth, and state management

### Service Layer

**storage.ts** - IndexedDB persistence via idb-keyval
- Offline-first: all data stored locally in IndexedDB
- Blob management: PDFs/audio stored with special prefixes (BLOB_PREFIX, MEDIA_PREFIX)
- URL hydration: Object URLs created on load, stripped before save

**geminiService.ts** - Google Gemini AI integration
- Uses Gemini 3 Flash model for content generation
- Generates: flashcards, quizzes, mock tests, notes, mindmaps
- Has JSON repair mechanism for truncated AI responses
- Falls back to mock data if API key unavailable

**firebase.ts** - Firebase Auth (optional)
- Supports Google OAuth and email/password authentication
- Graceful fallback if Firebase config is missing

**srs.ts** - Spaced Repetition System (SM-2 algorithm)
- Calculates intervals, ease factors, and due dates
- Cards mastered when interval > 21 days

**pdfUtils.ts** - PDF.js text extraction
- Uses CloudFlare CDN worker for PDF.js
- Extracts text from page ranges for chapter content

### Data Flow

1. User uploads PDF → chapters extracted → blob stored with course
2. Content generation → Gemini API processes text → materials stored
3. Flashcard review → SRS algorithm updates due dates
4. Quiz completion → missed questions become flashcards

### Routing (HashRouter)

- `/` - Dashboard with course list and charts
- `/course/:courseId` - Course detail view (chapters, lectures, materials, quizzes)
- `/review` - Spaced repetition flashcard review
- `/settings` - Settings and logout

### Styling

Uses Tailwind CSS loaded via CDN in index.html. Custom theme colors and animations defined in `tailwind.config.js`.
