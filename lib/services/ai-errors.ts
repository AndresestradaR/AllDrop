// Centralized AI error classification for user-friendly error messages (Spanish)

export type AIProvider = 'KIE' | 'fal.ai' | 'OpenAI' | 'Google' | 'BFL'

export type AIErrorCategory = 'auth' | 'quota' | 'server' | 'timeout' | 'content' | 'unknown'

export class AIProviderError extends Error {
  provider: AIProvider
  category: AIErrorCategory
  httpStatus?: number
  userMessage: string

  constructor(opts: {
    provider: AIProvider
    category: AIErrorCategory
    httpStatus?: number
    userMessage: string
    cause?: unknown
  }) {
    super(opts.userMessage)
    this.name = 'AIProviderError'
    this.provider = opts.provider
    this.category = opts.category
    this.httpStatus = opts.httpStatus
    this.userMessage = opts.userMessage
    if (opts.cause) this.cause = opts.cause
  }

  /** Whether this error is transient and worth retrying with another provider */
  get isTransient(): boolean {
    return this.category === 'server' || this.category === 'timeout'
  }

  /** Whether all providers will fail the same way (don't cascade) */
  get isContentError(): boolean {
    return this.category === 'content'
  }
}

/**
 * Classify an HTTP error from an AI provider into a user-friendly category.
 */
export function classifyError(
  provider: AIProvider,
  httpStatus: number | undefined,
  errorBody: string | Record<string, any> | undefined,
  originalError?: unknown
): AIProviderError {
  const bodyStr = typeof errorBody === 'string'
    ? errorBody
    : errorBody ? JSON.stringify(errorBody) : ''
  const bodyLower = bodyStr.toLowerCase()

  // Timeout / abort
  if (
    originalError instanceof DOMException && originalError.name === 'AbortError' ||
    bodyLower.includes('timeout') ||
    bodyLower.includes('timed out') ||
    bodyLower.includes('aborted')
  ) {
    return new AIProviderError({
      provider,
      category: 'timeout',
      httpStatus,
      userMessage: `${provider}: Tiempo de espera agotado. Intenta de nuevo.`,
      cause: originalError,
    })
  }

  // Auth errors
  if (httpStatus === 401 || httpStatus === 403 || bodyLower.includes('invalid api key') || bodyLower.includes('unauthorized') || bodyLower.includes('forbidden')) {
    return new AIProviderError({
      provider,
      category: 'auth',
      httpStatus,
      userMessage: `${provider}: API key invalida o expirada. Verifica tu key en Settings.`,
      cause: originalError,
    })
  }

  // Quota / rate limit
  if (httpStatus === 402 || httpStatus === 429 || bodyLower.includes('quota') || bodyLower.includes('rate limit') || bodyLower.includes('insufficient') || bodyLower.includes('billing') || bodyLower.includes('exceeded') || bodyLower.includes('no credits') || bodyLower.includes('saldo')) {
    return new AIProviderError({
      provider,
      category: 'quota',
      httpStatus,
      userMessage: `${provider}: Sin saldo o limite de uso alcanzado. Recarga creditos en tu cuenta.`,
      cause: originalError,
    })
  }

  // Content / safety errors
  if (bodyLower.includes('safety') || bodyLower.includes('blocked') || bodyLower.includes('harmful') || bodyLower.includes('inappropriate') || bodyLower.includes('invalid prompt') || bodyLower.includes('content policy')) {
    return new AIProviderError({
      provider,
      category: 'content',
      httpStatus,
      userMessage: `${provider}: El contenido fue bloqueado por politicas de seguridad. Modifica tu prompt.`,
      cause: originalError,
    })
  }

  // Server errors
  if (httpStatus && httpStatus >= 500) {
    return new AIProviderError({
      provider,
      category: 'server',
      httpStatus,
      userMessage: `${provider}: Servidor no disponible (${httpStatus}). Intenta en unos minutos.`,
      cause: originalError,
    })
  }

  // Maintenance / KIE code 500
  if (bodyLower.includes('maintenance') || bodyLower.includes('mantenimiento')) {
    return new AIProviderError({
      provider,
      category: 'server',
      httpStatus,
      userMessage: `${provider}: En mantenimiento. Intenta en unos minutos.`,
      cause: originalError,
    })
  }

  // Unknown
  return new AIProviderError({
    provider,
    category: 'unknown',
    httpStatus,
    userMessage: `${provider}: Error inesperado${httpStatus ? ` (${httpStatus})` : ''}. ${bodyStr.substring(0, 100)}`,
    cause: originalError,
  })
}

/**
 * Wrap a raw error (from fetch, etc.) into an AIProviderError.
 * If it's already an AIProviderError, returns it as-is.
 */
export function wrapError(provider: AIProvider, err: unknown): AIProviderError {
  if (err instanceof AIProviderError) return err

  if (err instanceof DOMException && err.name === 'AbortError') {
    return classifyError(provider, undefined, undefined, err)
  }

  const message = err instanceof Error ? err.message : String(err)
  return classifyError(provider, undefined, message, err)
}

/**
 * Format a user-facing error message from an AIProviderError or generic error.
 */
export function formatUserError(err: unknown): string {
  if (err instanceof AIProviderError) return err.userMessage
  if (err instanceof Error) return err.message
  return String(err)
}

/**
 * Build a composite error message when all cascade providers failed.
 */
export function formatCascadeError(errors: AIProviderError[]): string {
  if (errors.length === 0) return 'No hay API keys configuradas. Configura al menos una en Settings.'

  const details = errors.map(e => `- ${e.userMessage}`).join('\n')
  return `Todos los proveedores fallaron:\n${details}`
}
