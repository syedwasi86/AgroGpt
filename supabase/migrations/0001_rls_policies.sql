-- 0001_rls_policies.sql
-- Row-Level Security policies for crop_stages and farm_tasks
-- These tables link to a user via their plan_id -> crop_plans.user_id

-- ─── crop_stages ─────────────────────────────────────────────────────────────

ALTER TABLE public.crop_stages ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read stages that belong to their crop plans
CREATE POLICY "Users can view their own crop stages"
  ON public.crop_stages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.crop_plans
      WHERE crop_plans.id = crop_stages.plan_id
        AND crop_plans.user_id = auth.uid()
    )
  );

-- Authenticated users may insert stages into their own crop plans
CREATE POLICY "Users can insert crop stages for their plans"
  ON public.crop_stages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crop_plans
      WHERE crop_plans.id = crop_stages.plan_id
        AND crop_plans.user_id = auth.uid()
    )
  );

-- Authenticated users may update stages in their own crop plans
CREATE POLICY "Users can update their own crop stages"
  ON public.crop_stages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.crop_plans
      WHERE crop_plans.id = crop_stages.plan_id
        AND crop_plans.user_id = auth.uid()
    )
  );

-- Authenticated users may delete stages in their own crop plans
CREATE POLICY "Users can delete their own crop stages"
  ON public.crop_stages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.crop_plans
      WHERE crop_plans.id = crop_stages.plan_id
        AND crop_plans.user_id = auth.uid()
    )
  );

-- ─── farm_tasks ──────────────────────────────────────────────────────────────

ALTER TABLE public.farm_tasks ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read tasks that belong to their crop plans
CREATE POLICY "Users can view their own farm tasks"
  ON public.farm_tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.crop_plans
      WHERE crop_plans.id = farm_tasks.plan_id
        AND crop_plans.user_id = auth.uid()
    )
  );

-- Authenticated users may insert tasks into their own crop plans
CREATE POLICY "Users can insert farm tasks for their plans"
  ON public.farm_tasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crop_plans
      WHERE crop_plans.id = farm_tasks.plan_id
        AND crop_plans.user_id = auth.uid()
    )
  );

-- Authenticated users may update tasks in their own crop plans
CREATE POLICY "Users can update their own farm tasks"
  ON public.farm_tasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.crop_plans
      WHERE crop_plans.id = farm_tasks.plan_id
        AND crop_plans.user_id = auth.uid()
    )
  );

-- Authenticated users may delete tasks in their own crop plans
CREATE POLICY "Users can delete their own farm tasks"
  ON public.farm_tasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.crop_plans
      WHERE crop_plans.id = farm_tasks.plan_id
        AND crop_plans.user_id = auth.uid()
    )
  );
