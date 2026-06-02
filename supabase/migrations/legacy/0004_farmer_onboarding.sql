-- Supabase schema migration for Farmer Onboarding and Profile Setup

-- Alter profiles table to add onboarding fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS farm_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS farm_area_value NUMERIC;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS farm_area_unit TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS farm_area_acres NUMERIC;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS soil_type TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS irrigation_sources TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS village TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_label TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_crop_plan_id UUID;

-- Alter crop_plans table to add onboarding specific crop columns
ALTER TABLE crop_plans ADD COLUMN IF NOT EXISTS crop_area_value NUMERIC;
ALTER TABLE crop_plans ADD COLUMN IF NOT EXISTS crop_area_unit TEXT;
ALTER TABLE crop_plans ADD COLUMN IF NOT EXISTS crop_area_acres NUMERIC;
ALTER TABLE crop_plans ADD COLUMN IF NOT EXISTS farmer_selected_stage TEXT;
ALTER TABLE crop_plans ADD COLUMN IF NOT EXISTS crop_condition TEXT;
ALTER TABLE crop_plans ADD COLUMN IF NOT EXISTS created_by_onboarding BOOLEAN DEFAULT FALSE;
