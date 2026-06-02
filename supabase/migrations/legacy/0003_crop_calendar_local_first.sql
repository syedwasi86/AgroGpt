-- Supabase schema migration for Local-First Crop Calendar

CREATE TABLE IF NOT EXISTS crop_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  crop_type TEXT NOT NULL,
  variety TEXT NOT NULL,
  sowing_date DATE NOT NULL,
  area NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  version INT NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS crop_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES crop_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_day INT NOT NULL,
  end_day INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  version INT NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS farm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES crop_plans(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES crop_stages(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  task_date DATE NOT NULL,
  scheduled_date DATE NOT NULL,
  effective_date DATE NOT NULL,
  task_type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  notes TEXT,
  origin TEXT NOT NULL DEFAULT 'template',
  task_template_id TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_interval_days INT,
  version INT NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS weather_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES crop_plans(id) ON DELETE CASCADE,
  task_id UUID REFERENCES farm_tasks(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  original_date DATE NOT NULL,
  adjusted_date DATE NOT NULL,
  weather_data JSONB,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INT NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS and create policies
ALTER TABLE crop_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_adjustments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own crop_plans') THEN
    CREATE POLICY "Users can manage their own crop_plans" ON crop_plans
      FOR ALL USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage stages through plans') THEN
    CREATE POLICY "Users can manage stages through plans" ON crop_stages
      FOR ALL USING (plan_id IN (SELECT id FROM crop_plans WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage tasks through plans') THEN
    CREATE POLICY "Users can manage tasks through plans" ON farm_tasks
      FOR ALL USING (plan_id IN (SELECT id FROM crop_plans WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage weather adjustments through plans') THEN
    CREATE POLICY "Users can manage weather adjustments through plans" ON weather_adjustments
      FOR ALL USING (plan_id IN (SELECT id FROM crop_plans WHERE user_id = auth.uid()));
  END IF;
END
$$;
