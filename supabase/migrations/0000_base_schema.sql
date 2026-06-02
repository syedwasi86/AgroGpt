-- 0000_base_schema.sql
-- Base schema definition for AgroGPT database

-- PHASE 0 — PRE-MIGRATION SAFETY: Backup existing public tables if they exist
DO $$
BEGIN
  -- Backup crops if exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crops') THEN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'backup_crops') THEN
      EXECUTE 'CREATE TABLE public.backup_crops AS SELECT * FROM public.crops';
    END IF;
  END IF;

  -- Backup transactions if exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'transactions') THEN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'backup_transactions') THEN
      EXECUTE 'CREATE TABLE public.backup_transactions AS SELECT * FROM public.transactions';
    END IF;
  END IF;

  -- Backup scans if exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'scans') THEN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'backup_scans') THEN
      EXECUTE 'CREATE TABLE public.backup_scans AS SELECT * FROM public.scans';
    END IF;
  END IF;

  -- Backup ai_queries if exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_queries') THEN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'backup_ai_queries') THEN
      EXECUTE 'CREATE TABLE public.backup_ai_queries AS SELECT * FROM public.ai_queries';
    END IF;
  END IF;

  -- Backup crop_plans if exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crop_plans') THEN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'backup_crop_plans') THEN
      EXECUTE 'CREATE TABLE public.backup_crop_plans AS SELECT * FROM public.crop_plans';
    END if;
  END IF;
END
$$;

-- Drop legacy tables to prevent conflicts during fresh deployments
DROP TABLE IF EXISTS public.crops CASCADE;
DROP TABLE IF EXISTS public.crop_cycles CASCADE;
DROP TABLE IF EXISTS public.daily_tasks CASCADE;
DROP TABLE IF EXISTS public.soil_reports CASCADE;
DROP TABLE IF EXISTS public.crop_requirements CASCADE;
DROP TABLE IF EXISTS public.storage_stock CASCADE;
DROP TABLE IF EXISTS public.financial_ledger CASCADE;
DROP TABLE IF EXISTS public.mandi_rates CASCADE;

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_user_id UUID UNIQUE,
  name TEXT, -- codebase compatibility
  display_name TEXT, -- onboarding compatibility
  email TEXT, -- onboarding compatibility
  phone TEXT,
  city TEXT,
  soil_type TEXT,
  primary_crop TEXT,
  total_acreage NUMERIC,
  nitrogen NUMERIC,
  phosphorus NUMERIC,
  potassium NUMERIC,
  preferred_language TEXT,
  farm_name TEXT,
  farm_area_value NUMERIC,
  farm_area_unit TEXT,
  farm_area_acres NUMERIC CHECK (farm_area_acres > 0),
  irrigation_sources TEXT[],
  village TEXT,
  district TEXT,
  state TEXT,
  latitude NUMERIC CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC CHECK (longitude BETWEEN -180 AND 180),
  location_label TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  profile_completed_at TIMESTAMP WITH TIME ZONE,
  active_crop_plan_id UUID, -- circular reference resolved in 0001
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  sync_status TEXT DEFAULT 'synced',
  deleted_at TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE
);

-- Create user_settings table (Removed: language)
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  theme TEXT,
  notifications_enabled BOOLEAN DEFAULT FALSE,
  biometric_enabled BOOLEAN DEFAULT FALSE,
  font_size TEXT DEFAULT 'medium',
  last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  voice_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scans table (without plan_id initially)
CREATE TABLE IF NOT EXISTS public.scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  crop_type TEXT NOT NULL,
  image_url TEXT NOT NULL,
  prediction TEXT NOT NULL,
  confidence NUMERIC NOT NULL,
  confidence_score NUMERIC, -- Phase 2 target
  is_low_confidence BOOLEAN DEFAULT FALSE,
  feedback TEXT,
  ai_enhanced BOOLEAN DEFAULT FALSE,
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  sync_status TEXT DEFAULT 'synced',
  deleted_at TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE
);

-- Create transactions table (without plan_id initially)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  note TEXT, -- codebase compatibility
  notes TEXT, -- Phase 2 target
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  sync_status TEXT DEFAULT 'synced',
  deleted_at TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE
);

-- Create ai_queries table (without plan_id initially)
CREATE TABLE IF NOT EXISTS public.ai_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  question TEXT, -- codebase compatibility
  query TEXT, -- Phase 2 target
  context JSONB,
  answer TEXT, -- codebase compatibility
  response TEXT, -- Phase 2 target
  status TEXT DEFAULT 'pending',
  query_type TEXT, -- Phase 2 target
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  version INTEGER DEFAULT 1,
  sync_status TEXT DEFAULT 'synced',
  deleted_at TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE
);

-- Create mandi_rates table (PHASE 11 — Reference data, no sync, no user columns)
CREATE TABLE IF NOT EXISTS public.mandi_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_name TEXT NOT NULL,
  market_name TEXT NOT NULL,
  district TEXT,
  state TEXT NOT NULL,
  price_min NUMERIC NOT NULL,
  price_max NUMERIC NOT NULL,
  price_modal NUMERIC NOT NULL,
  rate_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure existing profiles table has all required columns (for systems where profiles exists already)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS soil_type TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_crop TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_acreage NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nitrogen NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phosphorus NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS potassium NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS farm_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS farm_area_value NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS farm_area_unit TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS farm_area_acres NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS irrigation_sources TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS village TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_label TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_crop_plan_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- Ensure existing user_settings table has all required columns and drop legacy language column
ALTER TABLE public.user_settings DROP COLUMN IF EXISTS language;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS theme TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS biometric_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS font_size TEXT DEFAULT 'medium';
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS voice_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure existing scans table has all required columns
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS crop_type TEXT;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS prediction TEXT;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS confidence NUMERIC;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS confidence_score NUMERIC;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS is_low_confidence BOOLEAN DEFAULT FALSE;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS feedback TEXT;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS ai_enhanced BOOLEAN DEFAULT FALSE;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- Ensure existing transactions table has all required columns
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS transaction_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- Ensure existing ai_queries table has all required columns
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS question TEXT;
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS query TEXT;
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS context JSONB;
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS answer TEXT;
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS response TEXT;
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS query_type TEXT;
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.ai_queries ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;
