-- Add product_images column to store uploaded photos for the landing pipeline
ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS product_images JSONB;
