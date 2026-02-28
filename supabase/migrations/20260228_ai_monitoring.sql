-- AI Provider Monitoring Logs
-- Tracks every AI provider call (success/error) for the monitoring dashboard

CREATE TABLE IF NOT EXISTS ai_provider_logs (
  id bigserial PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  service text NOT NULL,          -- 'text' | 'image' | 'video' | 'audio'
  provider text NOT NULL,         -- 'kie' | 'openai' | 'google' | 'fal' | 'elevenlabs' | 'google-tts' | 'bfl'
  status text NOT NULL,           -- 'success' | 'error'
  error_message text,
  response_ms integer,
  model text,
  was_fallback boolean DEFAULT false,
  user_id uuid
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON ai_provider_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_provider_status ON ai_provider_logs (provider, status, created_at DESC);

-- RLS: no policies = only service_role (which bypasses RLS) can access
ALTER TABLE ai_provider_logs ENABLE ROW LEVEL SECURITY;

-- Auto-cleanup: delete logs older than 7 days (run via cron or manual)
-- SELECT delete_old_ai_logs();
CREATE OR REPLACE FUNCTION delete_old_ai_logs() RETURNS void AS $$
BEGIN
  DELETE FROM ai_provider_logs WHERE created_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql;
