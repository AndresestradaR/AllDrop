-- Add product_context column to products table
-- Stores the detailed product context (description, benefits, problems, ingredients, differentiator)
-- as JSONB so it persists across sessions and can be reused by Video Viral and other tools.
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_context JSONB DEFAULT NULL;
