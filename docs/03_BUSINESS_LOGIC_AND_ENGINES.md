# 03 Business Logic and Engines

## Agronomy Templates (`cropTemplates.ts`)
The repository contains hyper-specific agronomic parameters tailored for diverse crops. These templates drive the deterministic generation of `crop_stages` and `farm_tasks`.

**Weather Sensitivity Thresholds & Stage Durations:**
- **Cotton** (Lifecycle: 150 days)
  - *Thresholds:* Max Temp: 38°C, Min Temp: 15°C, Wind: 15km/h, Hum: 85%, Rain: 5mm.
  - *Stages:* Germination (20d), Squaring (30d), Flowering (60d), Maturity (40d).
- **Rice** (Lifecycle: 120 days)
  - *Thresholds:* Max Temp: 35°C, Min Temp: 18°C, Wind: 18km/h, Hum: 85%, Rain: 10mm.
  - *Stages:* Nursery (20d), Transplanting (35d), Panicle (35d), Ripening (30d).
- **Maize** (Lifecycle: 110 days)
  - *Thresholds:* Max Temp: 36°C, Min Temp: 10°C, Wind: 20km/h, Hum: 80%, Rain: 5mm.
  - *Stages:* Establishment (15d), Vegetative (30d), Tasseling (30d), Grain Fill (35d).
- **Tomato** (Lifecycle: 130 days)
  - *Thresholds:* Max Temp: 35°C, Min Temp: 12°C, Wind: 15km/h, Hum: 80%, Rain: 4mm.
  - *Stages:* Establishment (15d), Vegetative (25d), Flowering (40d), Ripening (50d).
- **Chilli** (Lifecycle: 140 days)
  - *Thresholds:* Max Temp: 37°C, Min Temp: 15°C, Wind: 16km/h, Hum: 85%, Rain: 5mm.
  - *Stages:* Establishment (20d), Vegetative (25d), Flowering (45d), Ripening (50d).

## Schedule Generator (`scheduleGenerator.ts`)
When a farmer creates a crop plan, the `generateCropSchedule` engine dynamically builds the timeline:
1. **Relative Date Mapping:** The engine iterates through the static `template.tasks` array. For each task, it passes the base `sowingDateNormalized` and the `relativeDay` integer to `addDaysUtc()`, converting the relative offset into an exact UTC timestamp for `effective_date`.
2. **Recurring Task Expansion:** If a task holds `is_recurring: true`, the engine triggers a `while` loop: `while (currentDay <= template.lifecycleDuration)`. It iteratively adds the `recurrence_interval_days` to `currentDay`, stamping out distinct `FarmTaskRecord` instances into the database until the crop lifecycle concludes.

## AI Orchestration (`src/ai/`)
AgroGPT integrates Gemini 2.5 Flash (`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`) to augment deterministic agronomy with contextual ML inference.

**Prompt Batching Strategy:** 
The orchestration layer circumvents rate limits by batching environmental data (Soil Type, NPK, Temp, Humidity, Farmer Severity) alongside a Curated Knowledge Base Context (containing approved chemical/organic treatments) into a single overarching prompt. It strictly forces Gemini to return a predictable JSON payload (`summary`, `urgency`, `priorityActions`, etc.) with `responseMimeType: 'application/json'`.

**Concurrent Request Throttling:** 
To prevent duplicate network hits during component re-renders, `dashboardRepository.ts` maintains an in-flight Promise lock (`let inFlightAIInsightsPromise: Promise<any> | null = null`). If a UI refresh triggers while the AI is computing, it seamlessly returns the active `inFlightAIInsightsPromise`.

## Farm Readiness Score Mathematics
Located in `dashboardRepository.ts`, `calculateFarmReadinessScore()` aggregates a 0-100 baseline metric determining farm health, applying discrete deductions.
**Weighting (Base Points = 100):**
- **Tasks (25%):** Ratio of completed tasks to pending past-due tasks.
- **Soil Health (20%):** Deviations from default NPK baselines. A >0.4 deviation in N, P, or K results in a 5-point deduction each.
- **Irrigation (20%):** Completion ratio of water tasks, minus a 3-point penalty per active weather delay.
- **Pest Risk (15%):** Penalized heavily if recent ML leaf scans indicate disease (up to -8 points for moderate-confidence anomalies).
- **Weather Risk (10%):** Heavy storms deduct 6 points; extreme heat (>38°C) or cold (<10°C) deducts 4 points.
- **Crop Progress (10%):** Penalizes 3 points if elapsed days drastically exceed the current mapped stage duration.
