-- 0005_reconcile_columns.sql
-- Reconcile missing columns on existing tables and configure table privileges

-- 1. Profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS farm_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS farm_area_value NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS farm_area_unit TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS farm_area_acres NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS soil_type TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS irrigation_sources TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS village TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_label TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_crop_plan_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- 2. User Settings
ALTER TABLE public.user_settings DROP COLUMN IF EXISTS language;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS theme TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS biometric_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS font_size TEXT DEFAULT 'medium';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS voice_enabled BOOLEAN DEFAULT FALSE;

-- 3. Scans
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS confidence_score NUMERIC;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- 4. Transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- 5. AI Queries
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS query TEXT;
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS response TEXT;
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS query_type TEXT;
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- 6. Grant Permissions to roles for all schema tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
