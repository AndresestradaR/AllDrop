import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'

const PUBLER_API_BASE = 'https://app.publer.com/api/v1'

interface PublerCredentials {
  apiKey: string
  workspaceId: string
}

/**
 * Get decrypted Publer credentials for a user.
 */
export async function getPublerCredentials(userId: string): Promise<PublerCredentials | null> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('publer_api_key, publer_workspace_id')
    .eq('id', userId)
    .single()

  if (!profile?.publer_api_key || !profile?.publer_workspace_id) {
    return null
  }

  try {
    return {
      apiKey: decrypt(profile.publer_api_key),
      workspaceId: decrypt(profile.publer_workspace_id),
    }
  } catch {
    console.error('[Publer] Failed to decrypt credentials')
    return null
  }
}

/**
 * Helper to make authenticated Publer API requests.
 */
async function publerFetch(
  creds: PublerCredentials,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${PUBLER_API_BASE}${path}`
  const headers: Record<string, string> = {
    'Authorization': `Bearer-API ${creds.apiKey}`,
    'Publer-Workspace-Id': creds.workspaceId,
    'Accept': '*/*',
    ...((options.headers as Record<string, string>) || {}),
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

// ============================================
// ACCOUNTS
// ============================================

export interface PublerAccount {
  id: string
  name: string
  provider: string
  type: string
  picture: string
  locked?: boolean
  permissions?: { can_access?: boolean }
}

/**
 * List connected social media accounts.
 */
export async function getAccounts(creds: PublerCredentials): Promise<PublerAccount[]> {
  const response = await publerFetch(creds, '/accounts')

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Publer accounts error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.accounts || data || []
}

// ============================================
// WORKSPACES
// ============================================

export interface PublerWorkspace {
  id: string
  name: string
  role: string
  picture: string
}

/**
 * List workspaces.
 */
export async function getWorkspaces(apiKey: string): Promise<PublerWorkspace[]> {
  const response = await fetch(`${PUBLER_API_BASE}/workspaces`, {
    headers: {
      'Authorization': `Bearer-API ${apiKey}`,
      'Accept': '*/*',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Publer workspaces error: ${response.status} - ${error}`)
  }

  return response.json()
}

// ============================================
// MEDIA UPLOAD
// ============================================

export interface MediaUploadResult {
  jobId: string
}

/**
 * Upload media from a public URL to Publer.
 * Returns a job ID that must be polled for the media ID.
 */
export async function uploadMediaFromUrl(
  creds: PublerCredentials,
  mediaUrl: string,
  name?: string
): Promise<MediaUploadResult> {
  const response = await publerFetch(creds, '/media/from-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media: [{
        url: mediaUrl,
        name: name || `estrategas-${Date.now()}`,
      }],
      type: 'single',
      direct_upload: false,
      in_library: false,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Media upload error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const jobId = data.id || data.job_id
  if (!jobId) {
    throw new Error('No job ID returned from media upload')
  }

  return { jobId }
}

// ============================================
// JOB STATUS
// ============================================

export interface JobStatusResult {
  status: 'working' | 'complete' | 'error'
  /** The raw response from Publer job_status endpoint */
  raw?: any
  /** Extracted result (media object, post result, etc.) */
  result?: any
  error?: string
}

/**
 * Check the status of an async Publer job.
 * 
 * Publer job_status can return different formats:
 * 1. { status: "complete", payload: { ... } }
 * 2. { data: { status: "complete", result: { ... } } }
 * 3. Direct media object: { id: "...", path: "...", type: "photo" }
 * 4. { status: "working" } while processing
 */
export async function checkJobStatus(
  creds: PublerCredentials,
  jobId: string
): Promise<JobStatusResult> {
  const response = await publerFetch(creds, `/job_status/${jobId}`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Job status error: ${response.status} - ${error}`)
  }

  const data = await response.json()

  console.log('[Publer/Job] Raw response:', JSON.stringify(data).slice(0, 800))

  // Case: explicit error
  if (data.success === false) {
    return { status: 'error', error: data.error || 'Unknown error', raw: data }
  }

  // Case: wrapped in data object
  if (data.data) {
    const inner = data.data
    const status = inner.status || 'working'
    if (status === 'complete' || status === 'done') {
      return { status: 'complete', result: inner.result || inner, raw: data }
    }
    if (status === 'error' || status === 'failed') {
      return { status: 'error', error: inner.error || 'Job failed', raw: data }
    }
    return { status: 'working', raw: data }
  }

  // Case: direct status field
  const status = data.status
  if (status === 'complete' || status === 'done') {
    return { status: 'complete', result: data.payload || data.result || data, raw: data }
  }
  if (status === 'error' || status === 'failed') {
    return { status: 'error', error: data.error || data.payload?.error || 'Job failed', raw: data }
  }
  if (status === 'working' || status === 'pending' || status === 'queued') {
    return { status: 'working', raw: data }
  }

  // Case: direct media object (has id + path, no status field)
  if (data.id && data.path) {
    return { status: 'complete', result: data, raw: data }
  }

  // Case: array of results
  if (Array.isArray(data) && data.length > 0) {
    return { status: 'complete', result: data, raw: data }
  }

  // Default: still working
  return { status: 'working', raw: data }
}

/**
 * Poll a job until complete or timeout.
 */
export async function pollJobUntilComplete(
  creds: PublerCredentials,
  jobId: string,
  maxAttempts = 30,
  intervalMs = 2000
): Promise<JobStatusResult> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await checkJobStatus(creds, jobId)

    console.log(`[Publer/Job] Poll ${i + 1}/${maxAttempts}: status=${result.status}`)

    if (result.status === 'complete') return result
    if (result.status === 'error') return result

    await new Promise(r => setTimeout(r, intervalMs))
  }

  return { status: 'error', error: 'Timeout waiting for job to complete' }
}

// ============================================
// PUBLISH POST (legacy - kept for reference)
// ============================================

export interface PublishPostOptions {
  accountIds: string[]
  text: string
  contentType: 'photo' | 'video' | 'status'
  mediaIds?: string[]
  mediaType?: 'image' | 'video'
  scheduledAt?: string
  networkOverrides?: Record<string, { type: string; text: string; media?: any[] }>
}

export interface PublishResult {
  jobId: string
}

export async function publishPost(
  creds: PublerCredentials,
  options: PublishPostOptions
): Promise<PublishResult> {
  const { accountIds, text, contentType, mediaIds, mediaType, scheduledAt, networkOverrides } = options

  let networks: Record<string, any>
  if (networkOverrides && Object.keys(networkOverrides).length > 0) {
    networks = networkOverrides
  } else {
    const defaultNetwork: Record<string, any> = {
      type: contentType,
      text,
    }
    if (mediaIds && mediaIds.length > 0) {
      defaultNetwork.media = mediaIds.map(id => ({
        id,
        type: mediaType || (contentType === 'video' ? 'video' : 'image'),
      }))
    }
    networks = { default: defaultNetwork }
  }

  const accounts = accountIds.map(id => {
    const account: Record<string, any> = { id }
    if (scheduledAt) {
      account.scheduled_at = scheduledAt
    }
    return account
  })

  const payload = {
    bulk: {
      state: 'scheduled',
      posts: [{
        networks,
        accounts,
      }],
    },
  }

  const endpoint = scheduledAt ? '/posts/schedule' : '/posts/schedule/publish'

  console.log(`[Publer] Publishing to ${endpoint} for ${accountIds.length} accounts`)

  const response = await publerFetch(creds, endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Publish error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const jobId = data.id || data.job_id
  if (!jobId) {
    throw new Error('No job ID returned from publish')
  }

  return { jobId }
}
