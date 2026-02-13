-- ============================================
-- AUTOMATIONS: Pipeline de publicación automática
-- ============================================

CREATE TABLE IF NOT EXISTS automations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Identidad
  name TEXT NOT NULL,
  
  -- Influencer
  influencer_id UUID NOT NULL,
  
  -- Video config
  preset TEXT NOT NULL DEFAULT 'rapido', -- producto | rapido | premium
  aspect_ratio TEXT DEFAULT '9:16',
  duration INTEGER DEFAULT 10,
  
  -- Producto
  product_name TEXT NOT NULL,
  product_image_url TEXT,
  
  -- Prompt & escenarios
  system_prompt TEXT NOT NULL,
  scenarios JSONB DEFAULT '[]'::jsonb,  -- ["escenario 1", "escenario 2", ...]
  voice_style TEXT DEFAULT 'latina',     -- latina | paisa | neutral
  
  -- Publicación
  publer_account_ids JSONB DEFAULT '[]'::jsonb,  -- ["acc_id_1", "acc_id_2"]
  caption_prompt TEXT,  -- prompt para generar caption/copy
  hashtags TEXT,
  
  -- Scheduling
  frequency_hours INTEGER DEFAULT 12,
  mode TEXT DEFAULT 'auto',     -- auto | semi (requiere aprobación)
  status TEXT DEFAULT 'paused', -- active | paused
  
  -- Tracking
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  total_runs INTEGER DEFAULT 0,
  total_published INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historial de ejecuciones
CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID REFERENCES automations(id) ON DELETE CASCADE NOT NULL,
  
  -- Estado del pipeline
  status TEXT DEFAULT 'pending',
  -- pending → generating_prompt → generating_video → generating_caption 
  -- → awaiting_approval → publishing → published
  -- → failed | rejected
  
  -- Datos generados
  scenario_used TEXT,
  video_prompt TEXT,
  video_task_id TEXT,
  video_url TEXT,
  caption TEXT,
  
  -- Resultado publicación
  publer_post_ids JSONB DEFAULT '[]'::jsonb,
  
  -- Errores
  error TEXT,
  
  -- Timestamps
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_automations_user ON automations(user_id);
CREATE INDEX IF NOT EXISTS idx_automations_status ON automations(status);
CREATE INDEX IF NOT EXISTS idx_automations_next_run ON automations(next_run_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_runs_automation ON automation_runs(automation_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON automation_runs(status);

-- RLS
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own automations" ON automations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own runs" ON automation_runs
  FOR ALL USING (
    automation_id IN (SELECT id FROM automations WHERE user_id = auth.uid())
  );
