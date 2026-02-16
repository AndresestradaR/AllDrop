-- =============================================
-- AUTOMATION FLOWS & RUNS
-- Run this in Supabase SQL Editor
-- =============================================

-- automation_flows: stores automation configurations
CREATE TABLE IF NOT EXISTS public.automation_flows (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  video_preset text NOT NULL DEFAULT 'rapido',
  product_name text NOT NULL DEFAULT '',
  product_image_url text,
  product_benefits text DEFAULT '',
  system_prompt text DEFAULT '',
  scenarios jsonb DEFAULT '[]'::jsonb,
  voice_style text DEFAULT 'paisa',
  voice_custom_instruction text DEFAULT '',
  schedule_times text[] DEFAULT ARRAY['08:00', '20:00'],
  account_ids jsonb DEFAULT '[]'::jsonb,
  mode text DEFAULT 'semi',
  is_active boolean DEFAULT false,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- automation_runs: stores each execution of a flow
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id uuid NOT NULL REFERENCES public.automation_flows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario_used text DEFAULT '',
  prompt_generated text DEFAULT '',
  video_task_id text,
  video_url text,
  video_model text,
  caption text DEFAULT '',
  status text DEFAULT 'pending',
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

-- Users can only access their own flows
CREATE POLICY "Users manage own flows"
  ON public.automation_flows FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only access their own runs
CREATE POLICY "Users manage own runs"
  ON public.automation_runs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_automation_flows_user ON public.automation_flows(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_flows_active ON public.automation_flows(is_active, next_run_at);
CREATE INDEX IF NOT EXISTS idx_automation_runs_flow ON public.automation_runs(flow_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_user_status ON public.automation_runs(user_id, status);
