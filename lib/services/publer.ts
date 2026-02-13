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

export interface PublerMediaObject {
  id: string
  path: string
  thumbnail?: string
  type: string
  name?: string
  validity?: Record<string, any>
  width?: number
  height?: number
}

/**
 * Upload media DIRECTLY via multipart/form-data.
 * This returns the media object IMMEDIATELY (no polling needed).
 * 
 * Use this instead of uploadMediaFromUrl to avoid async job timeouts.
 */
export async function uploadMediaDirect(
  creds: PublerCredentials,
  fileBuffer: Buffer,
  filename: string,
  contentType: string
): Promise<PublerMediaObject> {
  // Build multipart form data manually using Web API FormData + Blob
  const formData = new FormData()
  const blob = new Blob([fileBuffer], { type: contentType })
  formData.append('file', blob, filename)
  formData.append('direct_upload', 'false')
  formData.append('in_library', 'false')

  const response = await fetch(`${PUBLER_API_BASE}/media`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer-API ${creds.apiKey}`,
      'Publer-Workspace-Id': creds.workspaceId,
      'Accept': '*/*',
      // Do NOT set Content-Type - fetch sets it automatically with boundary for FormData
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Direct media upload error: ${response.status} - ${error}`)
  }

  const data = await response.json()

  console.log('[Publer/MediaDirect] Response:', JSON.stringify(data).slice(0, 500))

  if (!data.id || !data.path) {
    throw new Error(`Direct upload did not return media object: ${JSON.stringify(data).slice(0, 300)}`)
  }

  return {
    id: data.id,
    path: data.path,
    thumbnail: data.thumbnail,
    type: data.type || 'photo',
    name: data.name,
    validity: data.validity,
    width: data.width,
    height: data.height,
  }
}

/**
 * Download a file from a URL and return it as a Buffer.
 */
export async function downloadFileAsBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} from ${url}`)
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream'
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  console.log(`[Publer/Download] Downloaded ${buffer.length} bytes, type=${contentType}`)

  return { buffer, contentType }
}

export interface MediaUploadResult {
  jobId: string
}

/**
 * Upload media from a public URL to Publer (ASYNC - requires polling).
 * DEPRECATED: Use uploadMediaDirect instead to avoid timeout issues.
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
  raw?: any
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

  console.log('[Publer/Job] Raw response:', JSON.stringify(data).slice(0, 800))

  if (data.success === false) {
    return { status: 'error', error: data.error || 'Unknown error', raw: data }
  }

  if (data.data) {
    const inner = data.data
    const status = inner.status || 'working'
    if (status === 'complete' || status === 'done' || status === 'completed') {
      return { status: 'complete', result: inner.result || inner, raw: data }
    }
    if (status === 'error' || status === 'failed') {
      return { status: 'error', error: inner.error || 'Job failed', raw: data }
    }
    return { status: 'working', raw: data }
  }

  const status = data.status
  if (status === 'complete' || status === 'done' || status === 'completed') {
    return { status: 'complete', result: data.payload || data.result || data, raw: data }
  }
  if (status === 'error' || status === 'failed') {
    return { status: 'error', error: data.error || data.payload?.error || 'Job failed', raw: data }
  }
  if (status === 'working' || status === 'pending' || status === 'queued') {
    return { status: 'working', raw: data }
  }

  if (data.id && data.path) {
    return { status: 'complete', result: data, raw: data }
  }

  if (Array.isArray(data) && data.length > 0) {
    return { status: 'complete', result: data, raw: data }
  }

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
