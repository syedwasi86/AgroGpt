# 01 System Architecture

## Architecture Paradigm: Offline-First Philosophy
AgroGPT is engineered with a strict **Offline-First Paradigm**. The entire application logic—from UI state and agronomic calculations to form submissions—runs synchronously against a local IndexedDB store (`Dexie.js`). 

**Network-Independent Operations:**
- All writes (e.g., adding a farm task, creating a crop plan, saving a leaf scan) immediately mutate the local Dexie database without waiting for network acknowledgment. 
- The application never blocks user interaction for API calls, except when querying the live Gemini AI or fetching live weather data. Even then, the system falls back gracefully to a keyword-based mock responder and cached weather payloads.
- Background syncs to the cloud backend (Supabase) happen entirely asynchronously through `syncEngine.ts` when connectivity is restored, ensuring zero data loss and immediate interface responsiveness in rural fields with poor connectivity.

## Technology Stack
- **Frontend Framework:** `React 19.2` powered by `Vite 8.0` for highly optimized bundle delivery and Fast Refresh during development.
- **Local Storage Engine:** `Dexie.js 4.4.2` serving as a promised-based wrapper around the native browser IndexedDB, handling local queries and offline data persistence.
- **Cloud Backend:** `@supabase/supabase-js 2.105` interfacing with a PostgreSQL cloud database for remote synchronization, user authentication, and Row-Level Security (RLS) enforcement.
- **Styling:** `TailwindCSS 3.4` combined with `lucide-react 1.7` for responsive, utility-first UI design and iconography.
- **AI & ML:** `@tensorflow/tfjs 4.22` for potential client-side vision logic, alongside the Google Gemini API (Gemini 2.5 Flash) for cloud-based agronomy orchestration.
- **Localization:** `i18next 25.10` and `react-i18next 16.6` for dynamic runtime language switching (English, Hindi, Telugu).

## Directory Mapping (`/src`)
The repository enforces a strict boundary between UI presentation, domain features, and headless business logic.

```text
/src
├── /ai                  # AI Orchestration Layer
│   ├── geminiRecommendationService.ts # Gemini 2.5 JSON structuring & fallbacks
│   └── provider.ts      # Multi-model router & offline keyword mock fallback
├── /assets              # Static media and iconography
├── /components          # Shared UI primitives (AppShell, AuthProvider, Loaders)
├── /core                # Foundational system modules
│   ├── /api             # Contains syncEngine.ts (Bidirectional sync logic)
│   ├── /auth            # Context providers and Supabase auth wrappers
│   ├── /context         # React context providers (e.g., CropContext)
│   ├── /db              # Deprecated/legacy DB utilities
│   ├── /i18n            # i18next configuration and startup logic
│   └── /utils           # Geolocation, formulas, and tailwind merge (cn.ts)
├── /engine              # Headless Agronomy Engines
│   ├── environmentalRiskEngine.ts # Evaluates weather against crop tolerances
│   ├── recommendationEngine.ts    # Merges severity & risk into actionable tasks
│   └── severityEngine.ts          # Evaluates base crop risk levels
├── /features            # Domain-Specific Modules (Bounded Contexts)
│   ├── /crop-calendar   # Precision planning, schedule generation, templates
│   ├── /dashboard       # Aggregated cache & readiness score repository
│   ├── /digital-khata   # Financial ledger and transaction views
│   ├── /field-vision    # ML leaf scanning and disease predictions
│   ├── /market          # Mandi price views and crop trends
│   ├── /onboarding      # Initial user setup flows
│   └── /settings        # User preferences and farm profile updates
├── /hooks               # Custom React hooks (e.g., useConnectivity)
├── /knowledge-Base      # Offline JSON references for diseases (chili, maize, etc.)
├── /lib                 # Database Initialization & Repositories
│   ├── db.ts            # Dexie database schema and migrations
│   └── repository.ts    # Shared data access objects
├── /locales             # JSON dictionary payloads for i18next
│   ├── /en              # English translations
│   ├── /hi              # Hindi translations
│   └── /te              # Telugu translations
└── /pages               # Top-level routing components (Auth, NotFound)
```
