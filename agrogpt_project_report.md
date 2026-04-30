# AgroGPT — Comprehensive Project Report

## 1. Project Overview

**AgroGPT** is an offline-first, AI-powered agriculture management Progressive Web App (PWA) designed primarily for smallholder farmers in India (Telangana / Andhra Pradesh region, with Hyderabad as the default locale). The application is built to work without continuous internet connectivity, with a local-first data model and optional cloud sync via Supabase.

The app targets farmers who need:
- Crop disease detection via camera
- Intelligent irrigation and fertilizer calculations
- Financial tracking (income/expense ledger)
- Market guidance and post-harvest planning
- A conversational AI assistant for farm queries

---

## 2. Tech Stack

### Frontend Core
| Layer | Technology |
|---|---|
| Framework | **React 19** (with TypeScript 5.9) |
| Build Tool | **Vite 8** |
| Language | **TypeScript** |
| Routing | **React Router DOM v7** |

### Styling
| Layer | Technology |
|---|---|
| CSS Framework | **TailwindCSS v3** (with Tailwind Merge + clsx) |
| Design System | Custom glassmorphism dark-theme tokens |

### Data & Storage
| Layer | Technology |
|---|---|
| Local DB | **Dexie.js v4** (IndexedDB wrapper) — offline-first |
| Cloud DB/Auth | **Supabase** (@supabase/supabase-js v2) |
| Sync | Custom bidirectional push/pull sync engine (`syncEngine.ts`) |

### AI / ML
| Layer | Technology |
|---|---|
| On-device ML | **TensorFlow.js v4** (`@tensorflow/tfjs`) — stub-loaded |
| Cloud AI | **Gemini 1.5 Flash** (via Google AI SDK / API) |
| Pattern | **Hybrid RAG**: Live Gemini (online) or Keyword Mock + Offline Queue (offline) |

### Maps & GIS
| Layer | Technology |
|---|---|
| Map Library | **Leaflet** + **React-Leaflet v5** |
| Tile Provider | OpenStreetMap (free, no API key) |
| Geocoding | Nominatim (OpenStreetMap reverse geocoding) |
| Weather | **Open-Meteo API** (free, no API key needed) |

### PWA & Offline
| Layer | Technology |
|---|---|
| PWA Plugin | **vite-plugin-pwa v1** |
| Service Worker | **Workbox** (CacheFirst for TFJS models) |
| Strategy | App shell + offline IndexedDB data |

### Internationalization
| Layer | Technology |
|---|---|
| i18n | **i18next** + **react-i18next** |
| Languages supported | 13 languages: English, Hindi, Telugu, Tamil, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Urdu, Odia, Assamese |

### Charts
| Layer | Technology |
|---|---|
| Charts | **Recharts v3** (LineChart for Ledger profit projection) |

### Icons
| Library | **Lucide React v1** |
|---|---|

---

## 3. Feature Inventory

### 3.1 Authentication (`/auth`)
**Status: 🟡 Partially Real**

| Sub-feature | Status |
|---|---|
| Google OAuth (Supabase) | ✅ Real — calls `supabase.auth.signInWithOAuth` |
| Phone + OTP login (Supabase) | ✅ Real — sends SMS OTP via Supabase, verifies with `verifyOtp` |
| Dev-mode bypass button | ✅ Real (dev-only) |
| Post-login profile auto-fill | ✅ Real — reads Google/phone metadata |
| Biometric login toggle in Settings | ❌ **Dummy** — toggle stored but no WebAuthn implementation |

---

### 3.2 Dashboard (`/dashboard`)
**Status: 🟡 Mix of Real + Hardcoded**

| Sub-feature | Status |
|---|---|
| GPS-based city auto-detection | ✅ Real — uses browser geolocation + Nominatim |
| Soil profile from city | ✅ Real — rule-based lookup (limited Telugu cities) |
| Live weather (temp, humidity, wind) | ✅ Real — calls Open-Meteo API |
| ET₀-based irrigation formula | ✅ Real — Hargreaves formula in `formulas.ts` |
| Stage-based NPK fertilizer formula | ✅ Real — table-based in `formulas.ts`, crops from IndexedDB |
| OpenStreetMap field overview | ✅ Real — Leaflet map, lazy-loaded |
| Soil health widget (N/P/K bars) | ❌ **Hardcoded** — fixed values: N=48, P=22, K=36 |
| Pest risk widget (Thrips/Bollworm) | ❌ **Hardcoded** — static descriptive text, no real algorithm |
| AI suggestion text | ❌ **Hardcoded** — static translation string in i18n |
| Heat index chip | ❌ **Hardcoded** — always shows "Moderate" |

---

### 3.3 Field Vision (`/field-vision`)
**Status: 🔴 Mostly Dummy / Mock**

| Sub-feature | Status |
|---|---|
| Image upload from file/camera | ✅ Real — uses `<input type="file" accept="image/*">` |
| Image preview display | ✅ Real |
| Scan animation (pulse + scan line) | ✅ Real (visual only) |
| AI disease/pest/deficiency analysis | ❌ **MOCK** — `setTimeout(3000)` then picks a *random* result from 3 hardcoded outcomes |
| Confidence score display | ❌ **Mock** — random hardcoded value (88%, 92%, 98%) |
| Remedial action text | ❌ **Hardcoded** — 3 preset strings |
| Real ML model inference | ❌ **Not implemented** — `@tensorflow/tfjs` imported but no model loaded |
| Image persistence to IndexedDB | ❌ **Not connected** — `addScan()` exists in repository but `FieldVisionPage` never calls it |
| Scan history panel | ❌ **Not implemented** — repository has `getRecentScans()` but page doesn't use it |
| Camera mode toggle (Disease/Soil/AR) | ❌ **Not implemented** — i18n keys exist but page currently only does file-upload |

---

### 3.4 Precision Planning (`/precision-planning`)
**Status: 🟡 Real logic, but simplified heuristics**

| Sub-feature | Status |
|---|---|
| Soil type selector (Clay/Sandy/Loam) | ✅ Real UI |
| Water availability selector | ✅ Real UI |
| Current crop dropdown (6 crops) | ✅ Real UI |
| Crop rotation recommendation | ✅ Real — heuristic logic in `planningLogic.ts` (5 scenarios hardcoded) |
| Fertilizer strategy text | ✅ Real — tied to heuristic |
| Rationale explanation | ✅ Real — tied to heuristic |
| Recent planning history (session-only) | ✅ Real — in-memory, persists during session |
| Volume calculator toggle | ✅ Real — simple acres × 220L / acres × 25kg formula |
| Persistence of plans to DB | ❌ **Not implemented** — plans not saved to IndexedDB |
| ML-backed recommendation engine | ❌ **Not implemented** — only 5 hardcoded scenario branches |
| Crop stage awareness | ❌ **Not implemented** — "flowering" is hardcoded in dashboard |

---

### 3.5 Digital Ledger / Khata (`/digital-ledger`)
**Status: ✅ Most Complete Feature**

| Sub-feature | Status |
|---|---|
| Add income / expense transactions | ✅ Real — writes to IndexedDB via Dexie |
| Transaction list with dates | ✅ Real — reads from IndexedDB |
| Delete transactions | ✅ Real |
| Summary: total income, expense, profit | ✅ Real — computed from live DB data |
| Weekly profit line chart (Recharts) | ✅ Real — buckets actual DB records by week |
| Sync to Supabase | ✅ Real — `syncEngine.ts` pushes/pulls; requires Supabase config |
| Seed sample data on first launch | ✅ Real |
| Legacy localStorage migration | ✅ Real |
| Voice entry ("Diesel 1200 today") | ❌ **Not implemented** — i18n key exists, UI placeholder exists, no speech parser |
| Category auto-detection from voice | ❌ **Not implemented** |
| Multi-currency support | ❌ **Not implemented** — hardcoded INR (₹) |
| Photo receipts attachment | ❌ **Not implemented** |

---

### 3.6 Market & Post-Harvest (`/market`)
**Status: 🔴 Mostly Dummy / Placeholder**

| Sub-feature | Status |
|---|---|
| Next-crop ranking (soil depletion) | ✅ Real — scoring formula in `MarketPostHarvestPage.tsx` (limited to 5 crops) |
| Soil NPK used for ranking | ❌ **Hardcoded** — hardcoded N=48, P=22, K=36 (not from DB or user profile) |
| Harvest quality grading (A/B/C) | ❌ **Hardcoded** — always 62% A, 28% B, 10% C |
| AI grading badge | ❌ **Dummy** — just a label |
| "Plan" button on next-crop cards | ❌ **Dummy** — no navigation action |
| Market price integration | ❌ **Not implemented** — no price feed connected |
| Storage advice / cold chain guidance | ❌ **Not implemented** |
| MSP (Minimum Support Price) data | ❌ **Not implemented** |
| Export/sell planning workflow | ❌ **Not implemented** |

---

### 3.7 AI Assistant Pill (global floating widget)
**Status: 🟡 Partially Real**

| Sub-feature | Status |
|---|---|
| Chat UI (open/close, messages) | ✅ Real |
| Quick chip buttons | ✅ Real — triggers send() |
| Online: checks `VITE_GEMINI_API_KEY` | ✅ Real — Integrated with **Gemini 1.5 Flash** with RAG context |
| Offline fallback (keyword matching) | ✅ Real — `localInference()` covers topic categories |
| Offline Queueing | ✅ Real — Queues questions to Dexie (Version 7) when offline |
| Cloud Sync | ✅ Real — Auto-syncs pending queries when connectivity restored |
| Actual Gemini 1.5 Flash | ✅ Real — Full RAG (Crop, Soil NPK, Weather context) |
| Voice input (Mic button) | ❌ **Not implemented** — toggles `listening` state but no Web Speech API |
| Conversation context per page | ✅ Real — RAG context fetched from local DB |
| Message streaming / typewriter | ❌ **Not implemented** |

---

### 3.8 Profile & Settings
**Status: 🟡 Partially Real**

| Sub-feature | Status |
|---|---|
| Profile form (name, email, phone, crop, soil, city, acreage) | ✅ Real — saves to IndexedDB |
| Auto-populate from Google Auth | ✅ Real |
| Language selector (saves to localStorage) | ✅ Real — persists and changes i18n |
| Notifications toggle | ❌ **Dummy** — stored but no Push Notification/FCM integration |
| Biometric login toggle | ❌ **Dummy** — stored but no WebAuthn/biometric API connected |
| Sync Now button | ✅ Real — calls `syncData()` |
| Logout (clears DB + Supabase session) | ✅ Real |
| Profile photo upload | ❌ **Not implemented** |

---

## 4. Summary: Real vs Dummy Features

| Category | Real / Working | Dummy / Placeholder | Not Implemented |
|---|---|---|---|
| Auth | 4 | 1 | 0 |
| Dashboard | 6 | 4 | 0 |
| Field Vision | 3 | 3 | 4 |
| Precision Planning | 6 | 0 | 3 |
| Digital Ledger | 8 | 0 | 4 |
| Market & Post-Harvest | 1 | 3 | 5 |
| AI Assistant | 8 | 0 | 2 |
| Profile / Settings | 4 | 2 | 1 |
| **Total** | **40** | **13** | **19** |

> **Roughly 40 features work end-to-end, 13 are UI-only placeholders, and 19 more features are designed but not yet built.**

---

## 5. Environment Variables Required (Not in Repo)

The following `.env` variables must be configured for full functionality:
```env
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_GEMINI_API_KEY=<your-google-ai-api-key>
```
Without these, the app runs in **demo/offline mode** (AI uses keyword-matching mock).

---

## 6. TODO List to Complete the Project Entirely

### 🔴 Priority 1 — Core Feature Gaps (High Impact)

- [ ] **Field Vision — Real AI Model**: Replace the `setTimeout` mock with actual TensorFlow.js inference. Train or source a plant disease classification model (e.g., PlantVillage dataset). Load via `tf.loadGraphModel('/models/agro-offline/model.json')`. Store result in IndexedDB via `addScan()`.
- [ ] **Field Vision — Scan History**: Wire up `getRecentScans()` from `repository.ts` to display a history tab/panel in `FieldVisionPage`.
- [ ] **Field Vision — Live Camera Mode**: Implement `getUserMedia` camera stream with the 3 mode tabs (Disease Detection / Soil Analysis / AR Guide) instead of only file-upload.
- [ ] **Field Vision — Save Scans**: Call `addScan({ imageBlob, resultJson })` after each analysis so results persist and sync.
- [ ] **AI Assistant — Voice Input**: Implement Web Speech API (`SpeechRecognition`) behind the Mic button. Toggle `listening` state and pipe transcript into `send()`.
- [x] **AI Assistant — Real Backend**: Integrated **Gemini 1.5 Flash** via API key. Implemented RAG (Retrieval-Augmented Generation) using local farm data (crop, soil, weather).
- [x] **AI Assistant — Offline Queue**: Implemented **Dexie Version 7** with `pending_queries` table. Chat now queues questions when offline and syncs them automatically when back online.

---

### 🟡 Priority 2 — Hardcoded Data → Dynamic Data

- [ ] **Dashboard — Soil NPK from Real Source**: Replace hardcoded N=48/P=22/K=36 with dynamic values from either the user's soil test input (profile form) or a soil API.
- [ ] **Dashboard — Pest Risk Algorithm**: Replace the static Thrips/Bollworm text with a rule-based or ML-based pest risk engine that factors in actual weather (humidity/temperature from Open-Meteo) and crop type.
- [ ] **Dashboard — AI Suggestion**: Make the "AI Suggestion" card call `askAgroGPT()` with the user's active crop, soil, and weather context instead of displaying a hardcoded i18n string.
- [ ] **Market Page — Yield Grading**: Replace hardcoded A=62%/B=28%/C=10% with a real grading algorithm based on user-reported crop quality metrics.
- [ ] **Market Page — NPK from Profile**: Read soil N/P/K from the user's profile/IndexedDB instead of hardcoding them in `MarketPostHarvestPage`.
- [ ] **Market Page — "Plan" Button**: Implement the action when tapping "Plan" on a next-crop card — navigate to Precision Planning page pre-filled with the recommended crop.
- [ ] **Dashboard — Heat Index**: Calculate actual heat index from temperature + humidity (standard formula) instead of always showing "Moderate."

---

### 🟡 Priority 3 — Persistence & Data Completeness

- [ ] **Precision Planning — Save Plans**: Persist recommendation history to IndexedDB (add a `plans` table) so planning history survives app restart.
- [ ] **Precision Planning — More Soil/Water Scenarios**: Expand `planningLogic.ts` beyond 5 hardcoded branches. Add at least Clay+Low, Clay+Medium, Sandy+High, Loam+Low, Loam+High cases.
- [ ] **Precision Planning — Crop Stage**: Allow user to select crop growth stage (vegetative / flowering / fruiting / maturity) and feed it into fertilizer recommendations — `formulas.ts` already supports this.
- [ ] **Geolocation — Soil Coverage**: Expand `getSoilProfile()` in `geolocation.ts` to cover more Indian cities/districts beyond the 8 currently hardcoded.
- [ ] **Profile — Acreage → Dashboard**: Connect `profile.totalAcreage` to the irrigation and fertilizer formula on the Dashboard, instead of falling back to a 2-acre default.

---

### 🟢 Priority 4 — Missing Integrations

- [ ] **Market — Live Price Feed**: Integrate an agri-market price API (e.g., Agmarknet, data.gov.in) to show current mandi prices for common crops.
- [ ] **Market — MSP Data**: Hardcode or fetch CACP MSP values for the season and display them as reference.
- [ ] **Market — Storage & Cold Chain Advice**: Add a static advice section for post-harvest storage per crop type.
- [ ] **Push Notifications**: Implement Firebase Cloud Messaging (FCM) or Web Push API. Wire the "Enable Notifications" toggle in Settings to request permission and subscribe.
- [ ] **Biometric Login**: Implement WebAuthn (`navigator.credentials.create`/`get`) behind the "Enable Biometric Login" toggle.
- [ ] **Digital Ledger — Voice Entry**: Integrate Web Speech API and a simple NLP parser (regex-based: "Diesel 1200 today" → `type=expense, category=Diesel, amount=1200, date=today`) to populate the ledger form.
- [ ] **Profile — Photo Upload**: Add an avatar upload field that stores the image blob in IndexedDB and optionally uploads to Supabase Storage.

---

### 🔵 Priority 5 — PWA & Infrastructure

- [ ] **Supabase Tables**: Create the required Supabase tables: `crops`, `ledger`, `scans` (with `user_id`, `updated_at` columns) and configure RLS policies.
- [ ] **PWA Icons**: Generate actual `pwa-192x192.png` and `pwa-512x512.png` icons (currently referenced in `vite.config.ts` but not present in `/public`).
- [ ] **Env File Setup**: Add a `.env.example` or document the required environment variables in README.
- [ ] **TFJs Model Serving**: Train a plant disease model (or use a pre-trained one), convert to `model.json` format, and place in `/public/models/agro-offline/`.
- [ ] **Error Boundaries**: The `ErrorBoundary.tsx` component exists — wrap all major page routes with it.
- [ ] **Settings — Language Sync**: When language is changed in Settings and saved, apply the change to `i18n.changeLanguage()` immediately (currently only the sidebar selector does this live).
- [ ] **i18n — Expand Non-English Translations**: Hindi, Telugu, etc. only have ~15–20 keys each. Expand to cover all 200+ English keys so the app is fully usable in regional languages.
- [ ] **Testing**: Add unit tests for pure functions (`formulas.ts`, `planningLogic.ts`, `geolocation.ts`) and integration tests for the repository layer.

---

## 7. Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   AgroGPT PWA                       │
│  React 19 + TypeScript + Vite + TailwindCSS         │
│                                                     │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Auth Page │  │  App Shell   │  │ AI Assistant│ │
│  │  (Supabase)│  │  (Sidebar)   │  │  Pill (Chat)│ │
│  └────────────┘  └──────────────┘  └─────────────┘ │
│                                                     │
│  Pages:                                             │
│  ┌──────────┐ ┌────────────┐ ┌─────────────────┐   │
│  │Dashboard │ │FieldVision │ │PrecisionPlanning│   │
│  └──────────┘ └────────────┘ └─────────────────┘   │
│  ┌──────────────┐ ┌───────────────────┐            │
│  │DigitalLedger │ │Market&PostHarvest │            │
│  └──────────────┘ └───────────────────┘            │
│                                                     │
│  ┌──────────────────────────────────────┐           │
│  │         Local-First Data Layer       │           │
│  │  Dexie.js (IndexedDB)                │           │
│  │  Tables: crops, ledger, scans,       │           │
│  │          profiles, settings,         │           │
│  │          weatherCache, offlineMetadata│          │
│  └──────────────────────────────────────┘           │
│           │ Sync Engine (push/pull)                 │
│           ▼                                         │
│  ┌──────────────────────────────────────┐           │
│  │           Supabase (Cloud)           │           │
│  │   Auth · DB · Storage (pest-scans)   │           │
│  └──────────────────────────────────────┘           │
│                                                     │
│  External APIs (no key required):                   │
│  • Open-Meteo (weather)                             │
│  • Nominatim/OSM (reverse geocoding + maps)         │
│                                                     │
│  AI Layer:                                          │
│  • VITE_AI_ENDPOINT → Custom LLM backend            │
│  • TensorFlow.js → On-device model (stub)           │
│  • Keyword mock → dev/offline fallback              │
└─────────────────────────────────────────────────────┘
```
