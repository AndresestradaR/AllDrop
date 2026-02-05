import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = process.env.ENCRYPTION_KEY ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex') : null

export function encrypt(text: string): string {
  if (!KEY) throw new Error('ENCRYPTION_KEY not configured')
  
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag().toString('hex')
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

export function decrypt(encryptedText: string): string {
  if (!KEY) throw new Error('ENCRYPTION_KEY not configured')
  
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':')
  
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

export function mask(encryptedKey: string | null): string {
  if (!encryptedKey) return ''

  // The key is encrypted, so we need to decrypt it first to show last 4 chars
  try {
    const decrypted = decrypt(encryptedKey)
    if (decrypted.length < 4) return '••••••••'
    return '••••••••' + decrypted.slice(-4)
  } catch {
    // If decryption fails, just show that there's a key configured
    return '••••••••••••'
  }
}