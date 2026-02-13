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
  status: string
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
  result?: any
  error?: string
}

/**
 * Check the status of an async Publer job.
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

  if (data.success === false) {
    return { status: 'error', error: data.error || 'Unknown error' }
  }

  const status = data.data?.status || data.status || 'working'
  return {
    status: status === 'complete' ? 'complete' : status === 'error' ? 'error' : 'working',
    result: data.data?.result || data.result,
    error: data.data?.error || data.error,
  }
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

    if (result.status === 'complete') return result
    if (result.status === 'error') return result

    await new Promise(r => setTimeout(r, intervalMs))
  }

  return { status: 'error', error: 'Timeout waiting for job to complete' }
}

// ============================================
// PUBLISH POST
// ============================================

export interface PublishPostOptions {
  /** Array of account IDs to publish to */
  accountIds: string[]
  /** Post text/caption */
  text: string
  /** Content type: photo, video, status */
  contentType: 'photo' | 'video' | 'status'
  /** Media IDs (from upload) */
  mediaIds?: string[]
  /** Media type for each media ID */
  mediaType?: 'image' | 'video'
  /** ISO 8601 scheduled time. Omit for immediate publishing. */
  scheduledAt?: string
  /** Network-specific overrides. If not provided, uses "default" for all. */
  networkOverrides?: Record<string, { type: string; text: string; media?: any[] }>
}

export interface PublishResult {
  jobId: string
}

/**
 * Schedule or publish a post to Publer.
 * Use /posts/schedule/publish for immediate, /posts/schedule for scheduled.
 */
export async function publishPost(
  creds: PublerCredentials,
  options: PublishPostOptions
): Promise<PublishResult> {
  const { accountIds, text, contentType, mediaIds, mediaType, scheduledAt, networkOverrides } = options

  // Build networks object
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

  // Build accounts array
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

  // Use /publish for immediate, /schedule for scheduled
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
