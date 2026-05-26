# AgroGPT: Precision Planning & Offline-First Crop Calendar Redesign Report
**Report Date:** May 27, 2026  
**Auditor:** Antigravity AI Codebase Architect  
**Version:** 3.0.0 (Production Migration Audit)

---

## Table of Contents
1. [Feature Overview](#1-feature-overview)
2. [Offline-First Architecture](#2-offline-first-architecture)
3. [Database & Sync System](#3-database--sync-system)
4. [Farming Business Logic Engines](#4-farming-business-logic-engines)
5. [Weather Advisory System](#5-weather-advisory-system)
6. [UI/UX Redesign](#6-uiux-redesign)
7. [Shared UI System](#7-shared-ui-system)
8. [Responsiveness & Mobile UX](#8-responsiveness--mobile-ux)
9. [Performance & Scalability](#9-performance--scalability)
10. [Final Implementation Status](#10-final-implementation-status)

---

## 1. Feature Overview

### Purpose of Precision Planning
The **Precision Planning** feature in AgroGPT is a local-first, weather-aware cultivation planner designed to support Indian smallholder farmers. In typical rural agricultural environments, access to expert guidance, dynamic cultivation schedules, and weather warnings is limited. Precision Planning bridges this gap by acting as a digital agronomist that computes sowing schedules, tracks growth stages, schedules tasks, and adjusts operations based on live localized forecasts—functioning fully offline.

### Farmer-Focused Operational Goals
- **Resource Optimization:** Guide water, fertilizer, and pesticide applications to minimize costs and maximize efficiency.
- **Risk Mitigation:** Surface warnings for high winds, extreme heat, cold stress, and elevated fungal disease risks before they impact crops.
- **Workflow Clarity:** Group daily field tasks into clear timeframes (Today, This Week) so farmers can plan labor and activities efficiently.
- **Cultivation Tracking:** Keep a historical log of crop development, varieties planted, and yields to aid multi-season farm planning.

### Offline-First Philosophy
Internet connectivity in rural India is frequently unstable or absent. Traditional cloud-dependent calendars fail to load or crash when cell signals drop in the field. AgroGPT's offline-first philosophy guarantees that a farmer can view their schedule, log tasks, check historic plans, and manage their farm activities completely offline. Heavy computations—such as schedule generation and stage calculations—take place entirely on the client, rather than relying on remote APIs.

### Weather-Aware Planning System
Instead of presenting static, unresponsive calendars, the Precision Planning feature integrates live meteorological data from the **Open-Meteo API** (falling back to cached data or local algorithms when offline). The system evaluates these forecasts against crop-specific sensitivity thresholds to reschedule tasks (like delaying irrigation during heavy rainfall) and generate daily preventative warnings.

### Responsive Agricultural Workflow Design
The interface is designed as a calm, operational workspace optimized for field use:
- **Legacy System:** A basic React calendar widget directly dependent on Supabase. It caused crashes when offline, had no caching, offered no dynamic stage calculations, and lacked weather-aware logic.
- **Modern System:** A local-first agricultural operations system with an offline-first scheduler, on-device templates, automatic weather adjustments, and bidirectional background sync.

---

## 2. Offline-First Architecture

### Local-First Design
Direct backend dependencies have been removed from the UI layer. All database reads and writes are directed to a local client-side IndexedDB database via **Dexie.js**. React components query the database reactively using the `useLiveQuery` hook from `dexie-react-hooks`. When the local database updates, the UI automatically and instantly triggers re-renders.

### Sync Architecture
A background synchronization manager (`syncEngine.ts`) manages bidirectional data movement. 

```
                                  +──────────────────────────────────+
                                  |           AgroGPT PWA            |
                                  |                                  |
   +────────────────────────+     |   +──────────────────────────+   |
   |   Supabase Database    | ◄───┼───┤   syncEngine.ts (Sync)   │   |
   |   (Cloud PostgreSQL)   |     |   +────────────┬─────────────+   |
   +────────────────────────+     |                │                 |
                                  |                ▼                 |
                                  |   +──────────────────────────+   |
                                  |   |   Dexie.js (IndexedDB)   │   |
                                  |   |  (Plans, Stages, Tasks)  │   |
                                  |   +────────────▲─────────────+   |
                                  |                │                 |
                                  |   +────────────┴─────────────+   |
                                  |   |    React UI Components   │   |
                                  |   |     (useLiveQuery)       │   |
                                  |   +──────────────────────────+   |
                                  +──────────────────────────────────+
```

### Optimistic Updates
When a farmer creates a crop cycle, marks a task as complete, or adds custom notes, these changes write immediately to IndexedDB. The UI updates within milliseconds. The local record is flagged with a `sync_status = 'pending'` and has its `version` incremented. When internet connectivity is detected, `syncEngine.ts` pushes changes to Supabase in the background, resolving any conflicts asynchronously.

### Offline Resilience Strategy
- **Zero Inline Remote Calls:** React components do not contain `fetch()` or `supabase` calls for planning operations.
- **On-Device Engines:** Template validation, schedule generation, and stage progression are computed locally via JavaScript engines.
- **Background Watermarks:** The sync engine maintains a watermark timestamp (`last_sync` in `user_settings`). If a sync fails or the device is offline, pending changes remain queued in Dexie and are retried on the next connection.

---

## 3. Database & Sync System

### Local IndexedDB Schemas
The client-side database is defined in `src/lib/db.ts` (Database Version 2) with the following structures:

#### 1. `crop_plans`
Stores the metadata of active and completed crop cycles.
- `id` (Primary Key, String - UUID)
- `user_id` (Indexed, String - Nullable)
- `crop_type` (String - e.g., 'Cotton')
- `variety` (String - e.g., 'Bt Cotton')
- `sowing_date` (Indexed, String - YYYY-MM-DD UTC)
- `area` (Number - Acreage)
- `status` (Indexed, String - `'planned' | 'active' | 'completed' | 'failed'`)
- `version` (Number - Conflict tracking)
- `sync_status` (String - `'pending' | 'synced' | 'failed'`)
- `created_at` / `updated_at` (ISO strings)
- `deleted_at` (Indexed, ISO string - Nullable)

#### 2. `crop_stages`
Stores the generated growth stage boundaries for each plan.
- `id` (Primary Key, String - UUID)
- `plan_id` (Indexed, String - UUID)
- `name` (String - e.g., 'Vegetative')
- `start_day` / `end_day` (Number - Relative days from sowing)
- `start_date` / `end_date` (Indexed, String - YYYY-MM-DD UTC)
- `status` (Indexed, String - `'upcoming' | 'current' | 'completed'`)
- `version` (Number)
- `sync_status` (String)
- `created_at` / `updated_at` / `deleted_at` (Indexed, ISO strings)

#### 3. `farm_tasks`
Stores the scheduled operations for each crop plan.
- `id` (Primary Key, String - UUID)
- `plan_id` (Indexed, String - UUID)
- `stage_id` (Indexed, String - UUID - Nullable)
- `title` (String)
- `description` (String - Nullable)
- `status` (Indexed, String - `'pending' | 'completed' | 'overdue' | 'rescheduled'`)
- `task_date` (Indexed, String - YYYY-MM-DD UTC, matches effective_date)
- `scheduled_date` (String - YYYY-MM-DD UTC, original agronomy advice)
- `effective_date` (String - YYYY-MM-DD UTC, weather-adjusted execution date)
- `task_type` (Indexed, String - `'irrigation' | 'fertilization' | 'pesticide' | 'weeding' | 'harvesting' | 'inspection' | 'other'`)
- `priority` (String - `'low' | 'medium' | 'high'`)
- `notes` (String - Farmer-written remarks)
- `origin` (String - `'template' | 'manual' | 'weather_adjustment' | 'ai_generated'`)
- `task_template_id` (String - Nullable)
- `is_recurring` (Boolean)
- `recurrence_interval_days` (Number - Nullable)
- `version` (Number)
- `sync_status` (String)
- `created_at` / `updated_at` / `deleted_at` (Indexed, ISO strings)

#### 4. `weather_adjustments`
Stores the historical log of weather-induced task delays.
- `id` (Primary Key, String - UUID)
- `plan_id` (Indexed, String - UUID)
- `task_id` (Indexed, String - UUID)
- `adjustment_type` (Indexed, String - `'irrigation_delay' | 'spray_warning' | 'disease_warning' | 'heat_stress'`)
- `reason` (String)
- `original_date` / `adjusted_date` (String - YYYY-MM-DD UTC)
- `weather_data` (JSONB Object - precipitation, wind speed, humidity, temperature)
- `applied_at` (ISO UTC string)
- `version` (Number)
- `sync_status` (String)
- `created_at` / `updated_at` / `deleted_at` (Indexed, ISO strings)

---

### Sync Engine Mechanics (`syncEngine.ts`)

#### 1. Push Phase (`pushChanges`)
- Queries Dexie tables for records where `sync_status === 'pending'` or `updated_at > last_sync`.
- Iterates through tables in order: `profiles`, `crops`, `transactions`, `scans`, `ai_queries`, `crop_plans`, `crop_stages`, `farm_tasks`, and `weather_adjustments`.
- sanitizes payloads (converts numeric inputs, enforces valid dates, strips undefined properties).
- Pushes records to Supabase in batches using PostgreSQL upserts:
  ```ts
  const { error } = await supabase.from(tableName).upsert(payload)
  ```
- If successful, local records are updated to `sync_status = 'synced'`. If the request fails (e.g. offline), records are set to `sync_status = 'failed'` to trigger a retry during the next sync.

#### 2. Pull Phase (`pullUpdates`)
- Pulls records from Supabase where `updated_at > last_sync`.
- Compares remote and local records to resolve conflicts:
  - **Version-First Comparison:** If `remote.version > local.version`, the remote record overwrites the local one.
  - **Timestamp Fallback:** If versions match, the record with the newer `updated_at` timestamp is kept (Last-Write-Wins).
  - Puts the resolved record into Dexie with `sync_status = 'synced'`.

#### 3. Soft Deletion Strategy
- To prevent sync mismatches, records are never hard-deleted locally. Instead, their `deleted_at` field is populated with an ISO timestamp.
- The sync engine pushes these changes to Supabase, which updates its corresponding columns.
- Queries in components filter out soft-deleted records (`deleted_at == null`).

---

### Supabase Migration Updates (`0003_crop_calendar_local_first.sql`)
- Creates parallel PostgreSQL tables (`crop_plans`, `crop_stages`, `farm_tasks`, `weather_adjustments`) matching the Dexie schema.
- Uses `UUID PRIMARY KEY DEFAULT gen_random_uuid()` to prevent ID collisions between offline clients.
- Configures cascade deletes (`ON DELETE CASCADE`) to clean up stages, tasks, and adjustments if a plan is removed.
- Enforces user isolation via Row Level Security (RLS) policies:
  ```sql
  CREATE POLICY "Users can manage their own crop_plans" ON crop_plans
    FOR ALL USING (auth.uid() = user_id);
  ```

---

## 4. Farming Business Logic Engines

The planning features isolate farming heuristics from the UI components. Business logic is organized into dedicated engines:

```
                  +───────────────────────────────────────+
                  |           sowingDate, area            |
                  +───────────────────┬───────────────────+
                                      │
                                      ▼
                  +───────────────────────────────────────+
                  |         scheduleGenerator.ts          |
                  |  - Validates crop template            |
                  |  - Maps relative days to UTC dates    |
                  |  - Expands recurring task intervals   |
                  +───────────────────┬───────────────────+
                                      │
                                      ▼
                  +───────────────────────────────────────+
                  |      cropCalendarRepository.ts        |
                  |  - Performs database transactions     |
                  |  - Writes plans, stages, tasks        |
                  +───────────────────────────────────────+
```

### 1. Crop Templates Engine (`cropTemplates.ts`)
Defines the agronomic profiles for five target crops:
* **Cotton:** 160-day cycle. Stages: Germination (10d), Vegetative (45d), Flowering (35d), Boll Development (40d), Maturity (30d). Sensitivity thresholds: Max Temp 38°C, Min Temp 15°C, Wind 15 km/h, Humidity 85%, Rain 5mm.
* **Rice:** 120-day cycle. Stages: Seedling (20d), Tillering (30d), Panicle Initiation (20d), Flowering (20d), Maturity (30d). Sensitivity thresholds: Max Temp 36°C, Min Temp 12°C, Wind 12 km/h, Humidity 88%, Rain 8mm.
* **Maize:** 110-day cycle. Stages: Germination (10d), Early Vegetative (25d), Late Vegetative (25d), Flowering (15d), Grain Fill (20d), Maturity (15d). Sensitivity thresholds: Max Temp 38°C, Min Temp 10°C, Wind 18 km/h, Humidity 80%, Rain 6mm.
* **Tomato:** 130-day cycle. Stages: Nursery (25d), Transplanted (35d), Flowering (25d), Fruit Set (25d), Harvesting (20d). Sensitivity thresholds: Max Temp 35°C, Min Temp 8°C, Wind 12 km/h, Humidity 82%, Rain 4mm.
* **Chilli:** 140-day cycle. Stages: Seedling (30d), Vegetative (40d), Flowering (25d), Fruit Development (25d), Harvesting (20d). Sensitivity thresholds: Max Temp 37°C, Min Temp 10°C, Wind 14 km/h, Humidity 80%, Rain 5mm.

### 2. Schedule Generator Engine (`scheduleGenerator.ts`)
- Accepts crop variety, sowing date, and acreage.
- Validates the target crop template using `cropTemplateValidator.ts` against the Zod schema in `cropTemplateSchema.ts`.
- Computes actual growth stage dates using UTC arithmetic to avoid timezone shifts:
  ```ts
  const startDate = addDaysUtc(sowingDateNormalized, startDay)
  ```
- Evaluates template tasks and expands recurring items (e.g. weeding tasks scheduled every 14 days) through the lifecycle.
- Resolves stage assignments for tasks dynamically and inserts all records in a single Dexie transaction.

### 3. Stage Engine (`stageEngine.ts`)
- Evaluates progress on the fly using selectors (`selectors/index.ts`) instead of saving derived data:
  - `calculateDaysElapsed`: Counts UTC days from sowing.
  - `calculateLifecycleProgress`: Determines completion percentage: $\min(100, \max(0, \frac{\text{elapsed}}{\text{duration}} \times 100))$.
  - `determineCurrentStage`: Scans stages and returns the active stage matching the current date.

### 4. Weather Adjustment Engine (`weatherAdjustmentEngine.ts`)
- Evaluates forecasted values against the crop's sensitivity settings.
- If forecasted rain exceeds the crop's threshold, it reschedules pending irrigation tasks by 1 to 2 days depending on rainfall intensity.
- Returns weather alerts for display in the UI and writes logs into the local database.

---

## 5. Weather Advisory System

The weather advisory system acts as a protective shield for agricultural operations, evaluating forecast data (precipitation, humidity, temperature, wind speed) against crop-specific thresholds.

### Weather Sensitivity Thresholds & Warning Triggers
- **Rain Delay Logic:** If forecasted precipitation sum is $\ge$ `rainThreshold`, the system reschedules pending irrigation tasks. If rain is $> 10$mm, the delay is 2 days; otherwise, it is 1 day. This prevents waterlogging and conserves resources.
- **Spray Wind Warnings:** If max wind speed is $\ge$ `windSpeedThreshold`, the system flags wind warnings on affected dates:
  > *"High wind speed of X km/h detected. Avoid pesticide or fertilizer spray to prevent chemical drift."*
- **Humidity Disease Warnings:** If maximum relative humidity is $\ge$ `humidityThreshold`, the system flags fungal disease risks:
  > *"High relative humidity of X% detected. Elevates risk of fungal disease infections (e.g. leaf blight, blast). Inspect crops closely."*
- **Heat & Cold Stress Warnings:** If max temperature is $\ge$ `maxTempThreshold`, the system triggers heat warnings:
  > *"Extreme temperature of X°C detected. Heat stress can cause crop damage. Consider light mulching or soil dampening."*
  If max temperature is $\le$ `minTempThreshold`, it warns of cold stress slowing development.

### The `effective_date` Adjustment System
To prevent adjustments from altering the baseline schedule, the database stores two dates for each task:
- `scheduled_date`: The original date generated from the template.
- `effective_date`: The execution date that changes with weather delays.
- `task_date`: Matches `effective_date` for backward compatibility.

When a rain delay is applied, `effective_date` is updated, the task status changes to `'rescheduled'`, and a log is created in the `weather_adjustments` table. This keeps the initial calendar schedule intact.

### UX Philosophy: Actionable Warnings
Rather than showing aggressive alarms, weather advisories are presented in a supportive, calm UI. Warnings are grouped by date with clear, actionable text. Less urgent alerts are collapsed under a "View More" toggle to reduce visual clutter.

---

## 6. UI/UX Redesign

The Precision Planning interface has been redesigned to look and feel like an **intelligent agricultural operations workspace** rather than an engineering dashboard.

```
+─────────────────────────────────────────────────────────────+
| 1. Header (Title, Subtitle, Reset Action)                   |
+─────────────────────────────────────────────────────────────+
| 2. Crop Lifecycle Timeline                                  |
|    [Germination] ──► [=== Vegetative ===] ──► [Flowering]   |
+─────────────────────────────────────────────────────────────+
| 3. Crop Summary (40%)        | Today's Focus (60%)          |
|    - Variety, Sowing Date    | - Urgent Tasks               |
|    - Acreage                 | - Weather Delay Summary      |
|    - Active Disease Risks    | - Active Disease Risks       |
+─────────────────────────────────────────────────────────────+
| 4. Weather Advisory (Collapsible grouped cards)              |
+─────────────────────────────────────────────────────────────+
| 5. Farm Operations Tabs (Today / This Week / Calendar)      |
|    - Max height 400px with internal scrolling               |
+─────────────────────────────────────────────────────────────+
| 6. Quick Insights (Hydration, climate parameters)           |
+─────────────────────────────────────────────────────────────+
| 7. Upcoming Milestones (Stage transitions, harvest windows) |
+─────────────────────────────────────────────────────────────+
```

### Hierarchy of Redesigned Sections
1. **Header:** Features clean typography, status badges, and a "Reset Plan" button.
2. **Crop Lifecycle:** A horizontal progress tracker anchored near the top of the viewport. It displays the active growth phase, days in stage, total progress, and a countdown to the next stage.
3. **Crop Summary + Today’s Focus Grid:** A split container (40%/60% on desktop) showing key parameters next to immediate tasks, active weather delays, and warning counts.
4. **Weather Advisory:** Displays day-grouped weather warnings categorized into Spray, Irrigation, and Disease alerts.
5. **Farm Operations:** Houses three view tabs:
   - *Today:* Daily operations checklist and overdue items.
   - *This Week:* Upcoming activities scheduled for the next 7 days.
   - *Calendar:* An interactive date grid that shows scheduled tasks on selection.
   - *Layout constraint:* The task container height is capped at `400px` with internal scrolling to prevent pages from stretching.
6. **Quick Insights:** Observation chips summarizing soil hydration levels and environmental conditions.
7. **Upcoming Milestones:** A vertical timeline tracing future growth stages and estimated harvest windows.

### Visual Design Decisions
- **Calm Palette:** Replaced harsh warning colors with organic forest greens (`#87A96B`), warm ambers (`#F4D03F`), and cool teal borders to align with an agricultural theme.
- **Glassmorphic Theme:** Background cards use dark glass structures (`bg-white/5 border-white/5 backdrop-blur-md`) to ensure visual consistency across the app.
- **Diagnostics Removal:** Removed technical telemetry logs and raw SQL sync states to maintain a clean layout focused on farming.

---

## 7. Shared UI System

To ensure layout consistency and scalability, all main page widgets are built using a library of reusable UI primitives located in `src/features/crop-calendar/shared/ui/`:

* **`SectionContainer.tsx`**
  Standardizes card margins and titles across sections. It manages responsive padding:
  - Desktop: `24px` padding, margins, and border separators.
  - Mobile: `16px` padding and tighter text layouts.
* **`EmptyState.tsx`**
  Renders calm illustrations and messaging when a tab has no scheduled tasks.
* **`AdvisoryRow.tsx`**
  Standardizes the layout of weather warnings, using icons and colors to denote category and severity.
* **`StatusBadge.tsx`**
  Renders status tags (Pending, Completed, Overdue, Rescheduled) using consistent tailwind classes.
* **`SkeletonLoader.tsx`**
  Displays animated placeholders during IndexedDB queries.
* **`TimelineMarker.tsx`**
  Handles vertical milestones, rendering progress paths and icons for future stages.
* **`ProgressIndicator.tsx`**
  Handles linear and circular progress displays.

---

## 8. Responsiveness & Mobile UX

- **Mobile Stacking Grid:** On desktop, the Crop Summary and Today’s Focus cards sit side-by-side (40%/60%). On mobile, the grid shifts to a linear stack, and **Today's Focus is prioritized at the top** to show immediately actionable tasks first.
- **Internal Scrolling:** Stretched checklists are capped at `400px` on mobile, keeping the page compact and easy to navigate.
- **Touch Targets:** Buttons, checkboxes, and calendar day nodes are designed with larger touch targets to prevent accidental taps on mobile viewports.
- **Timeline Stacking:** The crop stage timeline collapses into simplified icons on smaller screens to preserve horizontal space.

---

## 9. Performance & Scalability

### Memoization Strategies
Vite compiles changes and handles assets efficiently, but client-side React rendering requires careful management:
- Calendar grids memoize task groups:
  ```ts
  const dateGroups = useMemo(() => groupTasksByDate(tasks), [tasks])
  ```
  This avoids rebuilding date indexes on every cursor hover or selection change.
- Derived properties (overdue tasks, upcoming weekly tasks) are memoized to prevent re-calculations during state changes.

### Database Query Optimization
IndexedDB queries can become slow if they scan full tables. AgroGPT uses Indexed keys to keep lookups efficient:
- `crop_stages` lookup queries use `plan_id` indexes.
- `farm_tasks` query bounds are indexed on `plan_id` and `effective_date`.
- Soft-deleted rows are excluded during queries, keeping memory operations limited to active records.

### AI Integration Extensibility
By isolating planning logic within databases and repositories rather than coupling it to the UI, the system is prepared for future AI agent features:
- Agents can read soil NPK metrics from local profiles to suggest custom tasks.
- Agents can insert tasks with origin `'ai_generated'` directly into the `farm_tasks` table. The sync engine will automatically propagate these items to the cloud.

---

## 10. Final Implementation Status

### Completed Features
- **Offline-First Storage:** Dexie database schemas (Version 2) are fully implemented.
- **Bidirectional Sync:** Sync logic handles conflicts by version checking and timestamps.
- **Farming Engines:** Crop template compilation and weather delay adjustments are functional.
- **UX Redesign:** Stacking cards, scroll containers, and shared UI primitives are fully implemented.
- **Supabase Migration:** Relational SQL tables, keys, and RLS policies are deployed.

### Removed Legacy Systems
- Removed raw Supabase queries within page components.
- Deleted `planningLogic.ts` and `WeatherImpactBanner.tsx`.
- Replaced the legacy online calendar widget with a local-first interface.

### Known Limitations
- **Offline Geolocation:** Requires coordinates to be cached or defaults to Central India coordinates if GPS is unavailable.
- **Browser Storage Limits:** High scan histories with base64 image data could exceed mobile browser storage quotas over time.

### Future Roadmap
- **Image Compression:** Compress base64 images before saving them to Dexie.
- **Mandi Price Sync:** Connect the Market page to live APMC feeds instead of mock rates.
- **WebAuthn Integration:** Wire biometric toggles to actual device authentication APIs.
- **Scan History Panel:** Build a history sidebar in Field Vision to view saved records.
