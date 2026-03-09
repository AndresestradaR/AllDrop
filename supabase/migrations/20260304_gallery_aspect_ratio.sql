-- Add aspect_ratio column to influencer_gallery table
ALTER TABLE influencer_gallery ADD COLUMN IF NOT EXISTS aspect_ratio VARCHAR(10) DEFAULT '9:16';
