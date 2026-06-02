# AgroGPT Project Structure

This document provides a comprehensive overview of the AgroGPT codebase, detailing the file structure, what each file contains, and its purpose within the application.

## Root Directory

The root directory contains project configuration files and the entry point for the React application.

- **`.env`**: Contains environment variables required for the application, such as Supabase credentials (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and the custom AI backend URL (`VITE_AI_ENDPOINT`).
- **`.gitignore`**: Specifies files and directories that Git should ignore (e.g., `node_modules`, build outputs).
- **`package.json`**: Defines the project's dependencies, scripts (e.g., `dev`, `build`, `lint`), and metadata.
- **`package-lock.json`**: Automatically generated file that locks down the exact versions of installed dependencies to ensure consistent builds.
- **`tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`**: TypeScript configuration files defining compiler options and strict typing rules for different parts of the app (frontend vs node context).
- **`vite.config.ts`**: Configuration file for the Vite build tool. It includes plugins like `@vitejs/plugin-react` and `vite-plugin-pwa` for Progressive Web App capabilities.
- **`tailwind.config.js` & `postcss.config.js`**: Configuration files for Tailwind CSS, defining custom themes, colors (like the glassmorphism dark theme), and PostCSS processing.
- **`index.html`**: The main HTML file that serves as the entry point for the Vite application. It mounts the React root.
- **`README.md`**: Project documentation outlining setup instructions and basic project info.
- **`eslint.config.js` & `lint_output.txt` & `eslint-report.txt`**: ESLint configuration for code linting and outputs of previous lint runs.

## `src/` Directory (Source Code)

This is the main directory containing all the application's React code, logic, and assets. It has been restructured into a Feature-Sliced Architecture to separate concerns by domain and role.

### Entry Points & Global Styles
- **`main.tsx`**: The main entry point for the React application. It renders the `<App />` component into the DOM.
- **`App.tsx`**: The root React component. It sets up routing (`react-router-dom`), context providers, and the main layout shell.
- **`App.css`**: Global application styles, custom CSS animations, and overrides not handled by Tailwind.
- **`index.css`**: Base Tailwind directives (`@tailwind base`, `components`, `utilities`) and global theme CSS variables.
- **`vite-env.d.ts`**: TypeScript declarations for Vite-specific features and environment variables.

### `core/` (Foundational Layer)
Contains the essential setup and utilities that are used across the entire application but do not belong to any specific feature.
- **`auth/`**: Contains `supabaseClient.ts`, `AuthProvider.tsx`, `AuthGuard.tsx`, and `ProtectedRoute.tsx`. Handles the foundational authentication state and database connection.
- **`api/`**: Contains `syncEngine.ts`, the custom bidirectional synchronization engine linking local Dexie.js with Supabase.
- **`utils/`**: Contains generic utility functions like `formulas.ts` (agricultural math), `geolocation.ts` (browser location and reverse geocoding), and `cn.ts` (Tailwind class merging).
- **`i18n/`**: Contains the internationalization configuration (`index.ts`) for managing translations.

### `features/` (Domain-Specific Modules)
Each folder encapsulates all components, pages, and specific logic relevant to a single domain of the application.
- **`dashboard/`**: Contains the `DashboardPage.tsx` and its specific widgets (`WeatherCard.tsx`, `FarmMap.tsx`).
- **`digital-khata/`**: Contains the `DigitalLedgerPage.tsx` for financial tracking logic. (Renamed from `digital-ledger`).
- **`field-vision/`**: Contains the `FieldVisionPage.tsx` handling camera uploads and disease detection UI.
- **`crop-calendar/`**: Contains pages and sub-modules for managing the crop calendar, growth stages, scheduled farm tasks, and weather adjustments.
- **`market/`**: Contains `MarketPostHarvestPage.tsx` for post-harvest advice and mandi market rates.
- **`settings/`**: Contains user profile and settings views (`ProfilePage.tsx`, `SettingsPage.tsx`) and the associated `accountService.ts`.
- **`agronomy/`**: Contains agronomic core logic such as `irrigationCalculator.ts`.
- **`gis/`**: Contains geospatial logic like `soilMapping.ts` and `weatherService.ts`.

### `components/` (Shared Global UI)
Contains generic, reusable UI components that are domain-agnostic.
- **`AppShell.tsx`**: The main layout wrapper containing the sidebar navigation.
- **`AIAssistantPill.tsx`**: The floating chat UI for the AI assistant.
- **`ErrorBoundary.tsx`**: A generic error boundary wrapper to prevent full app crashes.
- **`GlassCard.tsx`**: A standard card wrapper enforcing the glassmorphism design.
- **`Skeleton.tsx`**: Reusable loading placeholders.
- **`PublicRoute.tsx`**: A routing wrapper for unauthenticated pages.

### `pages/` (Global Route Views)
- **`Auth.tsx`**: The login and signup page, handling Google OAuth and phone OTP authentication.
- **`NotFoundPage.tsx`**: A 404 error page for unmatched routes.

### `lib/` (Core Data & Offline Libraries)
- **`db.ts`**: The Dexie.js database configuration handling offline-first data storage.
- **`storage.ts`**: Wrappers for handling `localStorage` and `sessionStorage`.
- **`repository.ts`**: The data access layer wrapping Dexie.js operations.
- **`engine.ts`**: Core business logic engine functions.
- **`googleAuthMock.ts`**: Mock utility for simulating Google authentication offline.
- **`authSession.ts`**: Session management utility.

### `ai/` (AI Assistant)
- **`provider.ts`**: Contains the logic for the floating AI Assistant pill, handling online inference and offline mock fallbacks.
- **`geminiRecommendationService.ts`**: Personalizes crop disease advice by connecting to the Gemini 2.5 Flash API when online.

### `hooks/` (Custom React Hooks)
- **`useAuth.ts`**: A custom hook for accessing the current user's authentication context globally.
- **`useLocalStorageState.ts`**: A custom hook that syncs a React state variable directly with browser `localStorage`.
- **`useConnectivity.ts`**: A custom hook to detect online/offline network status and manage connectivity state.

### `assets/` (Static Assets)
- Contains images, SVGs, and icons used in the UI, such as `hero.png`, `react.svg`, and `vite.svg`.

## Core Architectural & Sync Patterns

### 1. Chronological Sync Sequence Hierarchy
To satisfy remote PostgreSQL foreign key constraints on the cloud database, `syncEngine.ts` pushes local pending modifications in a strict, chronological sequence:
`crop_plans` ➔ `crop_stages` ➔ `farm_tasks` ➔ `transactions` ➔ `scans` ➔ `ai_queries` ➔ `weather_adjustments`

This order guarantees that any parent entities exist in the remote database before their dependent children rows are upserted.

### 2. 3-Phase Profile Circular Dependency Resolution
To resolve the circular dependency between the `profiles` table and the `crop_plans` table (where `profiles.active_crop_plan_id` points to a plan, but `crop_plans.user_id` points to the profile), a 3-phase push architecture is implemented in the sync engine:
1. **Phase 1 (Pre-Loop):** Query `db.profiles` for unsynced changes. Map the payload and delete `active_crop_plan_id` to temporarily strip the circular foreign key. Enforce the user's authentic session ID, sanitize the metadata, and upsert this parent profile row first to build the foundational database row.
2. **Phase 2 (Main Sync Loop):** Execute the standard table push sequence in chronological hierarchy (pushing `crop_plans`, growth stages, farm tasks, etc.). This populates the dependent tables.
3. **Phase 3 (Post-Loop):** Re-query the pending profiles from Dexie and push the complete profile payload (including the newly generated `active_crop_plan_id` pointer) to link the active plan successfully.

### 3. Authentication & Session Loop Prevention
- **Purge of Developer Bypass:** The legacy developer bypass user (`dev-bypass-user` mock session) has been completely removed to enforce strict UUID type safety against Supabase authentication standards.
- **Focus Ref Loop Prevention:** Swapping browser tabs triggers Supabase `TOKEN_REFRESHED` background events, which previously trapped `AuthProvider.tsx` in a loading state loop. The system now utilizes a React mutable `statusRef` hook implementation:
  - If the auth state change event is `TOKEN_REFRESHED`, it is explicitly ignored.
  - If the event is `SIGNED_IN` and `statusRef.current` is already `READY` (or `READY_WITH_WARNING`), it is ignored to prevent duplicate initial sync sequences and loading screens.
