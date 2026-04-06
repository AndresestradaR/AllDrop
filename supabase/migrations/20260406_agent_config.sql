CREATE TABLE IF NOT EXISTS agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  agent_name TEXT DEFAULT 'AllDrop Assistant',
  agent_avatar_url TEXT,
  personality TEXT DEFAULT 'professional',
  custom_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own config" ON agent_config
  FOR ALL USING (auth.uid() = user_id);
