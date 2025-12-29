# Changelog

## [2.1.0] - Secure Config Update
### Features
- **Secure Environment Variables**: Migrated Firebase configuration to `.env` file using `import.meta.env` (Vite standard).
- **Configuration Validation**: Added runtime checks to ensure Firebase keys are present. The UI now displays a friendly error ("Firebase config missing – check .env file") if keys are absent.
- **Included Keys**: Updated project with specific Firebase credentials for the 'aistudyappp' project.

## [2.0.0] - Phase 2 Update
### New Features
- **Authentication**: Added secure Login screen with "Continue with Google" (Firebase Auth). Supports Demo Mode for testing without API keys.
- **Note Import**: Users can now import .txt, .md, and .pdf files directly as "Imported Notes".
- **Enhanced Generation**: The AI Generator now supports selecting "Imported Notes" alongside chapters as source material for Flashcards, Quizzes, and Summaries.

### UI Improvements
- **Course View**: Added "Import Notes" button in the header.
- **Generator Panel**: Updated selection interface to handle multiple source types (Chapters & Notes) seamlessly.
- **User Profile**: Sidebar now displays current user profile picture and name with Sign Out functionality.

## [1.3.2] - Previous
### UI Polish
- **Auto-Detect Button**: Temporarily disabled and greyed out "Auto-Detect".
- **Improved Usability**: Enhanced visibility of the "Delete Chapter" button.