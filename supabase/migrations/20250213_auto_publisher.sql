-- =============================================
-- AUTO PUBLISHER: Automation flows & runs
-- =============================================
-- Tabla principal: cada automatización configurada
CREATE TABLE IF NOT EXISTS automation_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Nombre del flujo
  name TEXT NOT NULL DEFAULT 'Mi automatización',
  -- Influencer vinculado
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  -- Preset de video: producto | rapido | premium
  video_preset TEXT NOT NULL DEFAULT 'rapido' CHECK (video_preset IN ('producto', 'rapido', 'premium')),
  -- Producto
  product_name TEXT NOT NULL DEFAULT '',
  product_image_url TEXT,
  product_benefits TEXT DEFAULT '',
  -- System prompt editable (base para generar ideas de escenarios)
  system_prompt TEXT NOT NULL DEFAULT 'Eres un director creativo de contenido UGC para redes sociales en Colombia. Genera ideas de escenas cortas para videos de producto, variando escenarios, acciones y emociones. Siempre en español con tono natural latino.',
  -- Escenarios (array JSON de strings, se elige uno random cada ejecución)
  scenarios JSONB NOT NULL DEFAULT '["Mostrando el producto en la cocina de su casa, hablando casual a cámara", "En un café, sacando el producto del bolso y recomendándolo a una amiga", "Frente al espejo del baño, haciendo su rutina y usando el producto", "En el parque, sentada en una banca, contando su experiencia con el producto", "En la oficina, en su escritorio, mostrando el producto a cámara"]'::jsonb,
  -- Voz / acento
  voice_style TEXT NOT NULL DEFAULT 'paisa' CHECK (voice_style IN ('paisa', 'latina', 'rola', 'costena', 'personalizada')),
  voice_custom_instruction TEXT DEFAULT '',
  -- Frecuencia en horas
  frequency_hours INT NOT NULL DEFAULT 12 CHECK (frequency_hours >= 1 AND frequency_hours <= 168),
  -- Cuentas destino de Publer (array de IDs)
  account_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Modo: auto (publica solo) o semi (espera aprobación)
  mode TEXT NOT NULL DEFAULT 'semi' CHECK (mode IN ('auto', 'semi')),
  -- Estado activo/inactivo
  is_active BOOLEAN NOT NULL DEFAULT false,
  -- Control de ejecución
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_automation_flows_user ON automation_flows(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_flows_active ON automation_flows(is_active, next_run_at);

-- Tabla de ejecuciones: historial de cada run
CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES automation_flows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Qué escenario se usó
  scenario_used TEXT NOT NULL DEFAULT '',
  -- Prompt generado
  prompt_generated TEXT DEFAULT '',
  -- Video
  video_task_id TEXT,
  video_url TEXT,
  video_model TEXT,
  -- Caption para redes
  caption TEXT DEFAULT '',
  -- Estado del run
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'generating_prompt',
    'generating_video',
    'video_ready',
    'awaiting_approval',
    'publishing',
    'published',
    'failed',
    'rejected'
  )),
  -- Error si falló
  error_message TEXT,
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_automation_runs_flow ON automation_runs(flow_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON automation_runs(status);
CREATE INDEX IF NOT EXISTS idx_automation_runs_user ON automation_runs(user_id);

-- RLS Policies
ALTER TABLE automation_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own flows"
  ON automation_flows FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own runs"
  ON automation_runs FOR ALL
  USING (auth.uid() = user_id);

-- Service role access for cron
CREATE POLICY "Service role full access flows"
  ON automation_flows FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access runs"
  ON automation_runs FOR ALL
  USING (auth.role() = 'service_role');
