-- Add wizard columns to influencers table for the 6-step wizard flow

-- Step 1: Design form fields
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS age_range VARCHAR(20);
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS skin_tone VARCHAR(30);
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS hair_color VARCHAR(30);
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS hair_style VARCHAR(30);
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS eye_color VARCHAR(20);
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS build VARCHAR(20);
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS style_vibe VARCHAR(30);
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS accessories TEXT[];
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS custom_details TEXT;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS base_image_url TEXT;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS base_prompt TEXT;

-- Step 2: Realism
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS realistic_image_url TEXT;

-- Step 3: Angles grid
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS angles_grid_url TEXT;

-- Step 4: Visual analysis
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS visual_dna TEXT;
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS prompt_descriptor TEXT;

-- Wizard progress
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 1;
