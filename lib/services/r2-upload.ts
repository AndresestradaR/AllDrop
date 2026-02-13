import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/services/encryption'

interface R2Credentials {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  publicUrl: string
}

export async function getR2Credentials(userId: string): Promise<R2Credentials | null> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('cf_account_id, cf_access_key_id, cf_secret_access_key, cf_bucket_name, cf_public_url')
    .eq('id', userId)
    .single()

  if (!profile?.cf_account_id || !profile?.cf_access_key_id || !profile?.cf_secret_access_key || !profile?.cf_bucket_name) {
    return null
  }

  try {
    return {
      accountId: decrypt(profile.cf_account_id),
      accessKeyId: decrypt(profile.cf_access_key_id),
      secretAccessKey: decrypt(profile.cf_secret_access_key),
      bucketName: decrypt(profile.cf_bucket_name),
      publicUrl: profile.cf_public_url ? decrypt(profile.cf_public_url) : '',
    }
  } catch {
    console.error('[R2] Failed to decrypt credentials')
    return null
  }
}

export function createR2Client(creds: R2Credentials): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${creds.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
  })
}

export async function uploadToR2(
  userId: string,
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const creds = await getR2Credentials(userId)
  if (!creds) throw new Error('R2 no configurado. Ve a Settings para configurar Cloudflare R2.')

  const client = createR2Client(creds)
  const fullKey = `${userId.substring(0, 8)}/${key}`

  await client.send(new PutObjectCommand({
    Bucket: creds.bucketName,
    Key: fullKey,
    Body: buffer,
    ContentType: contentType,
  }))

  if (creds.publicUrl) {
    const base = creds.publicUrl.endsWith('/') ? creds.publicUrl.slice(0, -1) : creds.publicUrl
    return `${base}/${fullKey}`
  }

  return `https://${creds.bucketName}.${creds.accountId}.r2.cloudflarestorage.com/${fullKey}`
}

export async function uploadUrlToR2(
  userId: string,
  sourceUrl: string,
  key: string,
  contentType?: string
): Promise<string> {
  const response = await fetch(sourceUrl)
  if (!response.ok) throw new Error(`Failed to download from source: ${response.status}`)

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const ct = contentType || response.headers.get('content-type') || 'application/octet-stream'

  return uploadToR2(userId, buffer, key, ct)
}

export async function testR2Connection(userId: string): Promise<{ success: boolean; objectCount: number }> {
  const creds = await getR2Credentials(userId)
  if (!creds) throw new Error('R2 no configurado. Ve a Settings para configurar Cloudflare R2.')

  const client = createR2Client(creds)

  const result = await client.send(new ListObjectsV2Command({
    Bucket: creds.bucketName,
    MaxKeys: 10,
    Prefix: `${userId.substring(0, 8)}/`,
  }))

  return {
    success: true,
    objectCount: result.KeyCount || 0,
  }
}

/**
 * Try to upload a buffer to R2. Returns null silently if R2 not configured or fails.
 * Use this in generation APIs where R2 is optional.
 */
export async function tryUploadToR2(
  userId: string,
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string | null> {
  try {
    const creds = await getR2Credentials(userId)
    if (!creds) return null

    const client = createR2Client(creds)
    const fullKey = `${userId.substring(0, 8)}/${key}`

    await client.send(new PutObjectCommand({
      Bucket: creds.bucketName,
      Key: fullKey,
      Body: buffer,
      ContentType: contentType,
    }))

    if (creds.publicUrl) {
      const base = creds.publicUrl.endsWith('/') ? creds.publicUrl.slice(0, -1) : creds.publicUrl
      return `${base}/${fullKey}`
    }
    return `https://${creds.bucketName}.${creds.accountId}.r2.cloudflarestorage.com/${fullKey}`
  } catch (err: any) {
    console.warn('[R2] Optional upload failed, continuing:', err.message)
    return null
  }
}

/**
 * Try to download from URL and upload to R2. Returns null silently if R2 not configured or fails.
 */
export async function tryUploadUrlToR2(
  userId: string,
  sourceUrl: string,
  key: string,
  contentType?: string
): Promise<string | null> {
  try {
    const creds = await getR2Credentials(userId)
    if (!creds) return null

    const response = await fetch(sourceUrl)
    if (!response.ok) return null

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const ct = contentType || response.headers.get('content-type') || 'application/octet-stream'

    return tryUploadToR2(userId, buffer, key, ct)
  } catch (err: any) {
    console.warn('[R2] Optional URL upload failed, continuing:', err.message)
    return null
  }
}
