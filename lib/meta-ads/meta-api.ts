// Meta Marketing API client
// Handles all communication with graph.facebook.com

const META_API_BASE = 'https://graph.facebook.com/v21.0'

interface MetaAPIOptions {
  accessToken: string
}

interface MetaAPIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export class MetaAPIClient {
  private token: string

  constructor(opts: MetaAPIOptions) {
    this.token = opts.accessToken
  }

  private async request<T = any>(
    path: string,
    params: Record<string, any> = {},
    method: 'GET' | 'POST' = 'GET'
  ): Promise<MetaAPIResponse<T>> {
    try {
      const url = new URL(`${META_API_BASE}${path}`)
      url.searchParams.set('access_token', this.token)

      let response: Response

      if (method === 'GET') {
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null) {
            url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
          }
        }
        response = await fetch(url.toString())
      } else {
        const body = new URLSearchParams()
        body.set('access_token', this.token)
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null) {
            body.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
          }
        }
        response = await fetch(`${META_API_BASE}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        })
      }

      const json = await response.json()

      if (json.error) {
        const msg = json.error.message || JSON.stringify(json.error)
        // Detect token expiration
        if (json.error.code === 190 || json.error.type === 'OAuthException') {
          return { success: false, error: `Token expirado o inválido: ${msg}. Actualiza tu token de Meta en Settings.` }
        }
        return { success: false, error: msg }
      }

      return { success: true, data: json }
    } catch (err: any) {
      return { success: false, error: err.message || 'Error de conexión con Meta API' }
    }
  }

  // ==================== READ-ONLY ====================

  async getAdAccounts(): Promise<MetaAPIResponse> {
    return this.request('/me/adaccounts', {
      fields: 'id,name,currency,account_status,amount_spent',
      limit: 50,
    })
  }

  async getCampaigns(input: {
    ad_account_id: string
    status_filter?: string
    limit?: number
  }): Promise<MetaAPIResponse> {
    const { ad_account_id, status_filter = 'ALL', limit = 25 } = input
    const params: Record<string, any> = {
      fields: 'id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time,buying_type',
      limit,
    }
    if (status_filter !== 'ALL') {
      params.filtering = [{ field: 'effective_status', operator: 'IN', value: [status_filter] }]
    }
    return this.request(`/${ad_account_id}/campaigns`, params)
  }

  async getAdsets(input: {
    campaign_id?: string
    ad_account_id?: string
    status_filter?: string
  }): Promise<MetaAPIResponse> {
    const { campaign_id, ad_account_id, status_filter } = input
    const fields = 'id,name,status,daily_budget,campaign_id,optimization_goal,billing_event,targeting,bid_strategy'
    const params: Record<string, any> = { fields, limit: 50 }
    if (status_filter && status_filter !== 'ALL') {
      params.filtering = [{ field: 'effective_status', operator: 'IN', value: [status_filter] }]
    }

    if (campaign_id) {
      return this.request(`/${campaign_id}/adsets`, params)
    }
    if (ad_account_id) {
      return this.request(`/${ad_account_id}/adsets`, params)
    }
    return { success: false, error: 'Se requiere campaign_id o ad_account_id' }
  }

  async getAds(input: {
    adset_id?: string
    campaign_id?: string
    ad_account_id?: string
    status_filter?: string
  }): Promise<MetaAPIResponse> {
    const { adset_id, campaign_id, ad_account_id, status_filter } = input
    const fields = 'id,name,status,adset_id,creative{id}'
    const params: Record<string, any> = { fields, limit: 50 }
    if (status_filter && status_filter !== 'ALL') {
      params.filtering = [{ field: 'effective_status', operator: 'IN', value: [status_filter] }]
    }

    if (adset_id) return this.request(`/${adset_id}/ads`, params)
    if (campaign_id) return this.request(`/${campaign_id}/ads`, params)
    if (ad_account_id) return this.request(`/${ad_account_id}/ads`, params)
    return { success: false, error: 'Se requiere adset_id, campaign_id o ad_account_id' }
  }

  async getInsights(input: {
    object_id: string
    object_type: string
    date_preset?: string
    time_range?: { since: string; until: string }
    breakdowns?: string[]
    level?: string
  }): Promise<MetaAPIResponse> {
    const { object_id, object_type, date_preset, time_range, breakdowns, level } = input
    const fields = [
      'spend', 'impressions', 'clicks', 'cpc', 'cpm', 'ctr', 'reach', 'frequency',
      'actions', 'cost_per_action_type', 'purchase_roas',
      'campaign_name', 'adset_name', 'ad_name',
      'date_start', 'date_stop',
    ].join(',')

    const params: Record<string, any> = { fields }
    if (date_preset) params.date_preset = date_preset
    if (time_range) params.time_range = time_range
    if (breakdowns?.length) params.breakdowns = breakdowns.join(',')
    if (level) params.level = level

    return this.request(`/${object_id}/insights`, params)
  }

  async getAdCreative(input: { creative_id: string }): Promise<MetaAPIResponse> {
    return this.request(`/${input.creative_id}`, {
      fields: 'id,name,body,title,link_url,image_url,video_id,call_to_action_type,thumbnail_url',
    })
  }

  async searchTargeting(input: {
    query: string
    type?: string
  }): Promise<MetaAPIResponse> {
    const params: Record<string, any> = {
      q: input.query,
      type: input.type || 'adinterest',
      limit: 20,
    }
    return this.request('/search', params)
  }

  // ==================== WRITE ====================

  async createCampaign(input: {
    ad_account_id: string
    name: string
    objective: string
    daily_budget?: number
    lifetime_budget?: number
    status?: string
    special_ad_categories?: string[]
  }): Promise<MetaAPIResponse> {
    const { ad_account_id, ...rest } = input
    const params: Record<string, any> = {
      name: rest.name,
      objective: rest.objective,
      status: rest.status || 'PAUSED',
      special_ad_categories: rest.special_ad_categories || [],
    }
    if (rest.daily_budget) params.daily_budget = rest.daily_budget
    if (rest.lifetime_budget) params.lifetime_budget = rest.lifetime_budget
    return this.request(`/${ad_account_id}/campaigns`, params, 'POST')
  }

  async createAdset(input: {
    ad_account_id: string
    campaign_id: string
    name: string
    daily_budget?: number
    optimization_goal: string
    billing_event: string
    targeting: Record<string, any>
    start_time?: string
    end_time?: string
    status?: string
  }): Promise<MetaAPIResponse> {
    const { ad_account_id, ...rest } = input
    const params: Record<string, any> = {
      campaign_id: rest.campaign_id,
      name: rest.name,
      optimization_goal: rest.optimization_goal,
      billing_event: rest.billing_event,
      targeting: rest.targeting,
      status: rest.status || 'PAUSED',
    }
    if (rest.daily_budget) params.daily_budget = rest.daily_budget
    if (rest.start_time) params.start_time = rest.start_time
    if (rest.end_time) params.end_time = rest.end_time
    return this.request(`/${ad_account_id}/adsets`, params, 'POST')
  }

  async createAd(input: {
    ad_account_id: string
    adset_id: string
    name: string
    creative: Record<string, any>
    status?: string
  }): Promise<MetaAPIResponse> {
    const { ad_account_id, ...rest } = input
    // Build creative spec for the API
    const creativeSpec: Record<string, any> = {}
    if (rest.creative.title) creativeSpec.title = rest.creative.title
    if (rest.creative.body) creativeSpec.body = rest.creative.body
    if (rest.creative.link_url) {
      creativeSpec.object_story_spec = {
        link_data: {
          link: rest.creative.link_url,
          message: rest.creative.body,
          name: rest.creative.title,
          call_to_action: rest.creative.call_to_action_type
            ? { type: rest.creative.call_to_action_type }
            : undefined,
          image_hash: rest.creative.image_hash,
          picture: rest.creative.image_url,
        },
      }
    }

    return this.request(`/${ad_account_id}/ads`, {
      adset_id: rest.adset_id,
      name: rest.name,
      creative: creativeSpec,
      status: rest.status || 'PAUSED',
    }, 'POST')
  }

  async updateBudget(input: {
    object_id: string
    object_type: string
    daily_budget?: number
    lifetime_budget?: number
  }): Promise<MetaAPIResponse> {
    const params: Record<string, any> = {}
    if (input.daily_budget) params.daily_budget = input.daily_budget
    if (input.lifetime_budget) params.lifetime_budget = input.lifetime_budget
    return this.request(`/${input.object_id}`, params, 'POST')
  }

  async toggleStatus(input: {
    object_id: string
    object_type: string
    new_status: string
  }): Promise<MetaAPIResponse> {
    return this.request(`/${input.object_id}`, { status: input.new_status }, 'POST')
  }

  async updateTargeting(input: {
    adset_id: string
    targeting: Record<string, any>
  }): Promise<MetaAPIResponse> {
    return this.request(`/${input.adset_id}`, { targeting: input.targeting }, 'POST')
  }

  // ==================== TOOL DISPATCHER ====================

  async executeTool(toolName: string, toolInput: Record<string, any>): Promise<MetaAPIResponse> {
    switch (toolName) {
      case 'get_ad_accounts': return this.getAdAccounts()
      case 'get_campaigns': return this.getCampaigns(toolInput as any)
      case 'get_adsets': return this.getAdsets(toolInput as any)
      case 'get_ads': return this.getAds(toolInput as any)
      case 'get_insights': return this.getInsights(toolInput as any)
      case 'get_ad_creative': return this.getAdCreative(toolInput as any)
      case 'search_targeting': return this.searchTargeting(toolInput as any)
      case 'create_campaign': return this.createCampaign(toolInput as any)
      case 'create_adset': return this.createAdset(toolInput as any)
      case 'create_ad': return this.createAd(toolInput as any)
      case 'update_budget': return this.updateBudget(toolInput as any)
      case 'toggle_status': return this.toggleStatus(toolInput as any)
      case 'update_targeting': return this.updateTargeting(toolInput as any)
      default: return { success: false, error: `Herramienta desconocida: ${toolName}` }
    }
  }
}
