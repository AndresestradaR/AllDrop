-- Add metadata JSONB column to import_bundles for product context
ALTER TABLE import_bundles ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
