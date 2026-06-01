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
11. [AI Farm Command Center Dashboard Report](#11-ai-farm-command-center-dashboard-report)
12. [Farmer Onboarding System](#12-farmer-onboarding-system)
13. [Profile Page Architecture](#13-profile-page-architecture)
14. [Future Extensibility](#14-future-extensibility)

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
The client-side database is defined in `src/lib/db.ts` (Database Version 4) with the following structures:

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
- `crop_area_value` (Number - Area of crop cycle as entered by farmer)
- `crop_area_unit` (String - Chosen area unit e.g., Acre, Hectare, Bigha, etc.)
- `crop_area_acres` (Number - Area normalized to acres)
- `farmer_selected_stage` (String - Growth stage declared directly by the farmer)
- `crop_condition` (String - General crop condition state)
- `created_by_onboarding` (Boolean - Flags if this plan was generated during initial onboarding)

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

#### 5. `profiles`
Stores farmer profiles, farm details, location labels, and NPK metrics.
- `id` (Primary Key, String - Supabase User UUID)
- `name` (String - User name)
- `display_name` (String - Farmer greeting name)
- `preferred_language` (String - Chosen language code for UI and AI localization)
- `email` (String - Optional email address)
- `phone` (String - Primary contact number)
- `city` (String - Geolocation-detected city)
- `soil_type` (String - Local soil classification)
- `primary_crop` (String - Main crop type)
- `total_acreage` (Number - Total acreage calculated in acres)
- `nitrogen` / `phosphorus` / `potassium` (Number - Active soil N-P-K nutrient parameters)
- `farm_name` (String - Optional custom farm name)
- `farm_area_value` (Number - Total farm size value)
- `farm_area_unit` (String - Farm size unit e.g., Acre, Hectare, Guntha, Cent, Bigha, Square Meter)
- `farm_area_acres` (Number - Farm size normalized to acres)
- `irrigation_sources` (Array of Strings - Configured water/irrigation sources)
- `state` / `district` / `village` (String - Geocoded or manually input location data)
- `latitude` / `longitude` (Number - Geolocation coordinates)
- `location_label` (String - User-friendly display location)
- `onboarding_completed` (Boolean - Onboarding wizard completion status)
- `profile_completed_at` (String - Onboarding completion UTC timestamp)
- `active_crop_plan_id` (String - Pointer to the active plan in `crop_plans`)
- `sync_status` (String - `'pending' | 'synced' | 'failed'`)
- `version` (Number - Conflict tracking version)
- `created_at` / `updated_at` (ISO strings)

#### 6. `dashboard_cache`
Stores aggregations and transient dashboard calculations.
- `key` (Primary Key, String - Cache identifier)
- `type` (String - `'snapshot' | 'weather' | 'ai-insights' | 'market' | 'farm-status'`)
- `payload` (JSONB Object - Cached data representation)
- `created_at` / `updated_at` (ISO strings)
- `expires_at` (ISO string - Expiration boundary, optional)

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

### Supabase Migration Updates

#### 1. Crop Calendar Core Migration (`0003_crop_calendar_local_first.sql`)
- Creates parallel PostgreSQL tables (`crop_plans`, `crop_stages`, `farm_tasks`, `weather_adjustments`) matching the Dexie schema.
- Uses `UUID PRIMARY KEY DEFAULT gen_random_uuid()` to prevent ID collisions between offline clients.
- Configures cascade deletes (`ON DELETE CASCADE`) to clean up stages, tasks, and adjustments if a plan is removed.
- Enforces user isolation via Row Level Security (RLS) policies:
  ```sql
  CREATE POLICY "Users can manage their own crop_plans" ON crop_plans
    FOR ALL USING (auth.uid() = user_id);
  ```

#### 2. Farmer Onboarding & Profile Schema Migration (`0004_farmer_onboarding.sql`)
- Alters the remote `profiles` table to introduce onboarding and location attributes: `display_name`, `preferred_language`, `farm_name`, `farm_area_value`, `farm_area_unit`, `farm_area_acres`, `soil_type`, `irrigation_sources` (text array), `state`, `district`, `village`, `latitude`, `longitude`, `location_label`, `onboarding_completed`, `profile_completed_at`, and `active_crop_plan_id`.
- Alters the remote `crop_plans` table to add crop-specific metadata: `crop_area_value`, `crop_area_unit`, `crop_area_acres`, `farmer_selected_stage`, `crop_condition`, and `created_by_onboarding`.

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
|    - Estimated Harvest       | - Active Disease Risks       |
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

---

## 11. AI Farm Command Center Dashboard Report

### 1. Feature Overview

#### Purpose of the Farm Command Center
The **AI Farm Command Center Dashboard** is designed to provide farmers with a unified, high-level operational cockpit for their cultivation cycles. In typical farming apps, users are overwhelmed by detailed list grids and spreadsheets. The AgroGPT Command Center provides instant clarity on farm status in under 10 seconds.

#### Difference between Dashboard and Precision Planning
The dashboard does **NOT** replace the detailed worksheets:
- **The Dashboard:** Exists purely for *situational awareness*, *prioritization*, *high-priority alerts*, and *navigation* into deeper subsystems. It answers the fundamental daily operational questions: "What is happening now?", "What needs immediate action?", and "What tools should I use next?"
- **Precision Planning:** Remains the dedicated workspace containing complete crop lifecycle calendars, task rescheduling engines, detailed milestones list, and manual task updates.

---

### 2. Dashboard Architecture

#### Repository Aggregation Layer (`dashboardRepository.ts`)
The dashboard retrieves data through a centralized repository to prevent database query bloat. Rather than having individual components trigger independent Dexie and weather calls, the repository compiles everything into a single, cohesive **`DashboardSnapshot`** DTO (Data Transfer Object).

#### Dynamic Personalization & Custom Metadata
To deliver a tailored user experience, the dashboard repository dynamically aggregates and surfaces farmer onboarding information:
- **`display_name`**: Populates custom greeting banners (e.g., *"Good Morning, Ramesh"*).
- **`location_label`**: Integrates district and village metadata into weather cards and diagnostic queries, grounding forecasts with spatial relevance.
- **`soil_type`**: Injects soil classification values into the NPK widget to calculate local nutrition targets.
- **`irrigation_sources`**: Displays available farm watering chips, informing irrigation task checklists.
- **`active_crop_plan_id`**: Serves as the key pointer to resolve the active cultivation cycle data.
- **`farmer_selected_stage`**: Priority overlay showing farmer-reported stage annotations (e.g. *"Cotton - Flowering (Farmer Selected)"*).
- **`crop_condition`**: Tracks crop condition status tags directly in the active crop dashboard header.

#### Separation of Concerns
1. **Database Layer (Dexie.js / Supabase):** Handles raw profile, plan, task, transaction, and scan records.
2. **Repository Layer (`dashboardRepository.ts`):** Fetches, filters, calculates readiness, constructs the feed, orchestrates AI requests, and saves/retrieves cache records.
3. **UI Presentational Layer (`DashboardPage.tsx`):** Consumes the unified DTO and styles it using Vercel/Linear visuals.

#### Offline-First Data Flow Diagram

```
                                 +─────────────────────────+
                                 |    DashboardPage.tsx    |
                                 +────────────┬────────────+
                                              │
                                              ▼ (Consumes DashboardSnapshot DTO)
                                 +─────────────────────────+
                                 |  dashboardRepository.ts |
                                 +────────────┬────────────+
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
        +─────────────────────────+  +───────────────────+   +────────────────────+
        |  Dexie.js (IndexedDB)   |  |  Weather Service  |   | AI Orchestrator    |
        |  (Profiles, Crops,      |  |  (Open-Meteo)     |   | (Batched Gemini    |
        |   Tasks, Scans, Tx)     |  +───────────────────+   |  2.5 Flash Call)   |
        +─────────────────────────+                          +──────────┬─────────+
                                                                        │
                                                                        ▼ (Local cache fallbacks)
                                                             +────────────────────+
                                                             |  Local Agronomy    |
                                                             |   Heuristics       |
                                                             +────────────────────+
```

---

### 3. Offline-First Dashboard System

#### Dexie Cache Migration (Database Version 3)
To support robust offline operations, the database configuration in `src/lib/db.ts` was upgraded to Version 3 to declare the `dashboard_cache` table:
```ts
export interface DashboardCacheRecord {
  key: string;
  type: 'snapshot' | 'weather' | 'ai-insights' | 'market' | 'farm-status';
  payload: unknown;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}
```

#### Cache Freshness & Expiration Logic
- **Weather Cache:** Expires exactly 1 hour from creation.
- **Snapshot DTO Cache:** Expires 15 minutes from creation.
- **AI Insights Cache:** Event-driven invalidation. It stores a status fingerprint representing active crop stage, temperature, humidity, rain status, scan ID, and task count. It only updates if these parameters change significantly.

#### Event-Driven Invalidation (Fingerprinting)
To ensure the dashboard displays updated values immediately when a user makes edits in other tabs, the snapshot cache performs fingerprint comparison before returning:
```ts
const fingerprint = {
  activePlanId: activePlan?.id || 'none',
  plansCount,
  taskCount,
  completedCount,
  scansCount,
  txCount
};
```
If a user adds a crop, checks a task, or uploads a leaf scan, the fingerprint fails to match, prompting an instant re-aggregation of snapshot data and bypassing the cached entry.

#### Offline Fallback Behaviors
- **Weather:** If offline, queries the last cached forecast under `weather` in Dexie cache, falling back to static Hyderabad parameters.
- **AI Insights:** If offline or the API key is missing, invokes local rules that map current growth stage and weather adjustments into styled daily advice, storing it in the cache under `ai-insights`.

---

### 4. Farm Readiness Engine

The primary dashboard KPI is the **Farm Readiness Score (0-100)**, which gauges overall crop safety and operational efficiency:

$$\text{Readiness Score} = \text{Tasks (25\%)} + \text{Soil (20\%)} + \text{Irrigation (20\%)} + \text{Pest (15\%)} + \text{Weather (10\%)} + \text{Progress (10\%)}$$

#### Metric Weighting Models
1. **Task Status (25%):** Percentage of completed tasks with effective date <= today.
2. **Soil Health (20%):** Measures presence of nitrogen, phosphorus, and potassium in user profiles relative to soil type standard baselines.
3. **Irrigation Readiness (20%):** Ratio of completed irrigation tasks. Deducts points for unresolved weather adjustment delays.
4. **Pest Risk (15%):** Starts at 15 points. Deducts points for positive leaf disease detections in recent scans and high risk weather codes.
5. **Weather Risk (10%):** Assesses forecast risks (deducts 6 points for heavy rain/storms, 4 points for heat stress >38°C).
6. **Crop Progress Health (10%):** Evaluates if the stage timeline matches sowing date (stagnation warning) and counts overdue high-priority tasks.

#### Readiness Categories
- **Excellent (90-100):** High task completion, balanced soil profile, no active pest risks.
- **Good (70-89):** Normal operational state. Minor pending tasks.
- **Attention Needed (50-69):** Overdue tasks or favorable weather disease risks detected.
- **Critical (<50):** Highly delayed operations, severe diagnosed crop infection, or extreme storms.

---

### 5. AI Orchestration Layer

#### Single Gemini Request Strategy
Calling Gemini API on every dashboard element or chip is extremely expensive and causes lag. AgroGPT batches all dashboard AI prompts into a **single orchestrated request** to the Gemini 2.5 Flash model:
- The system prompt compiles the complete snapshot status.
- Gemini returns a single unified JSON payload containing the `dailyInsight` and the answers to the 4 quick prompt chips.
- The 4 quick prompts (*What should I do today?*, *Water requirement?*, *Pest risk?*, *Fertilizer advice?*) simply reveal these cached answers instantly without making new network requests.

#### Deterministic Offline Advisory
When offline, a rules engine maps templates into structured guides:
- **Cotton Squaring Stage:** Warns of thrips vector risks, recommends installing yellow sticky cards.
- **High Humidity Code:** Warns of fungal blights, advises delay of unnecessary watering and prophylactic organic spraying.

---

### 6. Dashboard UI / UX Design

The interface is styled like a premium software command center (Vercel/Linear), using large spacing, fewer borders, organic typography hierarchy, and glowing statuses.

#### Layout ASCII Diagram
```
+─────────────────────────────────────────────────────────────────────────────────+
| 1. Telemetry Status Header (Online/Offline glowing indicator, manual Sync)      |
+─────────────────────────────────────────────────────────────────────────────────+
| 2. Hero Command Center                                                          |
|    - Greeting & Active Stage Info   |  - Farm Readiness Score circular SVG ring|
|    - acreage, location, soil        |  - AI Daily Insight text summary card     |
+─────────────────────────────────────────────────────────────────────────────────+
| 3. Farm Snapshot Grid (5 Cards: Active Crop, Soil, Water, Pest, Operational)   |
+─────────────────────────────────────────────────────────────────────────────────+
| 4. Today's Focus operations feed (Prioritized vertical card feed, max 5 items)  |
+─────────────────────────────────────────────────────────────────────────────────+
| 5. Farm Map Overview (Lazy-loaded, IntersectionObserver mount)                  |
+─────────────────────────────────────────────────────────────────────────────────+
| 6. AI Action Center                 | 7. Farm Intelligence Grid                 |
|    - Quick chips with local reveals |    - Weather Intelligence card            |
|    - Ask AgroGPT bar                |    - Irrigation Analysis card             |
|    - Inline Answer box              |    - Pest & Mandi Signal cards            |
+─────────────────────────────────────────────────────────────────────────────────+
| 8. Explore AgroGPT Gateway (Crop Calendar, Field Vision, Market, Digital Khata) |
+─────────────────────────────────────────────────────────────────────────────────+
```

#### Dashboard UI Sections & Interactions
1. **Status Header:** Displays online/offline indicators and a manual reload refresh action.
2. **Hero Command Center:** Renders a circular SVG ring showing the readiness score and displays the overarching AI daily suggestion.
3. **Farm Snapshot Grid:** Provides 5 high-level summary cards (Active Crop, Soil Health, Water, Pest Risk, Operations). Clicking Operations navigates to `/crop-calendar`.
4. **Today's Focus Feed:** Shows a vertical feed of up to 5 prioritized cards. Clicking them navigates directly to the corresponding module.
5. **Farm Map Overview:** Displays Leaflet maps with custom coordinates. Lazy-loaded via Scroll observer.
6. **AI Action Center:** Displays chips that reveal advice inline, and a local ask form that queues questions if offline.
7. **Farm Intelligence Grid:** Interprets Open-Meteo weather codes agronomically, provides soil moisture and next crop recommendations.
8. **Explore AgroGPT Gateway:** Displays gateway cards linking to core features.

---

### 7. Operational Intelligence Feed

The **Focus Operations Feed** ranks tasks and alerts dynamically using an operational priority queue rather than standard calendars:

1. **Overdue Critical Tasks:** Unfinished tasks with `priority === 'high'` due before today.
2. **Weather Adjusted Tasks:** Tasks delayed by weather adjustments.
3. **Pest Risk Alerts:** Recent active infections from Field Vision scans.
4. **Due Today Tasks:** Standard tasks scheduled for today.
5. **Upcoming transitions:** Development stage transitions starting in next 3 days.

This ensures the farmer is focused on risk mitigation and urgent operations first.

---

### 8. Explore AgroGPT Gateway

The gateway cards are designed to communicate immediate system values:
- **Crop Calendar:** Shows pending tasks count and current stage.
- **Field Vision:** Shows last scan diagnosis and AI confidence %.
- **Market & Mandi:** Recommends next crop based on NPK depletion and displays current Mandi pricing trends.
- **Digital Ledger:** Shows current net profit and monthly cash flow changes.

---

### 9. Performance & Scalability

#### Optimizations
- **Lazy Loading & IntersectionObserver:** Leaflet code and CSS are lazy-loaded. The map component only mounts when the user scrolls near it (offset 100px), preventing high initialization load.
- **Cache-First rendering:** Renders UI instant-on using the local cache, then updates once the fingerprint check finishes.
- **ndvi / Drone Metrics Placeholders:** Database and repositories are pre-designed with empty metrics and structures for satellite NDVI, drone imagery overlays, and disease forecasts, allowing easy scale-up without database structural rewrites.

---

### 10. Final Implementation Status

#### Completed Features
- **Dexie Version 4 Upgrade:** Strongly-typed schema containing onboarding, profile, and `dashboard_cache` tables.
- **Readiness Scoring Engine:** Computes dynamic readiness score out of 100 points based on tasks, soil NPK, weather, and pest statuses.
- **Event-Driven Cache Invalidation:** Keeps dashboard synchronized with changes in all other modules.
- **AI Orchestration & Chips:** Pre-fetches prompt advice in a single Gemini request and reveals them locally.
- **Sleek UX Layout:** Clean Linear/Vercel styling, lazy map loading, and responsive gateway metrics.

#### Known Limitations
- **Offline Weather Forecasts:** Cannot pull new forecasts if offline; relies on 1-hour cache.
- **Scan Image Size:** Base64 scanner data takes considerable IndexedDB space, which could trigger cleanup requirements.

---

## 12. Farmer Onboarding System

### Purpose of Onboarding
The **Farmer Onboarding System** in AgroGPT is built to collect key farmer, farm, and crop configuration metadata during first-time execution. Collecting this information allows the system to initialize custom crop calendar schedules, localize weather recommendations, personalize dashboard notifications, and set baseline parameters for AI diagnostics. 

The onboarding system is designed with four fundamental principles:
1. **Farmer-Friendly UI:** Uses simple language, large layouts, and intuitive visuals.
2. **Mobile-First UX:** Tailored for small mobile screens with large touch targets.
3. **Offline-First Resilience:** Zero reliance on remote network calls. Every wizard step is operational offline.
4. **Low-Literacy Friendly:** Minimizes text input, relying on single-tap option grids, visual icons, and automated defaults.

### Onboarding Flow Sequence
The onboarding wizard guides farmers through a 12-step structured progression:

```
    [ Login ]
        │
        ▼
[ Language Selection ] ──► Stores preferred_language (en, hi, te)
        │
        ▼
  [ Farmer Name ]      ──► Stores display_name
        │
        ▼
 [ Farm Location ]     ──► Captures latitude, longitude, state, district, village, location_label
        │
        ▼
[ Farm Name (Opt) ]    ──► Stores farm_name
        │
        ▼
   [ Farm Size ]       ──► Captures farm_area_value, unit (Acre, Hectare, Guntha, etc.)
        │
        ▼
   [ Soil Type ]       ──► Selects soil_type (Black, Red, Clayey, Sandy, Alluvial)
        │
        ▼
  [ Water Source ]     ──► Selects irrigation_sources (Borewell, Canal, Rainfed, Open Well)
        │
        ▼
[ Profile Completion ] ──► Writes profiles table; sets onboarding_completed = true
        │
        ▼
 [ First Crop Setup ]  ──► Steps 8-12: Captures crop_type, variety, sowing_date, stage, condition
        │
        ▼
   [ Dashboard ]       ──► Resolves active_crop_plan_id; displays custom operational cockpit
```

### Detailed Wizard Step Operations

#### 1. Language Selection
- **Question:** Selected language option buttons (English, हिन्दी, తెలుగు).
- **Stored Field:** `preferred_language`
- **Behavior:** Triggers active i18next language switches immediately. Ensures all subsequent steps, local calendar instructions, and system warnings are rendered in the chosen language.

#### 2. Farmer Name
- **Question:** *"What should we call you?"*
- **Stored Field:** `display_name`
- **Behavior:** Greets the farmer on the main dashboard Command Center and sets up future conversational notifications. (e.g., *"Good Morning, Ramesh"*).

#### 3. Farm Location
- **Stored Fields:** `state`, `district`, `village`, `latitude`, `longitude`, `location_label`
- **Behavior:** Geolocation coordinate gathering acts as the primary agronomical source of truth. The user can fetch location using their device's GPS chip. Reverse geocoding is performed in the background if online. If offline, the geocoder fails gracefully without blocking the wizard, and the farmer can enter state, district, and village details manually.

#### 4. Farm Details
- **Stored Fields:** `farm_name` (optional), `farm_area_value`, `farm_area_unit`, `farm_area_acres`, `soil_type`, `irrigation_sources`
- **Behavior:** 
  - **Farm Size Conversion:** The wizard preserves the farmer's preferred regional unit (`farm_area_value`, `farm_area_unit`). AgroGPT translates the input into a normalized acreage value (`farm_area_acres`) for system calculations using standard conversion constants:
    - **Acre:** 1.0
    - **Hectare:** 2.471
    - **Guntha:** 0.025
    - **Cent:** 0.01
    - **Bigha:** 0.62
    - **Square Meter:** 0.000247
  - **Soil Type Selection:** Enforces selection of Black Soil, Red Soil, Clayey Soil, Sandy Soil, or Alluvial Soil. Informs baseline NPK profiles and water retention parameters.
  - **Water Sources Selection:** Captures available irrigation methods (Borewell, Canal, Rainfed, Open Well) to guide agricultural task templates (such as irrigation delay triggers).

#### 5. Profile Completion Status
- **Stored Fields:** `onboarding_completed = true`, `profile_completed_at = timestamp`
- **Behavior:** Upon completing Step 7, a local transaction writes the profile configuration record to Dexie. Completing onboarding triggers state updates to block redirect loops.

#### 6. First Crop Setup (Steps 8-12)
- **Stored Fields:** `crop_type`, `variety` (variety input), `crop_area_value`, `crop_area_unit`, `crop_area_acres`, `sowing_date`, `farmer_selected_stage`, `crop_condition`, `created_by_onboarding = true`
- **Behavior:** Initializes the first cultivation cycle. The crop area is validated to ensure it does not exceed the total farm area.

#### 7. Farmer Selected Stage vs. Calculated Stage
AgroGPT manages two concurrent representations of crop development stages:
1. **Calculated Stage (`calculatedStage`):** Computed dynamically based on the sowing date and standard template crop stage duration boundaries.
2. **Farmer Selected Stage (`farmer_selected_stage`):** Inputted directly by the farmer.
- **UI Logic:** The dashboard and Precision Planning pages prioritize the farmer's reporting to build user trust:
  ```ts
  displayStage = farmer_selected_stage ?? calculatedStage
  ```
  If `farmer_selected_stage` is active, it is rendered on screen with a `(Farmer Selected)` suffix. Internally, the calculated stage is retained to evaluate weather warning sensitivities and diagnostic check boundaries.

#### 8. Crop Condition Assessment
- **Values:** Healthy, Average, Not Growing Well, Pest/Disease Problem, Not Sure.
- **Stored Field:** `crop_condition`
- **Behavior:** Set in Step 12. Contextualizes the initial risk scores on the dashboard, prioritizes calendar guidelines, and adjusts AI diagnostic sensitivity.

#### 9. Active Crop Plan Tracking
- **Stored Field:** `active_crop_plan_id` in the `profiles` table.
- **Behavior:** Points to the main crop schedule rendered on the dashboard operations panel. The first plan created in the onboarding wizard automatically populates this ID.

### Onboarding Offline-First Architecture
The onboarding wizard uses local-first transactions. There are no blocking network calls.
```
 [ User Input ] ──► [ Local Write to Dexie ] ──► [ Reactive UI Update ] 
                                                          │
                                                          ▼
                                              [ sync_status = 'pending' ]
                                                          │
                                                          ▼
                                              [ Background Sync Manager ]
                                                          │
                                                          ▼
                                               [ Supabase Cloud Sync ]
```
Every form submission writes to Dexie immediately. If online, the sync engine fires background push sequences to Supabase; if offline, data remains cached in Dexie until connectivity is restored.

---

## 13. Profile Page Architecture

### Farmer Identity & Farm Information Hub
The **Profile Page** (`ProfilePage.tsx`) acts as the farmer's central identity, farm profile, and current crop cockpit. Rather than split settings across multiple screens, the page gathers all operational parameters in a unified view, styled as an 8-card interactive command center.

### The 8-Card Profile Layout
1. **Farmer Information:** Renders profile details (`display_name`, `preferred_language`, `email`, `phone`).
2. **Farm Location:** Displays localized labels (`village`, `district`, `state`), coordinates (`latitude`, `longitude`), and a "Fetch Location" GPS override tool.
3. **Farm Details:** Renders total farm size (preserved original unit alongside normalized acreage) and the active `soil_type`.
4. **Water Sources:** Displays active irrigation methods as responsive status chips.
5. **Soil Health & NPK Nutrients:** Displays current Nitrogen (N), Phosphorus (P), and Potassium (K) levels in mg/kg. Hosts the soil report auto-extractor button.
6. **Active Crop Summary:** Summarizes the current crop cycle (`crop_type`, `sowing_date`, `displayStage`, and `crop_condition`).
7. **Account Status:** Renders account creation time, `sync_status` (Synced, Pending, Failed), and `last_sync_time`.
8. **Quick Actions:** Responsive buttons linking to inline editing modals (Edit Farmer Info, Edit Location, Edit Farm Details, Edit Water Sources, Edit Active Crop, Edit Soil NPK).

### Profile Editing Workflows
- Editing follows the local-first pattern:
  1. The user opens an edit modal and updates fields (e.g., changing soil type or adding a water source).
  2. Submitting triggers an immediate update to the local Dexie `profiles` table.
  3. The `useLiveQuery` hook detects database changes and triggers an instant UI re-render (latency < 16ms).
  4. The record is flagged with `sync_status = 'pending'` and has its `version` incremented.
  5. The background `syncEngine.ts` automatically pushes updates to Supabase without blocking user navigation.
- If the sowing date or crop type is edited in the Active Crop modal, the calendar engine regenerates the schedule, calculating new milestones while soft-deleting the previous tasks.

### Soil NPK Auto-Extraction OCR Pipeline
To simplify nutrient data input, the profile page includes an automated lab report parsing tool:

```
[ Upload Report (PDF/Image) ]
             │
             ▼
[ PDF Check: If PDF, PDF.js renders Page 1 to Canvas at 2.0 scale ]
             │
             ▼
    [ PNG Data URL output ]
             │
             ▼
[ OCR Processing: Tesseract.js eng text recognition ]
             │
             ▼
    [ Raw extracted text ]
             │
             ▼
[ Regex parsing for N-P-K patterns ]
             │
             ▼
[ Update state & display extraction status (success / partial / failed) ]
```

- **OCR Engine:** Uses `Tesseract.js` for on-device optical character recognition.
- **PDF Parser:** Uses `pdfjs-dist` to convert document files. It accesses the first page, renders the vector text onto a client-side `<canvas>` element at a high-fidelity 2.0 scale, and generates a PNG data URL for Tesseract.
- **Pattern Match Parser:** Evaluates raw OCR text using regular expressions to capture target nutrient counts:
  - **Nitrogen:** `/(?:Nitrogen|N)[:\s]+(\d+(?:\.\d+)?)/i`
  - **Phosphorus:** `/(?:Phosphorus|P)[:\s]+(\d+(?:\.\d+)?)/i`
  - **Potassium:** `/(?:Potassium|K)[:\s]+(\d+(?:\.\d+)?)/i`
- **Fallback Options:** If the OCR fail threshold is triggered (e.g., hand-written reports or low contrast), the app updates its status to `'failed'` and prompts the user to input N-P-K nutrient values manually in the input fields.

---

## 14. Future Extensibility

The onboarding and profile architectures are designed to support future core enhancements:

- **Multi-Farm Support:** The `profiles` schema isolates location and farm size in individual fields. A future upgrade can map profiles to a separate `farms` table with a one-to-many user relationship, without breaking existing dashboard repositories.
- **Multi-Crop Support:** The dashboard utilizes `active_crop_plan_id` to resolve current calendar views. Supporting multiple concurrent crops simply requires mapping `active_crop_plan_ids` to an array of pointers, allowing the farmer to toggle between active schedules in the command cockpit.
- **Additional Indian Languages:** The onboarding `preferred_language` field is stored as standard ISO codes (e.g., `'en'`, `'hi'`, `'te'`). New languages (such as Marathi, Kannada, or Bengali) can be introduced by adding localization translation packages, without changing database schemas.
- **Advanced Advisories & Analytics:** On-device soil NPK nutrients allow Gemini models to tailor precise fertilizer recommendation formulas (e.g. urea, DAP, potash dosages).
- **Historical Crop Tracking:** By utilizing soft deletes (`deleted_at`) and status fields in `crop_plans`, the database retains historical data. This lets the system compile multi-season yield reports and soil depletion charts to help farmers plan crop rotations.
