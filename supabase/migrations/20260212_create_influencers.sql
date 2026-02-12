-- Create influencers table for Mi Influencer feature
CREATE TABLE IF NOT EXISTS public.influencers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  character_profile JSONB DEFAULT '{}',
  voice_id TEXT,
  voice_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own influencers"
  ON public.influencers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own influencers"
  ON public.influencers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own influencers"
  ON public.influencers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own influencers"
  ON public.influencers FOR DELETE
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_influencers_user_id ON public.influencers(user_id);
