# Changelog

## [2.2.0] - Stability Fixes
### Critical Fixes
- **White Screen Crash Fix**: Removed conflicting `importmap` from index.html that was forcing the browser to load incompatible React and GenAI versions from CDN.
- **Lazy AI Initialization**: `GoogleGenAI` is now initialized only when requested, not on app startup. This prevents the app from crashing immediately if the API Key is missing.
- **Mock Data Fallback**: If `VITE_GEMINI_API_KEY` is missing (e.g., during preview or testing), the app now gracefully falls back to generating mock flashcards and quizzes instead of throwing an error.

## [2.1.0] - Secure Config Update
### Features
- **Secure Environment Variables**: Migrated Firebase configuration to `.env` file using `import.meta.env` (Vite standard).
- **Configuration Validation**: Added runtime checks to ensure Firebase keys are present.

## [2.0.0] - Phase 2 Update
- Added Authentication and Note Import.