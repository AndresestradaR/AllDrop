-- Add section_type column to landing_sections for proper categorization
-- This stores the section category directly (hero, testimonios, faq, etc.)
-- instead of relying solely on template_id -> templates.category
ALTER TABLE landing_sections ADD COLUMN IF NOT EXISTS section_type TEXT;
