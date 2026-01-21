# Conversation Log

## 2026-01-05

### User
i just had a project what was it

### Assistant
Based on the context, you're working on **aistudyapp** - a React + TypeScript study application with AI-powered features.

**Key features:**
- Upload PDFs and extract chapters
- AI content generation via Google Gemini (flashcards, quizzes, notes, mindmaps)
- Spaced repetition system (SM-2 algorithm) for flashcard review
- Offline-first storage with IndexedDB

**Recent work** (from git status):
- Modified `geminiService.ts`, `ChapterWizard.tsx`, `GeneratorPanel.tsx`, `pdfUtils.ts`
- Last commit: "Use VITE_AI_SERVICE_KEY for Gemini API"
- Deployed to Vercel

---

### User
can you make a file that record our conversation and saves every time something new is said

### Assistant
Created this file: `CONVERSATION_LOG.md`

---

### User
ok i recently started a project with you. ill try to make this quick. better flashcard gen. as a user increases difficulty it changes the distribution of hard question. from easy to hard this is the list, true/false, multiple choice, word bank with matching, fill in the blank. we started to add another study material, concept connections. we started to try the auto detect TOC think, remember to only parse like the first 30 pages then feed that to the ai, doing headers is too much. when i did pdf parsing toc the problem was itd count subchapters as another chapter.

### Assistant
Reviewed the codebase. Everything from previous session is already implemented:
- Question difficulty distribution (geminiService.ts:119-167)
- All question types: TF, MC, Matching, Fill-blank, Short Answer
- Better flashcard prompts with difficulty-specific guidance
- Concept Connections study material
- AI TOC detection (first 30 pages only)
- Subchapters properly nested as children, not separate chapters

---

### User
Continue - need mobile fixes, logout button, keep the style

### Assistant
Created dev branch. Implemented:

**Fixed (on dev branch):**
1. **Mobile scrolling** - Root cause was `overflow-hidden` on main element blocking scroll. Changed to `md:overflow-hidden`
2. **Logout button** - Added to mobile nav bar (red hover, sign-out icon)
3. **ReviewSession.tsx** - Responsive padding (p-4 → p-12), 2x2 button grid on mobile, larger touch targets
4. **QuizTaker.tsx** - Responsive padding and font sizes
5. **SettingsPanel.tsx** - Form inputs stack vertically on mobile
6. **GeneratorPanel.tsx** - Difficulty/count sliders stack on mobile
7. **PdfViewer.tsx** - Larger touch targets (min 40x40px) for navigation buttons

**Concept Connections UI already exists** - Open from Library to see:
- Main concept name
- Relationship type (produces, requires, etc.)
- Related concepts as tags
- Explanation of connections

All changes on `dev` branch. Build successful.

---

## 2026-01-09

### Lucide-React Migration (Completed)

Previous Claude session got stuck mid-migration. New session picked up and completed:
- Migrated ALL Font Awesome icons (`<i className="fas/fab fa-...">`) to lucide-react components
- 23+ component files updated
- Dark mode toggle already in App.tsx (from previous session)
- Build passes with no TypeScript errors

---

### Feature Ideas Backlog

#### 1. Mnemonic Generator (User Request)
- Generate memory aids like "ROY G. BIV" for rainbow colors
- "Every Good Boy Does Fine" for music notes
- AI creates custom mnemonics for any list/sequence

#### 2. Formula/Equation Sheets (STEM - mentioned by previous Claude)
- Auto-extract formulas from PDF chapters
- Organized reference sheets by topic
- LaTeX rendering support
- Good for physics, chemistry, math, engineering

#### 3. Study Groups & Leaderboards (User Request)
- Join groups by: Class, University, Professor
- Share flashcards and quizzes with group members
- Take each other's quizzes/tests
- Leaderboard based on quiz performance
- Could gamify studying

#### 4. Smart Lecture Notes (User Request)
- Current recorder is just transcription
- Needs: Auto-summarization, key points extraction
- Identify: definitions, examples, important dates
- Structure notes with headers automatically
- Maybe: highlight what prof repeated/emphasized

#### 5. Midterm/Final Exam Generator (User Request)
- Problem: Midterms/finals cover more content than AI context window
- Solution: Use most-studied quizzes/tests from those chapters
- Weight questions by: frequency studied, cards marked difficult, SRS lapses
- Combine into comprehensive practice exam

#### 6. Mind Maps (User Request)
- Current: Text-based concept connections
- Need: Visual node-graph representation
- Options:
  - SVG generation (no external API needed)
  - Libraries like react-flow, d3-force
  - Mermaid.js diagrams
- Could be interactive/zoomable

#### 7. Practice Problem Generator (Claude Suggestion)
- For STEM: Generate calculation problems, not just Q&A
- Step-by-step solutions
- Variable difficulty with worked examples
- Good for: Math, Physics, Chemistry, Accounting

#### 8. Timeline Generator (Claude Suggestion)
- For History, Literature, Political Science
- Auto-extract dates and events from content
- Visual timeline view
- Connect cause/effect relationships

#### 9. Case Study Analyzer (Claude Suggestion)
- For: Medical, Law, Business students
- Break down cases into: Facts, Issues, Reasoning, Holding
- Generate practice scenarios
- Compare/contrast similar cases

#### 10. Cheat Sheet Generator (Claude Suggestion)
- One-page condensed summary of chapter
- Key formulas, definitions, dates
- Print-friendly format
- "If you could only bring one page to the exam"

#### 11. Spaced Repetition Improvements (Claude Suggestion)
- Heat map calendar (like GitHub contributions)
- Streak tracking
- Optimal review time suggestions
- "Cards at risk" warnings

---

---

### Priority Feedback (User)

**YES - Do These:**
- **Mnemonic Generator** - BUT need smarter trigger. Can't just generate 10 per subchapter. Maybe: user selects a list/sequence, or AI detects enumerable content?
- **Formula/Equation Sheets** - Yes
- **Study Groups & Leaderboards** - Yes (dopamine hit / gamification)
- **Smart Lecture Notes** - Yes
- **Practice Problem Generator** - Yes, if distinct from formula sheets (formulas = reference, problems = practice)
- **Spaced Repetition Improvements** - Yes

**BACK BURNER - Uncertain Implementation:**
- Midterm/Final Generator - good theory, unclear practice
- Mind Maps - need to see it work first

**LATER:**
- Timeline Generator
- Case Study Analyzer
- Cheat Sheet Generator

---

### Technical Notes
- Mind maps: Look into react-flow or vis.js for graph visualization
- Groups: Will need Firestore collections for group management
- Leaderboards: Firebase realtime updates would be smooth
- Smart notes: Could use Gemini to post-process transcripts
- Mnemonics: Need smart detection - look for lists, sequences, steps, categories in content
  - **Phase 1:** User-initiated (highlight text → "Generate Mnemonic" button)
  - **Phase 1:** AI suggests max 1 per chapter (picks most mnemonic-worthy list)
  - **Phase 2 (maybe):** Auto-detection of enumerable content

---

### PDF Page Jump Feature (Implemented - 2026-01-09)

When clicking a chapter or subchapter in GeneratorPanel, the PDF viewer now automatically jumps to that chapter's start page.

**Changes:**
- `PdfViewer.tsx`: Added useEffect to respond to `initialPage` prop changes
- `GeneratorPanel.tsx`: Added `onChapterFocus` callback prop, fires when chapter/subchapter row clicked
- `CourseView.tsx`: Added `pdfPage` state, passes to PdfViewer and handles callback from GeneratorPanel

**UX:** Click any chapter row → PDF jumps to that page. Checkbox still toggles selection independently.
