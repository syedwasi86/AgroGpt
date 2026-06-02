-- 0003_rls.sql
-- Row Level Security and Access Control Policies

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandi_rates ENABLE ROW LEVEL SECURITY;

-- 1. Profiles: User can manage their own profile
DROP POLICY IF EXISTS "Users can manage their own profiles" ON public.profiles;
CREATE POLICY "Users can manage their own profiles" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- 2. User Settings: User can manage settings linked to their profile
DROP POLICY IF EXISTS "Users can manage their own settings" ON public.user_settings;
CREATE POLICY "Users can manage their own settings" ON public.user_settings
  FOR ALL USING (auth.uid() = user_id);

-- 3. Crop Plans: User can manage their own plans
DROP POLICY IF EXISTS "Users can manage their own crop plans" ON public.crop_plans;
CREATE POLICY "Users can manage their own crop plans" ON public.crop_plans
  FOR ALL USING (auth.uid() = user_id);

-- 4. Crop Stages: User can manage stages of plans they own
DROP POLICY IF EXISTS "Users can manage stages through plans" ON public.crop_stages;
CREATE POLICY "Users can manage stages through plans" ON public.crop_stages
  FOR ALL USING (plan_id IN (
    SELECT id FROM public.crop_plans WHERE user_id = auth.uid()
  ));

-- 5. Farm Tasks: User can manage tasks of plans they own
DROP POLICY IF EXISTS "Users can manage tasks through plans" ON public.farm_tasks;
CREATE POLICY "Users can manage tasks through plans" ON public.farm_tasks
  FOR ALL USING (plan_id IN (
    SELECT id FROM public.crop_plans WHERE user_id = auth.uid()
  ));

-- 6. Weather Adjustments: User can manage adjustments of plans they own
DROP POLICY IF EXISTS "Users can manage weather adjustments through plans" ON public.weather_adjustments;
CREATE POLICY "Users can manage weather adjustments through plans" ON public.weather_adjustments
  FOR ALL USING (plan_id IN (
    SELECT id FROM public.crop_plans WHERE user_id = auth.uid()
  ));

-- 7. Scans: User can manage their own scans
DROP POLICY IF EXISTS "Users can manage their own scans" ON public.scans;
CREATE POLICY "Users can manage their own scans" ON public.scans
  FOR ALL USING (auth.uid() = user_id);

-- 8. Transactions: User can manage their own transactions
DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;
CREATE POLICY "Users can manage their own transactions" ON public.transactions
  FOR ALL USING (auth.uid() = user_id);

-- 9. AI Queries: User can manage their own queries
DROP POLICY IF EXISTS "Users can manage their own ai queries" ON public.ai_queries;
CREATE POLICY "Users can manage their own ai queries" ON public.ai_queries
  FOR ALL USING (auth.uid() = user_id);

-- 10. Mandi Rates: Reference data, public read access, no write/sync
DROP POLICY IF EXISTS "Allow public read access to mandi rates" ON public.mandi_rates;
CREATE POLICY "Allow public read access to mandi rates" ON public.mandi_rates
  FOR SELECT USING (true);
