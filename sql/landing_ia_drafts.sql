CREATE TABLE IF NOT EXISTS landing_ia_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'error')),
  product_name TEXT NOT NULL,
  product_url TEXT,
  country TEXT NOT NULL DEFAULT 'CO',
  product_metadata JSONB,
  sections_json JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE landing_ia_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own drafts" ON landing_ia_drafts FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_landing_ia_drafts_user_id ON landing_ia_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_landing_ia_drafts_created ON landing_ia_drafts(created_at DESC);

CREATE OR REPLACE FUNCTION update_landing_ia_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_landing_ia_updated_at ON landing_ia_drafts;
CREATE TRIGGER trg_landing_ia_updated_at
  BEFORE UPDATE ON landing_ia_drafts
  FOR EACH ROW EXECUTE FUNCTION update_landing_ia_updated_at();
