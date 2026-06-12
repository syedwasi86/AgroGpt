# 04 UI and Localization

## UI Primitives
*Note regarding requested components:* A rigorous codebase audit confirms that the specific components `SectionContainer`, `TimelineMarker`, and `AdvisoryRow` **do not exist** anywhere in the current application branch. 

Instead, AgroGPT leverages alternative structural UI primitives:
- **`AppShell`:** Coordinates responsive top-bar layouts for mobile users alongside persistent dual-pane sidebar navigations for desktop resolutions.
- **`GlassCard`:** Supplies the core aesthetic of AgroGPT, utilizing Tailwind's backdrop-blur and semi-transparent RGBA backgrounds to deliver the premium "glassmorphism" interface.
- **`AIAssistantPill`:** A floating responsive action button triggering the contextual Gemini chat modal.

## Dashboard State & Cache Invalidation
The system utilizes a sophisticated event-driven caching mechanism within `dashboardRepository.ts` to neutralize network overhead and mitigate UI tearing.
- **State Fingerprinting:** Whenever `fetchDashboardSnapshot()` fires, the engine computes a synchronous `fingerprint` querying Dexie counts: `activePlanId`, `plansCount`, `taskCount`, `completedCount`, `scansCount`, and `txCount`.
- **Invalidation Strategy:** The code checks this new fingerprint against the cached fingerprint inside `dashboard_cache`. If they match identically, and the 15-minute TTL (`SNAPSHOT_EXPIRY_MS`) has not elapsed, the engine immediately yields the cached `DashboardSnapshot` without running heavy internal calculations, ensuring instant dashboard rendering.

## Localization (i18next)
AgroGPT achieves complete multiregional operation across English (`en`), Hindi (`hi`), and Telugu (`te`) without polluting the primary database layer.
- **Implementation Strategy:** Language payloads are housed natively within `/src/locales/`. The `react-i18next` context intercepts key mapping and dynamically updates the DOM.
- **Database Consistency:** System records (like crop disease conditions `leaf_curl`, `healthy`, or statuses like `pending`) are strictly persisted in English strings within IndexedDB and Supabase. The application specifically utilizes the `useEnumTranslation` hook (and `sanitizeEnumKey()`) to translate these rigid English database identifiers dynamically into Hindi/Telugu at the presentation layer just milliseconds before DOM injection. This strictly prevents localized text from breaking downstream sync engines or agronomic algorithms.
