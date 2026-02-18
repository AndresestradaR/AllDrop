-- Add video_options JSONB column to automation_flows
-- Stores model-specific options (Kling 3.0 mode, sound, etc.)
ALTER TABLE public.automation_flows
  ADD COLUMN IF NOT EXISTS video_options jsonb DEFAULT '{}'::jsonb;
