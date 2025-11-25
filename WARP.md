# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Common Commands

All commands assume the repo root is `cerespacifica`.

### Frontend (PWA / React + Vite)

The frontend lives at the repo root (`index.tsx`, `App.tsx`, `frontend/src/**`).

- Install deps:
  - `npm install`
- Run dev server (Vite):
  - `npm run dev`
  - Note: `vite.config.ts` sets the dev server to `http://localhost:3000` (README still mentions `5173`; prefer the config).
- Build production bundle:
  - `npm run build`
- Preview production build:
  - `npm run preview`

The frontend registers `sw.js` as a service worker for offline/PWA behavior.

### Backend (Node/Express API)

Backend code is in `backend/`.

From `backend/`:

- Install deps:
  - `npm install`
- Run API in dev mode (with nodemon):
  - `npm run dev`
- Run API in production mode:
  - `npm start`
- Run tests (Jest):
  - All tests: `npm test`
  - Single test file (example):
    - `npm test -- scheduling_flow.test.js`
    - or `npx jest tests/scheduling_flow.test.js`
- Lint backend source:
  - `npm run lint`
- Database migrations (Knex, dev uses SQLite via `dev.sqlite3`):
  - Latest migrations: `npm run db:migrate`
  - Seeds (if present): `npm run db:seed`

### Environment / API Keys

- Frontend:
  - `vite.config.ts` maps `GEMINI_API_KEY` from your environment into `process.env.API_KEY` and `process.env.GEMINI_API_KEY` for use in the React app (see `services/geminiService.ts`).
- Backend:
  - Expects `GEMINI_API_KEY` for `@google/generative-ai` in `backend/src/routes/ai.js`.
  - `knexfile.js` uses SQLite in `development` by default and `process.env.DATABASE_URL` in `production`.

## High-Level Architecture

### Overall

This repo implements an HQS (Housing Quality Standards) inspection system consisting of:

- A React PWA for inspectors, focused on HUD form 52580, voice input, AI support, and PDF generation.
- A Node/Express backend providing multi-agency administration, scheduling, reporting, AI endpoints, and persistence.
- Real-time updates via Socket.io and a migration-based relational schema (SQLite in dev, PostgreSQL in production).

The README (`README.md`) contains a user-facing overview (features, API examples, and schema); this section focuses on how the code is actually structured.

### Frontend: PWA & HUD 52580 Workflow

Key pieces:

- Entry & routing:
  - `index.tsx` mounts `App` and registers `sw.js` for offline/PWA support.
  - `App.tsx` configures `react-router` with a bottom navigation layout and routes for:
    - `/` and `/inspection/:id` → main inspection flow (`InspectionApp`)
    - `/scheduling` → scheduling UI (`SchedulingPage`)
    - `/history` → placeholder
    - `/settings` → configuration (`SettingsPage`)
  - `DebugLog` (from `frontend/src/components/DebugLog.tsx`) is always mounted to help debug runtime behavior.

- Inspection engine (core of the app):
  - `frontend/src/pages/InspectionApp.tsx` is a large stateful component that orchestrates the entire inspection lifecycle:
    - Maintains `UnitDetails` and an array of `RoomSection` objects (`sections`) that model the HUD checklist.
    - Uses `INITIAL_SECTIONS` and `ROOM_TEMPLATES` from `constants.ts` to dynamically construct the full set of rooms and inspection items based on bedroom/bathroom counts.
    - Manages UI state for steps (`setup` → `inspection` → `summary`), tutorial overlays, reset confirmation, and "No Entry" handling.
    - Provides helpers for adding dynamic rooms (`addBedroom`, `addBathroom`) and updating per-item status, comments, 24-hour flags, photos, and responsibility (owner vs tenant).

- Domain modeling:
  - `types.ts` defines the core domain types used throughout the frontend:
    - `InspectionStatus` enum (PENDING, PASS, FAIL, INCONCLUSIVE, N/A).
    - `InspectionItem`, `RoomLocation`, `RoomSection`, `UnitDetails`, and `AIIntent`.
  - `constants.ts` seeds `INITIAL_SECTIONS` and `ROOM_TEMPLATES` with HUD-specific guidance strings for each checklist item; this is the single source of truth for the HUD 52580 structure on the client.

- Voice & AI integration (frontend side):
  - `InspectionApp.tsx`:
    - Integrates browser speech recognition (`window.SpeechRecognition` / `webkitSpeechRecognition`) to capture voice dictation for specific fields and inspection items.
    - Routes transcripts to `processVoiceCommand` in `services/geminiService.ts` to interpret intent.
    - Uses the AI result to update item status, 24-hour flags, responsibility, and normalized comments.
  - `services/geminiService.ts` (frontend):
    - Wraps the `@google/genai` client.
    - Sends a prompt that:
      - Encodes a simplified map of current sections and item statuses.
      - Asks Gemini to return structured JSON with `sectionId`, `itemId`, `status`, `comment`, `is24Hour`, and `responsibility`.
    - Interprets the JSON into `InspectionStatus` and feeds it back into the UI.

- Reporting / PDF generation:
  - `InspectionApp.tsx` uses `jspdf` and `jspdf-autotable` to generate two kinds of reports:
    - An official-style HUD 52580 replica (`generateOfficialHUDForm`) that:
      - Creates HUD-style headers and sections.
      - Renders the checklist table with item-level status and comments.
      - Incorporates location metadata for rooms.
      - Adds a certifications/signatures page using captured signature images.
    - A branded custom report (`generatePDF`) that:
      - Summarizes unit and inspection meta-data.
      - Includes general notes and detailed per-item notes.
      - Optionally appends a photo addendum using any captured photos.

- PWA, offline, and UX details:
  - `sw.js` (at repo root) is registered from `index.tsx` and is responsible for offline behavior/caching.
  - `InspectionApp` implements:
    - A tutorial overlay explaining the workflow.
    - A signature pad component for digital signatures.
    - Photo capture via an invisible `<input type="file" capture="environment">`, storing base64-encoded images on items or at a general level.

### Backend: API, Services, and Data

Backend entry and configuration:

- `backend/src/server.js`:
  - Sets up Express, CORS, Helmet, JSON body parsing, rate limiting, and a basic request logger.
  - Creates an HTTP server and attaches a Socket.io server configured to accept requests from known frontend origins.
  - Wires up route modules under `/api/*`:
    - `/api/auth` → `users` routes
    - `/api/inspections` → inspections CRUD and related flows
    - `/api/schedules` → scheduling operations
    - `/api/reports` → reporting endpoints
    - `/api/ai` → backend AI utilities
    - `/api/ingestion`, `/api/integrations`, `/api/mailing` → data ingestion, external integrations, and mailing flows
  - Applies `authMiddleware` to all non-auth routes to enforce authentication and attach `req.user` / `req.agencyId`.
  - Initializes the database (`initDatabase` from `config/database.js`) before starting the HTTP server.

- `backend/knexfile.js`:
  - Configures Knex for:
    - `development` – SQLite database in `./dev.sqlite3`, migrations in `backend/migrations/`, seeds in `backend/seeds/`.
    - `production` – PostgreSQL using `process.env.DATABASE_URL` with the same migrations directory.

- Database schema:
  - Implemented via migrations in `backend/migrations/*.js`.
  - Tables align with the README’s concepts: agencies, users, units, inspections, schedules, deficiencies, audit trails, etc.

#### Routing & Business Logic

- Inspections (`backend/src/routes/inspections.js`):
  - Lists inspections for an agency with filters and pagination; joins units and users for display data.
  - Loads a single inspection with its associated deficiencies.
  - Creates inspections:
    - Validates input via `validateInspectionData` in `utils/validators.js`.
    - Persists inspection records, including serialized inspection `data`.
    - Calls `syncService.extractDeficiencies` to derive per-item deficiencies from the inspection payload.
    - Calls `syncService.check24HourFails` to detect 24-hour emergency failures from the same payload.
    - Records an audit trail entry.
  - Updates inspections similarly, re-extracting deficiencies and 24-hour flags and updating the audit trail.
  - Provides an `auto-route` endpoint that defers to `schedulingService.autoRoute` to generate schedules given a date range.

- Schedules (`backend/src/routes/schedules.js`):
  - Exposes paginated schedule listing with filters for inspector, date range, and status; joins inspections, units, and users for context.
  - Loads individual schedules with joined inspection, unit, and inspector information.
  - Creates schedules:
    - Validates input with `scheduleSchema` (Joi-based validator).
    - Ensures referenced inspections belong to the current agency.
    - Detects conflict-free time slots for inspectors.
    - Persists schedules and logs them in `audit_trails`.
    - Notifies inspectors and the agency via Socket.io (`emitToUser`, `emitToAgency`).
  - Batch creation endpoint (`/batch`) that validates and inserts multiple schedules, with conflict checks and audit logging.

- AI services (`backend/src/routes/ai.js`):
  - Uses `@google/generative-ai` (`GoogleGenerativeAI`) initialized with `process.env.GEMINI_API_KEY`.
  - `/api/ai/analyze`:
    - Given item description, photos (placeholder), type, and HUD guidance, prompts Gemini to return pass/fail status, 24-hour classification, responsibility, and a detailed comment.
    - Parses the AI response (extracts JSON from free text) and logs the AI decision into `audit_trails`.
  - `/api/ai/transcribe`:
    - Converts rough voice notes (`audioText`) into professional HQS inspection comments.
  - `/api/ai/predict`:
    - Aggregates historical deficiencies for similar units (by unit type and year built range) from the database.
    - Feeds that into Gemini to get predicted high-risk items and focus areas; falls back to a deterministic summary if parsing fails.
  - `/api/ai/summarize`:
    - Given a full inspection payload, synthesizes a narrative summary (overall assessment, critical issues, standard deficiencies, recommendations, and timelines).

- Other service layers (not fully detailed here but important conceptually):
  - `services/syncService.js` – interprets inspection `data` into deficiency records and 24-hour flags.
  - `services/schedulingService.js` – encapsulates complex scheduling/auto-routing logic.
  - `services/reportService.js`, `services/mailingService.js`, `services/letterService.js` – handle reporting and communication flows.
  - `services/socketService.js` – centralizes Socket.io event emission and room/agency scoping.
  - Middleware in `middleware/`:
    - `auth.js` – attaches `req.user`/`req.agencyId`, enforces privileges (`requirePrivilege`) and agency access (`requireAgencyAccess`).
    - `errorHandler.js` – centralized error handling.

- Utilities:
  - `utils/validators.js` – Joi schemas and validation helpers for inspections and schedules.
  - `utils/logger.js` – wraps Winston logging used in both `server.js` and routes/services.

### Multi-Agency, RBAC, and Audit Trail

- All sensitive routes rely on `authMiddleware` plus route-level guards (`requirePrivilege`, `requireAgencyAccess`).
- Queries are consistently filtered by `req.agencyId` to maintain agency data isolation.
- Important mutations (creating/updating inspections and schedules, AI analysis invocations) insert audit records into `audit_trails` with before/after or input/output payloads.

### AI, 24-Hour Fail Logic, and End-to-End Flow

- The 24-hour emergency defect concept is handled in several layers:
  - Frontend:
    - `InspectionApp` allows toggling `is24Hour` on individual items and visually emphasizes 24-hour FAILs in the UI and PDFs.
    - Frontend `processVoiceCommand` prompt explicitly encodes 24-hour rules for electricity, water, toilet functionality, smoke/CO detectors, and similar life-safety items.
  - Backend:
    - `syncService.check24HourFails` (invoked from `routes/inspections.js`) re-derives 24-hour emergency items from the saved payload for persistence and downstream workflows.
    - AI analysis endpoints in `/api/ai` also reason about 24-hour flags when classifying failures.

### When Extending This Codebase

When implementing new features or modifying behavior, keep these structural expectations in mind:

- Frontend inspection logic is driven by `types.ts` and `constants.ts` (for sections and items). Any structural change to the HUD checklist should originate there and then be reflected in `InspectionApp.tsx` rendering and PDF generation.
- AI behavior is split between:
  - The in-browser `services/geminiService.ts` (for real-time voice-driven updates during inspections), and
  - The backend `/api/ai/*` routes (for analysis, transcription, prediction, and summarization tied into audit trails and historical data).
- Backend business rules for inspections, scheduling, and 24-hour emergencies live primarily in the service layer (`services/*.js`) and are invoked from `routes/*.js`; prefer updating services over embedding complex logic directly in routes.
