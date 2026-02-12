/**
 * Simple in-memory rate limiter for Next.js API routes.
 *
 * Usage:
 *   const limiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 })
 *   // In route handler:
 *   const { success } = limiter.check(ip)
 *   if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 })
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimiterOptions {
  maxRequests: number
  windowMs: number
}

export function createRateLimiter({ maxRequests, windowMs }: RateLimiterOptions) {
  const store: Record<string, RateLimitEntry> = {}

  // Cleanup stale entries periodically
  let lastCleanup = Date.now()
  function maybeCleanup() {
    const now = Date.now()
    if (now - lastCleanup < 60_000) return
    lastCleanup = now
    for (const key of Object.keys(store)) {
      if (store[key].resetAt < now) {
        delete store[key]
      }
    }
  }

  return {
    check(identifier: string): { success: boolean; remaining: number } {
      maybeCleanup()
      const now = Date.now()
      const entry = store[identifier]

      if (!entry || entry.resetAt < now) {
        store[identifier] = { count: 1, resetAt: now + windowMs }
        return { success: true, remaining: maxRequests - 1 }
      }

      if (entry.count >= maxRequests) {
        return { success: false, remaining: 0 }
      }

      entry.count++
      return { success: true, remaining: maxRequests - entry.count }
    },
  }
}

// Pre-configured limiters for common use cases
export const authLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 })
export const apiLimiter = createRateLimiter({ maxRequests: 30, windowMs: 60_000 })
export const aiLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000 })

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  return "unknown"
}
