# 02 Database and Sync Schema

## Local IndexedDB Schema (Dexie.js)
The local database (`AgroGPT_v2` version 6) strictly defines the offline schemas. Every table utilizes `string` (UUID) primary keys.

- **profiles:** `id` (UUID from auth), `auth_user_id`, `name`, `display_name`, `phone`, `city`, `soil_type`, `primary_crop`, `total_acreage` (number), `nitrogen`, `phosphorus`, `potassium`, `farm_name`, `farm_area_value`, `farm_area_unit`, `farm_area_acres`, `irrigation_sources`, `state`, `district`, `village`, `latitude`, `longitude`, `location_label`, `onboarding_completed` (boolean), `active_crop_plan_id`, `created_at`, `updated_at`, `version` (number), `sync_status`, `deleted_at`, `last_synced_at`.
- **crop_plans:** `id`, `user_id`, `crop_type`, `variety`, `sowing_date`, `crop_area_value`, `crop_area_unit`, `crop_area_acres`, `area`, `status` ('planned' | 'active' | 'completed' | 'failed'), `farmer_reported_stage`, `crop_condition`, `created_by_onboarding`, `created_at`, `updated_at`, `version`, `sync_status`, `deleted_at`.
- **crop_stages:** `id`, `plan_id`, `stage_name`, `name`, `start_date`, `end_date`, `days_from_sowing` (number), `start_day`, `end_day`, `stage_order`, `is_current`, `status` ('upcoming' | 'current' | 'completed'), `version`, `sync_status`, `created_at`, `updated_at`, `deleted_at`.
- **farm_tasks:** `id`, `plan_id`, `stage_id`, `title`, `description`, `task_type` ('irrigation' | 'fertilization' | 'pesticide' | 'weeding' | 'harvesting' | 'inspection' | 'other'), `task_date`, `status` ('pending' | 'completed' | 'overdue' | 'rescheduled'), `priority` ('low' | 'medium' | 'high'), `notes`, `completed_at`, `scheduled_date`, `effective_date`, `origin` ('template' | 'manual' | 'weather_adjustment' | 'ai_generated'), `task_template_id`, `is_recurring` (boolean), `recurrence_interval_days` (number), `version`, `sync_status`, `created_at`, `updated_at`, `deleted_at`.
- **weather_adjustments:** `id`, `plan_id`, `task_id`, `weather_event`, `adjustment_type` ('irrigation_delay' | 'spray_warning' | 'disease_warning' | 'heat_stress'), `recommendation`, `effective_date`, `reason`, `original_date`, `adjusted_date`, `weather_data` (any), `applied_at`, `version`, `sync_status`, `created_at`, `updated_at`, `deleted_at`.
- **transactions:** `id`, `user_id`, `plan_id`, `type` ('income' | 'expense'), `category`, `amount` (number), `note`, `notes`, `transaction_date`, `created_at`, `updated_at`, `version`, `sync_status`, `deleted_at`.
- **scans:** `id`, `user_id`, `plan_id`, `crop_type`, `image_url` (Base64 string), `prediction`, `confidence` (number), `confidence_score`, `is_low_confidence` (boolean), `feedback`, `ai_enhanced` (boolean), `scanned_at`, `created_at`, `updated_at`, `version`, `sync_status`, `deleted_at`.
- **ai_queries:** `id`, `user_id`, `plan_id`, `question`, `query`, `context` (JSON), `answer`, `response`, `status`, `query_type`, `created_at`, `updated_at`, `version`, `sync_status`, `deleted_at`.
- **dashboard_cache:** `key`, `type`, `payload` (unknown), `created_at`, `updated_at`, `expires_at`.
- **user_settings:** `id`, `user_id`, `notifications_enabled`, `font_size`, `theme`, `voice_enabled`, `last_sync`, `created_at`, `updated_at`.

## Cloud Database (Supabase) & RLS Policies
The Supabase PostgreSQL schema precisely mirrors the IndexedDB layout, establishing a 1:1 synchronization pipeline. 

**Row Level Security (RLS) Mechanics:**
Security is aggressively scoped to the authenticated `user_id`. Because operational tables like `crop_stages` and `farm_tasks` do not carry a `user_id` directly, RLS traverses the relational tree up to `crop_plans`.
```sql
CREATE POLICY "Users can update their own farm tasks"
  ON public.farm_tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.crop_plans
      WHERE crop_plans.id = farm_tasks.plan_id
        AND crop_plans.user_id = auth.uid()
    )
  );
```

## Sync Engine Mechanics (`syncEngine.ts`)

The bidirectional synchronization process is divided into rigorous push and pull phases, resolving discrepancies using timestamps and explicit versioning.

### 1. Push Phase (`pushChanges`)
The push engine scans IndexedDB for any records where `sync_status` is `pending` or `pending_delete`.
- **Data Scrubbing:** `cleanRecordData()` strictly casts all stringified dates to ISO 8601 strings, converts numeric fields (e.g., `amount`, `version`) via `Number()`, and replaces empty UUID strings with `null`.
- **Single Active Plan Enforcement:** Before syncing, if multiple `crop_plans` hold an `active` status, the engine forcibly sorts them by `updated_at` (descending) and downgrades all older plans to `completed`.
- **Execution Order:** It pushes `profiles` first to establish root constraints, then iterates through `crop_plans` -> `crop_stages` -> `farm_tasks` to respect PostgreSQL foreign key dependencies.
- **Upsert Batching:** Records are batched and sent via `supabase.from(tableName).upsert(payload)`. Successful records receive a `synced` status locally.

### 2. Pull Phase (`pullUpdates`)
The engine fetches remote records using `.gt('updated_at', lastSync)`.
- **Conflict Resolution (Version-First / Last-Write-Wins):**
  When an incoming cloud record conflicts with a local record, the engine evaluates:
  1. If `remote.version > local.version`, remote wins.
  2. If `remote.version === local.version` AND `remote.updated_at > local.updated_at`, remote wins.
  3. If version attributes are missing, standard Last-Write-Wins (`updated_at` comparison) applies.

### Soft Deletions
Soft deletion is utilized to maintain referential integrity. When a user deletes a record locally, it is marked with `sync_status = 'pending_delete'` and `deleted_at = NOW()`. The push phase upserts this tombstone record to Supabase, propagating the `deleted_at` timestamp globally, and finally scrubs the item from local IndexedDB completely.
