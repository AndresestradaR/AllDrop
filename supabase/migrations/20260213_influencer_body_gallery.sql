-- Add body_grid_url column to influencers table
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS body_grid_url TEXT;

-- Create influencer_gallery table
CREATE TABLE IF NOT EXISTS influencer_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID REFERENCES influencers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  image_url TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'solo',
  product_name TEXT,
  product_image_url TEXT,
  prompt_used TEXT,
  situation TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE influencer_gallery ENABLE ROW LEVEL SECURITY;

-- Users can only see their own gallery items
CREATE POLICY "Users can view own gallery" ON influencer_gallery
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gallery" ON influencer_gallery
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gallery" ON influencer_gallery
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own gallery" ON influencer_gallery
  FOR DELETE USING (auth.uid() = user_id);
