-- 0002_indexes.sql
-- Index Optimization for AgroGPT DB

-- RLS query optimization indexes
CREATE INDEX IF NOT EXISTS idx_crop_plans_user_id ON public.crop_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_crop_stages_plan_id ON public.crop_stages(plan_id);
CREATE INDEX IF NOT EXISTS idx_farm_tasks_plan_id ON public.farm_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_weather_adjustments_plan_id ON public.weather_adjustments(plan_id);
CREATE INDEX IF NOT EXISTS idx_scans_plan_id ON public.scans(plan_id);
CREATE INDEX IF NOT EXISTS idx_transactions_plan_id ON public.transactions(plan_id);
CREATE INDEX IF NOT EXISTS idx_profiles_active_plan ON public.profiles(active_crop_plan_id);

-- Operational feeds & calculations indexes
CREATE INDEX IF NOT EXISTS idx_farm_tasks_status_date ON public.farm_tasks(status, task_date);
CREATE INDEX IF NOT EXISTS idx_crop_plans_sowing_date ON public.crop_plans(sowing_date);

-- PHASE 12 — Business Rule Enforcement: A farmer can have at most one active crop plan at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_crop_plan 
  ON public.crop_plans (user_id) 
  WHERE (status = 'active' AND deleted_at IS NULL);
