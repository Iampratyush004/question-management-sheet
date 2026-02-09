# Interactive Question Management Sheet

Single-page React app to manage a hierarchy of:
- Topics
- Sub-topics
- Questions

## Features
- Create, edit, delete topics
- Create, edit, delete sub-topics
- Create, edit, delete questions at topic-level or sub-topic-level
- Drag-and-drop reorder for topics, sub-topics, and questions
- Search and filter questions by status
- Completion tracking (`Pending`, `Done`, `Revision`, `Marked`)
- Notes on every question
- Question URL field and clickable question titles
- Undo/redo support
- Keyboard shortcuts (`Ctrl/Cmd + F`, `N`, `Z`, `Shift+Z`)
- Enter-to-save in modal forms (`Shift+Enter` for newline in textareas)
- Export JSON and shareable-sheet links
- Progress indicators at sheet and topic levels
- Dark mode toggle
- Automatic sheet bootstrap from Codolio API (no manual trigger)
- Local CRUD state management with Zustand


## Tech
- React (Vite)
- Zustand for state management
- Native HTML5 drag-and-drop

## API reference used
GET
`https://node.codolio.com/api/question-tracker/v1/sheet/public/get-sheet-by-slug/striver-sde-sheet`

## Run locally
```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

## Notes
- In restricted/offline environments, dependency installation may fail.
- App falls back to local sample data if API is unavailable.
