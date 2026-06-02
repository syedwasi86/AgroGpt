-- 0001_crop_planning.sql
-- Crop Calendar Scheduling Schema

-- Create crop_plans table
CREATE TABLE IF NOT EXISTS public.crop_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  crop_type TEXT NOT NULL,
  variety TEXT NOT NULL,
  sowing_date DATE NOT NULL,
  crop_area_value NUMERIC NOT NULL,
  crop_area_unit TEXT NOT NULL,
  crop_area_acres NUMERIC NOT NULL CHECK (crop_area_acres > 0),
  area NUMERIC NOT NULL CHECK (area > 0), -- codebase compatibility
  expected_harvest_date DATE,
  status TEXT NOT NULL CHECK (status IN ('planned', 'active', 'completed', 'failed')),
  farmer_reported_stage TEXT,
  farmer_selected_stage TEXT, -- codebase compatibility
  crop_condition TEXT,
  created_by_onboarding BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INT NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  deleted_at TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE
);

-- Resolve circular reference on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_crop_plan_id UUID;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS fk_profiles_active_crop_plan_id;
ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_active_crop_plan_id
  FOREIGN KEY (active_crop_plan_id) REFERENCES public.crop_plans(id)
  ON DELETE SET NULL;

-- Create crop_stages table
CREATE TABLE IF NOT EXISTS public.crop_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES public.crop_plans(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  name TEXT NOT NULL, -- codebase compatibility
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_from_sowing INTEGER NOT NULL,
  start_day INT NOT NULL, -- codebase compatibility
  end_day INT NOT NULL, -- codebase compatibility
  stage_order INTEGER,
  is_current BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'upcoming', -- codebase compatibility
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INT NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create farm_tasks table
CREATE TABLE IF NOT EXISTS public.farm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES public.crop_plans(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.crop_stages(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL,
  task_date DATE NOT NULL,
  scheduled_date DATE NOT NULL, -- codebase compatibility
  effective_date DATE NOT NULL, -- codebase compatibility
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  notes TEXT,
  origin TEXT NOT NULL DEFAULT 'template',
  task_template_id TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_interval_days INT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INT NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create weather_adjustments table
CREATE TABLE IF NOT EXISTS public.weather_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES public.crop_plans(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.farm_tasks(id) ON DELETE CASCADE, -- codebase compatibility
  weather_event TEXT,
  adjustment_type TEXT NOT NULL,
  reason TEXT NOT NULL, -- codebase compatibility
  original_date DATE NOT NULL, -- codebase compatibility
  adjusted_date DATE NOT NULL, -- codebase compatibility
  weather_data JSONB, -- codebase compatibility
  recommendation TEXT,
  effective_date DATE,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- codebase compatibility
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INT NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Link scans, transactions, and ai_queries to crop_plans
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.crop_plans(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.crop_plans(id) ON DELETE SET NULL;
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.crop_plans(id) ON DELETE SET NULL;
