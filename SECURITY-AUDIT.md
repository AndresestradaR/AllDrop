# Security Audit — Estrategas Landing Generator

**Date:** 2026-02-12
**Auditor:** Claude Code (automated)

---

## 2.2 Environment Variables & Secrets

### Status: PASS

**Findings:**
- All secrets loaded from environment variables via `process.env`
- Supabase credentials: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public), `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- API keys encrypted in database with AES-256-GCM (`ENCRYPTION_KEY`), decrypted server-side only
- Canva OAuth: uses PKCE flow, tokens stored in httpOnly/secure/sameSite cookies
- Apify/Browserless keys: server-side only via `process.env`
- No hardcoded API keys or secrets found in source code
- `.gitignore` properly excludes `.env`, `.env.local`, `.env.*.local`
- Client-side code never exposes private keys (only `NEXT_PUBLIC_*` vars)
- API key masking in UI: only last 4 characters shown

**Actions taken:**
- Added missing `APIFY_API_TOKEN` and `BROWSERLESS_API_KEY` to `.env.example`

**Production checklist:**
- [ ] Verify `ENCRYPTION_KEY` matches the one used in DropPage backend
- [ ] Set strong `SUPABASE_SERVICE_ROLE_KEY` (never expose to client)
- [ ] Configure Canva OAuth redirect URI for production domain
- [ ] Ensure all `NEXT_PUBLIC_*` vars contain only public-safe values

---

## 2.4 Rate Limiting

### Status: IMPLEMENTED

**In-memory rate limiter (`lib/rate-limit.ts`):**
- AI endpoints (generate-landing, enhance-prompt, edit-section): 10 req/min per IP
- Uses plain object store with lazy cleanup (no setInterval in serverless)
- 429 response with Spanish error message

**Files:**
- `lib/rate-limit.ts` — createRateLimiter factory + pre-configured limiters
- `app/api/generate-landing/route.ts` — aiLimiter applied
- `app/api/enhance-prompt/route.ts` — aiLimiter applied
- `app/api/edit-section/route.ts` — aiLimiter applied

## 2.5 Security Headers & CORS

### Status: IMPLEMENTED

**Security headers (via Next.js middleware):**
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()

**Middleware matcher expanded** to cover all routes (not just auth pages).
