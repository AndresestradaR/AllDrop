-- Meta Ads AI Manager tables
-- Allows users to manage Meta Ads via Claude AI chat interface

-- Add Meta access token and Anthropic API key to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS meta_access_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT;

-- Conversations
CREATE TABLE IF NOT EXISTS meta_ads_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nueva conversacion',
  meta_ad_account_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Messages
CREATE TABLE IF NOT EXISTS meta_ads_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES meta_ads_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool_call', 'tool_result', 'confirmation')),
  content TEXT,
  tool_name TEXT,
  tool_input JSONB,
  tool_result JSONB,
  tool_use_id TEXT,
  requires_confirmation BOOLEAN DEFAULT FALSE,
  confirmed BOOLEAN,
  tokens_used INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pending actions awaiting user confirmation
CREATE TABLE IF NOT EXISTS meta_ads_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES meta_ads_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES meta_ads_messages(id),
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL,
  description TEXT NOT NULL,
  estimated_cost TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'executed', 'failed')),
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meta_ads_conversations_user ON meta_ads_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_messages_conversation ON meta_ads_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_pending_actions_conversation ON meta_ads_pending_actions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_pending_actions_status ON meta_ads_pending_actions(status);

-- RLS
ALTER TABLE meta_ads_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ads_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ads_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conversations" ON meta_ads_conversations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own messages" ON meta_ads_messages
  FOR ALL USING (
    conversation_id IN (SELECT id FROM meta_ads_conversations WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage own pending actions" ON meta_ads_pending_actions
  FOR ALL USING (
    conversation_id IN (SELECT id FROM meta_ads_conversations WHERE user_id = auth.uid())
  );
