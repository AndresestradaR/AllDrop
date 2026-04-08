-- Add missing columns to products table for Banner Generator persistence
-- These columns store user settings so they survive page refreshes
ALTER TABLE products ADD COLUMN IF NOT EXISTS color_palette JSONB DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS typography JSONB DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pricing JSONB DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS target_country VARCHAR(2) DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_photos JSONB DEFAULT NULL;
