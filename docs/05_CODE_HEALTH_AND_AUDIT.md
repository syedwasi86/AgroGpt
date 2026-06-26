# 05 Code Health and Audit

This document details an exhaustive static analysis sweep, pointing directly to architectural flaws, dependency bloat, dead code, and active security vulnerabilities across the repository.

## 1. Dead Code
- **Unused Imports in Views:** 
  - `src/features/market/MarketPostHarvestPage.tsx` lines 1-37 contain completely orphaned React imports (`LedgerItem`, `SoilReport`, `CropRequirement`, `MandiPrice`) alongside unused Lucide icons (`Banknote`, `Beaker`, `ArrowRightCircle`, `ExternalLink`, `Loader2`) and utility variables (`cn`, `db`, `repoAddTransaction`, `useLiveQuery`).
  - `src/features/precision-planning/PrecisionPlanningPage.tsx` line 3: Imports `RefreshCw` but never mounts it; line 163: `loading` state variable is declared but never read.
- **Unused React Declarations:** 
  - `src/features/field-vision/CropSelector.tsx` and `PredictionResults.tsx` unnecessarily import `React`, violating modern React 19 JSX transform principles.

## 2. Dependency Bloat
The `package.json` contains several remarkably heavy packages that are downloaded during installation but completely ignored by the `src/` codebase:
- `pdfjs-dist`
- `tesseract.js`
- `recharts`

## 3. Architecture Flaws & Hidden Errors
- **Broken React Closures:** In `src/components/AuthProvider.tsx`, `syncProfile` is accessed on line 24 within a `useEffect`, but is not formally declared until line 43. This violates initialization flow, potentially resulting in scope/reference errors at runtime.
- **Bidirectional Sync Race Conditions:** In `src/core/api/syncEngine.ts`, the background synchronizer utilizes an `isSyncing` boolean to prevent overlapping executions. However, this lock is strictly in-memory per thread. If a user opens AgroGPT in two distinct browser tabs on their mobile device, the tabs share the exact same IndexedDB instance but isolated memory, allowing them to race against each other, potentially causing duplicated upserts.
- **Mobile Quota Memory Leaks via Base64:** The `scans` table directly injects native device camera pictures as Base64 strings into `image_url`. At 5MB-10MB per high-resolution snapshot, the IndexedDB store will rapidly bloat and trigger browser-enforced storage quota evictions (often hitting hard limits around 50MB in Safari/iOS).

## 4. Security Vulnerabilities
- **Exposed Token:** Within the root `.env` file, the variable `SUPABASE_ACCESS_TOKEN=sbp_780340501a0ca2c4a4a8a43e264539bc8704ecc2` is defined in plain text. Unlike the `VITE_SUPABASE_ANON_KEY` which is safe for public distribution via RLS, a native `SUPABASE_ACCESS_TOKEN` is traditionally utilized for CLI/administrative overriding capabilities. Exposing this token presents a critical security loophole if committed.
