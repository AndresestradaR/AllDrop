import crypto from 'crypto'

/**
 * Generate a cryptographically random code verifier for PKCE
 * Must be between 43-128 characters, using unreserved URI characters
 */
export function generateCodeVerifier(): string {
  const buffer = crypto.randomBytes(32)
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Generate the code challenge from the code verifier using SHA-256
 * This is the S256 method required by Canva
 */
export function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash('sha256').update(verifier).digest()
  return hash
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Derive an AES-256 key from the Canva client secret.
 * Used to encrypt/decrypt the OAuth state parameter so we don't rely on cookies.
 */
function getStateKey(): Buffer {
  return crypto.createHash('sha256')
    .update(process.env.CANVA_CLIENT_SECRET || 'canva-fallback-key')
    .digest()
}

/**
 * Encrypt PKCE state (code_verifier + returnUrl) into the OAuth state parameter.
 * Uses AES-256-GCM so only our server can decrypt it — acts as CSRF protection too.
 */
export function encryptState(codeVerifier: string, returnUrl: string): string {
  const key = getStateKey()
  const iv = crypto.randomBytes(12)
  const payload = JSON.stringify({ cv: codeVerifier, ru: returnUrl, ts: Date.now() })
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // iv (12) + authTag (16) + ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString('base64url')
}

/**
 * Decrypt the OAuth state parameter to recover code_verifier + returnUrl.
 * Returns null if tampered, expired (>10 min), or invalid.
 */
export function decryptState(encoded: string): { codeVerifier: string; returnUrl: string } | null {
  try {
    const key = getStateKey()
    const data = Buffer.from(encoded, 'base64url')
    if (data.length < 29) return null // iv(12) + authTag(16) + at least 1 byte
    const iv = data.subarray(0, 12)
    const authTag = data.subarray(12, 28)
    const encrypted = data.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    const decrypted = decipher.update(encrypted) + decipher.final('utf8')
    const { cv, ru, ts } = JSON.parse(decrypted)
    // Expire after 10 minutes
    if (Date.now() - ts > 10 * 60 * 1000) return null
    return { codeVerifier: cv, returnUrl: ru || '/dashboard' }
  } catch {
    return null
  }
}

// Canva OAuth configuration
export const CANVA_CONFIG = {
  authorizationEndpoint: 'https://www.canva.com/api/oauth/authorize',
  tokenEndpoint: 'https://api.canva.com/rest/v1/oauth/token',
  assetUploadEndpoint: 'https://api.canva.com/rest/v1/asset-uploads',
  designEndpoint: 'https://api.canva.com/rest/v1/designs',
  scopes: 'asset:read asset:write design:content:read design:content:write',
}
