// Meta Ads AI Manager — Types

// ============================================================
// Database types
// ============================================================

export interface MetaAdsConversation {
  id: string
  user_id: string
  title: string
  meta_ad_account_id: string | null
  created_at: string
  updated_at: string
}

export interface MetaAdsMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result' | 'confirmation'
  content: string | null
  tool_name: string | null
  tool_input: Record<string, any> | null
  tool_result: Record<string, any> | null
  tool_use_id: string | null
  requires_confirmation: boolean
  confirmed: boolean | null
  tokens_used: number | null
  created_at: string
}

export interface MetaAdsPendingAction {
  id: string
  conversation_id: string
  message_id: string | null
  action_type: string
  action_payload: Record<string, any>
  description: string
  estimated_cost: string | null
  status: 'pending' | 'confirmed' | 'rejected' | 'executed' | 'failed'
  executed_at: string | null
  error_message: string | null
  created_at: string
}

// ============================================================
// Meta Marketing API types
// ============================================================

export interface MetaAdAccount {
  id: string
  name: string
  currency: string
  account_status: number
  amount_spent: string
}

export interface MetaCampaign {
  id: string
  name: string
  objective: string
  status: string
  daily_budget?: string
  lifetime_budget?: string
  start_time?: string
  stop_time?: string
  buying_type?: string
}

export interface MetaAdSet {
  id: string
  name: string
  status: string
  daily_budget?: string
  campaign_id: string
  optimization_goal?: string
  billing_event?: string
  targeting?: Record<string, any>
  bid_strategy?: string
}

export interface MetaAd {
  id: string
  name: string
  status: string
  adset_id: string
  creative?: { id: string }
}

export interface MetaCreative {
  id: string
  name?: string
  body?: string
  title?: string
  link_url?: string
  image_url?: string
  video_id?: string
  call_to_action_type?: string
  thumbnail_url?: string
}

export interface MetaInsightsRow {
  spend: string
  impressions: string
  clicks: string
  cpc: string
  cpm: string
  ctr: string
  reach: string
  frequency: string
  actions?: Array<{ action_type: string; value: string }>
  cost_per_action_type?: Array<{ action_type: string; value: string }>
  purchase_roas?: Array<{ action_type: string; value: string }>
  date_start: string
  date_stop: string
  campaign_name?: string
  adset_name?: string
  ad_name?: string
}

export interface MetaTargetingOption {
  id: string
  name: string
  type: string
  audience_size_lower_bound?: number
  audience_size_upper_bound?: number
  path?: string[]
}

// ============================================================
// SSE event types
// ============================================================

export type SSEEventType =
  | 'delta'              // streaming text chunk
  | 'tool_start'         // tool execution started
  | 'tool_result'        // tool execution completed
  | 'confirmation_required' // write action needs approval
  | 'done'               // response complete
  | 'error'              // error occurred

export interface SSEEvent {
  type: SSEEventType
  data: any
}

// ============================================================
// Tool types
// ============================================================

export const READ_ONLY_TOOLS = [
  'get_ad_accounts',
  'get_campaigns',
  'get_adsets',
  'get_ads',
  'get_insights',
  'get_ad_creative',
  'search_targeting',
  'get_my_products',
] as const

export const WRITE_TOOLS = [
  'create_campaign',
  'create_adset',
  'create_ad',
  'update_budget',
  'toggle_status',
  'update_targeting',
] as const

export type ReadOnlyTool = typeof READ_ONLY_TOOLS[number]
export type WriteTool = typeof WRITE_TOOLS[number]
export type MetaAdsTool = ReadOnlyTool | WriteTool

export function isWriteTool(name: string): name is WriteTool {
  return (WRITE_TOOLS as readonly string[]).includes(name)
}
