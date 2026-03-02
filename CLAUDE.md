# CLAUDE.md — Estrategas IA Ecosystem

> **Read this ENTIRE file before making ANY code change. If you skip this, you WILL break something.**

## 1. Ecosystem Overview

Four repos, one shared Supabase, serving LATAM dropshippers (COD/contraentrega):

| Repo | Location | Stack | Deploy | Domain |
|------|----------|-------|--------|--------|
| **estrategas-landing-generator** | `C:\Users\Asus\estrategas-landing-generator\` | Next.js 14 + Supabase | Vercel | estrategasia.com |
| **shopiestrategas** (DropPage) | `C:\Users\Asus\Downloads\shopiestrategas\` | FastAPI + SQLAlchemy + 2 React/Vite frontends | Railway (backend) + Vercel x2 (admin + store) | constructor path + custom domains |
| **product-intelligence-dropi** | `C:\Users\Asus\Downloads\product-intelligence-dropi\` | FastAPI (single file) | Railway | Internal API |
| **fastmoss-sync** | `C:\Users\Asus\Documents\fastmoss-sync\` | Python cron script | Railway (daily 6AM UTC) | N/A |

### Cross-Repo Connections

```
estrategas-landing-generator (Supabase Auth + profiles table)
    |
    +-- shopiestrategas: reads encrypted API keys via estrategas.py bridge
    |   (tenant.email -> Supabase auth.users -> profiles -> AES-256-GCM decrypt)
    |   SSO: Supabase access token -> DropPage JWT
    |
    +-- product-intelligence-dropi: no direct connection (standalone R2 data)
    |
    +-- fastmoss-sync: writes to SEPARATE Supabase (papfcbiswvdgalfteujm.supabase.co)
        estrategas reads from it via HARDCODED credentials in product-research/page.tsx
```

### Shared Resources
- **Supabase project**: Auth + PostgreSQL + Storage (estrategas + DropPage share this)
- **Cloudflare R2**: Both estrategas and DropPage use R2 for media storage
- **KIE.ai**: Both repos use KIE for AI text/image/video (different cascade configs)
- **Encryption key**: Same `ENCRYPTION_KEY` (AES-256-GCM) for both repos. Format: `iv_hex:authTag_hex:ciphertext_hex`

---

## 2. estrategas-landing-generator (THIS REPO)

### Tech Stack
- Next.js 14.2.0 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- Supabase Auth (email + OTP), PostgreSQL via Supabase, Supabase Storage
- Cloudflare R2 (user-configured via BYOK), Vercel deployment
- BYOK model: Users store their own encrypted API keys in `profiles` table

### AI Service Architecture

#### Text Generation — `lib/services/ai-text.ts`
```
generateAIText(keys, options) -> string
  Cascade: KIE (gemini-2.5-flash, 90s timeout, reasoning_effort:'none')
        -> OpenAI (gpt-4o-mini, 90s timeout, response_format:json_object)
        -> Google Gemini direct (gemini-2.5-flash, 90s timeout, thinkingBudget:0)
  Key source: per-user from profiles table (encrypted) + env var fallbacks
  Caller puede override modelo: kieModel, googleModel (ej: gemini-2.5-pro)
  Todos los pasos tienen timeout 90s para que la cascada complete dentro de maxDuration.
  Google direct SIEMPRE usa thinkingBudget:0 para evitar thinking mode (100s+).

  Consumidores principales en Studio:
    copy-optimize (Textos IA): kieModel='gemini-2.5-pro', maxDuration=120
    prompt-generate (Prompt Video): default flash, maxDuration=30
    prompt-bot (Prompt Bot): default flash, maxDuration=30
    resena-ugc (Resena UGC): default flash, maxDuration=120
```
**15+ API routes depend on this service.** Change = test everything.

#### Image Generation — `lib/image-providers/index.ts`
```
generateImage(model, params) -> ImageResult
  CASCADA MODO-AWARE — detecta T2I vs I2I segun presencia de imagenes de referencia.
  Cada modelo define su propio `cascade` config en types.ts con endpoints T2I e I2I.

  9 modelos, 5 companias (Google, OpenAI, ByteDance, BFL, fal.ai)
  Modelos eliminados: seedream-3, seedream-4, seedream-4-4k, flux-2-klein

  Cascade config por modelo (en ImageModelConfig.cascade):
    cascade.kie   → { t2i, i2i?, mode } — KIE model IDs
    cascade.fal   → { t2i, i2i? }       — fal.ai full paths
    cascade.directApi → 'gemini' | 'openai' | 'bfl' — fallback final

  Tabla de cascada:
    | Modelo           | KIE T2I / I2I                          | fal T2I / I2I                          | Direct |
    | gemini-3-pro     | nano-banana-pro / (mismo)              | fal-ai/nano-banana-pro                 | gemini |
    | nano-banana-2    | nano-banana-2 / (mismo)                | fal-ai/nano-banana-2                   | gemini |
    | gpt-image-1.5    | gpt-image/1.5-t2i / 1.5-i2i           | fal-ai/gpt-image-1.5                   | openai |
    | seedream-4.5     | seedream/4.5-t2i / 4.5-edit            | bytedance/seedream/v4.5/t2i / edit     | —      |
    | seedream-5-lite  | seedream/5-lite-t2i / 5-lite-i2i       | bytedance/seedream/v5/lite/t2i / edit  | —      |
    | seedream-5       | seedream/5-lite-t2i / 5-lite-i2i       | fal-ai/seedream-3.0/pro                | —      |
    | flux-2-max       | (sin KIE)                              | fal-ai/flux-2-max / edit               | bfl    |
    | flux-2-pro       | flux-2/pro-t2i / pro-i2i               | fal-ai/flux-2-pro / edit               | bfl    |
    | flux-2-flex      | flux-2/flex-t2i / flex-i2i             | fal-ai/flux-2-flex / edit              | bfl    |

  Flujo de ejecucion:
    1. OpenAI directo PRIMERO (solo si cascade.directApi === 'openai')
    2. KIE (si cascade.kie existe y hay key) — elige T2I o I2I segun hasImages
    3. fal.ai (si cascade.fal existe y hay key) — elige T2I o I2I segun hasImages
    4. Direct API fallback (gemini o bfl, segun cascade.directApi)

  Input de imagenes en KIE (segun cascade.kie.mode):
    nano-banana (Flash/Pro): image_input + resolution:'1K'
    seedream: image_urls + quality:'basic'
    gpt-image: image_input

  Studio IA temp images:
    Siempre sube imagenes a Supabase Storage (temp/{userId}/...)
    Genera URLs publicas para KIE/fal.ai
    Limpieza fire-and-forget al final

  Errores: siempre en espanol simple (humanizeErrors), sin JSON ni IDs de modelo.
  Providers: gemini.ts | openai.ts | kie-seedream.ts | bfl-flux.ts | fal.ts
  Clasificacion errores: lib/services/ai-errors.ts (auth, quota, server, timeout)
  Tipos: lib/image-providers/types.ts
  Monitoreo: lib/services/ai-monitor.ts (fire-and-forget logAI() en cada intento)
```

#### Video Generation — `lib/video-providers/kie-video.ts`
```
ALL video models route through KIE.ai with fal.ai cascade fallback.
  Veo endpoint: /api/v1/veo/generate (Google Veo 3.1 models)
  Extend endpoint: /api/v1/veo/extend (extend Veo videos, requires original taskId)
  Standard: /api/v1/jobs/createTask (Kling, Sora, Hailuo, Seedance, Wan)
  Cascade: KIE -> fal.ai (mode-aware: T2V vs I2V from model.fal config)
  13 models across 6 companies

  Models and fal.ai cascade:
    | Model           | KIE T2V / I2V                              | fal T2V / I2V                                  |
    | veo-3.1         | veo3 (special /veo/generate)                | fal-ai/veo3.1 / first-last-frame-to-video      |
    | veo-3.1-fast    | veo3_fast (special /veo/generate)            | fal-ai/veo3.1/fast / image-to-video             |
    | kling-3.0       | kling-3.0/video                              | — / fal-ai/kling-video/v3/pro/image-to-video   |
    | kling-2.6       | kling-2.6/text-to-video / image-to-video     | (no fal)                                        |
    | kling-v25-turbo | kling/v2-5-turbo-*-pro                       | fal-ai/kling-video/v2.5-turbo/pro/*            |
    | sora-2          | sora-2-text/image-to-video                   | fal-ai/sora-2/* + v2v remix                    |
    | hailuo-2.3-pro  | hailuo/2-3-image-to-video-pro                | — / fal-ai/minimax/hailuo-02/pro/i2v           |
    | hailuo-2.3-std  | hailuo/2-3-image-to-video-standard           | — / fal-ai/minimax/hailuo-02/standard/i2v      |
    | seedance-2      | bytedance/seedance-2-text/image-to-video     | (no fal)                                        |
    | seedance-1.5-pro| bytedance/seedance-1.5-pro                   | fal-ai/bytedance/seedance/v1.5/pro/t2v         |
    | seedance-1.0-fast| bytedance/v1-pro-fast-image-to-video        | fal-ai/bytedance/seedance/v1/pro/i2v           |
    | wan-2.6         | wan/2-6-text/image-to-video                  | (no fal)                                        |
    | wan-2.5         | wan/2-5-text/image-to-video                  | (no fal)                                        |

  Veo Extend: only veo-3.1 and veo-3.1-fast (supportsExtend: true)
    Requires original taskId from KIE generation
    API route: /api/studio/extend-video

  Types: lib/video-providers/types.ts
  fal fallback: lib/video-providers/fal-video.ts
```

#### Audio Generation — `lib/audio-providers/`
```
ElevenLabs: elevenlabs.ts (3 models)
Google Gemini TTS: google-tts.ts (gemini-2.5-flash-preview-tts, 5 voices)
No cascade — user selects provider. Types: lib/audio-providers/types.ts
```

#### Herramientas IA — `app/api/studio/tools/route.ts`
```
9 herramientas en la pestaña Herramientas del Studio.
Cascade real multi-proveedor (no solo fallback de key).
Gemini image calls tienen timeout 90s.
KIE/fal.ai necesitan URLs publicas → upload temp a Supabase Storage si Gemini falla.

  | Herramienta      | Cascade (orden de intento)                           |
  | Variaciones      | Google Gemini → KIE nano-banana-pro → fal.ai nano-banana-pro |
  | Mejorar Imagen   | Google Gemini → KIE nano-banana-pro → fal.ai nano-banana-pro |
  | Cambiar Angulo   | Google Gemini → KIE nano-banana-pro → fal.ai nano-banana-pro |
  | Mockup Generator | Google Gemini → KIE nano-banana-pro → fal.ai nano-banana-pro |
  | Quitar Fondo     | BFL flux-kontext-pro → fal.ai birefnet/v2            |
  | Lip Sync         | KIE user key → KIE platform key (solo KIE soporta)   |
  | Deep Face        | KIE user key → KIE platform key (solo KIE soporta)   |
  | Prompt Video     | ai-text cascade KIE→OpenAI→Google (ADMIN ONLY)       |
  | Prompt Bot       | ai-text cascade KIE→OpenAI→Google (ADMIN ONLY)       |
  | Descriptor       | ai-text cascade x2 paralelo (gemini-2.5-pro)         |

  Timeouts: Gemini 90s, KIE poll 60s, fal.ai poll 45s. maxDuration: 120s (vercel.json).
  Temp images: upload solo si Gemini falla, cleanup fire-and-forget al final.
  Keys: user BYOK → platform env var (para cada proveedor en la cascade).

  Prompt Video y Prompt Bot: bloqueados con "Próximamente" para usuarios.
  Solo trucosecomydrop@gmail.com puede usarlos (check en UI + API route).
```

#### Landing IA Multi-Agent — `lib/landing-ia/`
```
4 parallel agents via SSE streaming (/api/landing-ia/stream):
  hero-agent.ts -> hero + banner_oferta sections
  testimonios-agent.ts -> testimonios + confianza
  antes-agent.ts -> antes_despues + modo_uso
  faqs-agent.ts -> faq + beneficios + tabla_comparativa
All use generateAIText() internally
```

### Banner Generator Flow — `/dashboard/landing/[id]`

Three interconnected routes — two for TEXT, one for IMAGE:

```
1. enhance-prompt/route.ts — "Mejorar con IA"
   System prompt: ~1,100 lines (SACRED — DO NOT MODIFY)
   Uses: generateAIText() cascade (KIE gemini-2.5-pro, temp 0.8)
   Input: template image + product photos + name + context
   Output: fills 4 Creative Controls + 2 variants each
     - productDetails (max 500 chars)
     - salesAngle (max 150 chars)
     - targetAvatar (max 150 chars)
     - additionalInstructions (max 200 chars)

2. generate-angles/route.ts — "Generar Ángulos"
   System prompt: ~1,100 lines (SACRED — DO NOT MODIFY)
   Uses: generateAIText() cascade (KIE gemini-2.5-flash, temp 0.9)
   Input: product photos + name + context + country
   Output: 6 diversified sales angles (Transformation, Pain, Authority,
           Urgency, Comparison, Aspirational, Social Proof, Curiosity)
   Each angle: id, name, hook, description, avatarSuggestion, tone, salesAngle

3. generate-landing/route.ts — "Generar Banners"
   Takes: Creative Controls + angle data → injects into image prompt
   Uses: image provider router (index.ts) with cascade
   Runs: for each (angle × section) combination
   Creative Controls text is embedded INTO the image generation prompt
```

Flow: enhance-prompt fills controls → generate-angles creates angles
→ user selects 1-4 angles → generate-landing creates images per angle×section

### Dashboard Pages & Their API Dependencies

| Page | Path | Key API Routes |
|------|------|----------------|
| Home | `/dashboard` | Server-side: profiles, generations |
| Banner Generator | `/dashboard/landing/[id]` | generate-landing, edit-section, enhance-prompt, generate-angles, templates, sections, share |
| Image Generator (legacy) | `/dashboard/generate` | generate (uses @google/generative-ai SDK directly) |
| Studio Creativo | `/dashboard/studio` | studio/* (image, video, audio, tools, influencer/*, clone-viral/*, automations/*, prompt-bot, copy-optimize, resena-ugc) |
| Landing IA | `/dashboard/landing-ia` | landing-ia/scrape, landing-ia/stream, landing-ia/draft/* |
| Product Research | `/dashboard/product-research` | productos/search (DropKiller), FastMoss (hardcoded Supabase) |
| Coaching | `/dashboard/coaching` | coaching/mentors, coaching/availability, coaching/bookings |
| Settings | `/dashboard/settings` | keys (BYOK management) |
| Lucio | `/dashboard/lucio` | WebSocket to LUCIO_URL (OpenClaw gateway, client.id='openclaw-control-ui') |
| Gallery | `/dashboard/gallery` | None (YouTube embeds) |
| Admin Templates | `/dashboard/admin/templates` | admin/templates/upload, admin/templates/delete |

### Supabase Tables (this repo)

profiles, templates, products, landing_sections, generations, allowed_emails, landing_ia_drafts, influencers, influencer_gallery, automation_flows, automation_runs, coaching_mentors, coaching_availability, coaching_bookings, import_bundles. Storage bucket: `landing-images`.

### Environment Variables (critical subset)

| Variable | Purpose | Impact if missing |
|----------|---------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client | Everything breaks |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin (bypasses RLS) | All API routes break |
| `ENCRYPTION_KEY` | AES-256-GCM for BYOK keys | Can't decrypt any user API key |
| `CRON_SECRET` | Vercel cron auth | Automations cron fails |
| `NEXT_PUBLIC_LUCIO_URL` + `NEXT_PUBLIC_LUCIO_TOKEN` | Lucio chatbot | Lucio page won't connect |
| Platform fallback keys: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `KIE_API_KEY`, `BFL_API_KEY`, `ELEVENLABS_API_KEY` | Fallback when user has no BYOK key | AI features degrade |
| `BROWSERLESS_API_KEY`, `APIFY_API_TOKEN` | Competitor analysis | Competitor features break |
| `CANVA_CLIENT_ID` + `CANVA_CLIENT_SECRET` | Canva OAuth | Canva integration breaks |
| `RESEND_API_KEY` | Email notifications | Coaching emails fail |

---

## 3. shopiestrategas (DropPage)

### Architecture
```
backend/          FastAPI + SQLAlchemy async, PostgreSQL schema "minishop"
frontend-admin/   React 19 + Vite 7 + Tailwind 4 + GrapeJS (base path: /constructor)
frontend-store/   React 19 + Vite 7 + Tailwind 4 (slug resolved dynamically)
```

### Backend Key Facts
- **Database**: PostgreSQL with schema `minishop`, 21+ tables, all UUID PKs
- **Models**: SQLAlchemy 2.0 style (`Mapped[]` + `mapped_column()`)
- **Multi-tenancy**: Every table has `tenant_id` FK to `tenants.id`
- **Auth**: JWT (access + refresh tokens), SSO from Supabase, OTP via Supabase GoTrue
- **Migrations**: Inline in `main.py` lifespan (NOT Alembic) — raw ALTER TABLE statements
- **Auto-create**: `Base.metadata.create_all()` in lifespan creates new tables automatically
- **CORS**: `allow_origins=["*"]`, `allow_credentials=False` (stores use custom domains)
- **Routes**: use `""` not `"/"` to avoid 307 redirects behind HTTPS proxies

### DropPage AI Services

#### Text — `backend/app/services/ai_text.py`
```
generate_text(prompt, system_prompt, tenant, db) -> str
  Key resolution: Supabase profiles -> env vars -> store_configs
  Cascade: KIE (gemini-2.5-flash -> gemini-2.5-pro -> gemini-3-pro, 5s/model)
        -> OpenAI (gpt-4o-mini)
        -> Gemini direct (gemini-2.5-flash)
  Consumers: voice_ai.py, pages.py, ai.py, section_content.py, review_images.py
```

#### Images — `backend/app/services/ai_image.py`
```
create_image(prompt, tenant, db) -> task_id
poll_image(task_id, tenant, db) -> image_url
  Cascade: KIE/Seedream 4.5 (async) -> OpenAI DALL-E 3 (sync)
  Consumer: review_images.py
```

#### Key Bridge — `backend/app/services/estrategas.py`
```
tenant.email -> Supabase auth.users -> profiles table -> decrypt AES-256-GCM
5-minute in-memory cache. Batch fetch (2 HTTP calls).
Functions: get_all_keys(), get_gemini_key(), get_elevenlabs_key(), get_kie_key(), get_openai_key()
```

### DropPage Critical Models
Tenant, TenantDomain, Product, ProductImage, ProductVariant, Order, OrderItem, StoreConfig, CheckoutConfig, QuantityOffer, QuantityOfferTier, StorePage, AbandonedCart, Customer, StoreApp, PageDesign, Upsell, UpsellConfig, UpsellTick, Downsell, VoiceAssistant, VoiceConversation, VoiceMessage, VoiceInsight.

### DropPage Environment Variables (backend)
DATABASE_URL, SECRET_KEY, R2_*, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY, GEMINI_API_KEY, OPENAI_API_KEY, KIE_API_KEY, GOOGLE_MAPS_API_KEY, VERCEL_TOKEN, VERCEL_PROJECT_ID, SENTRY_DSN.

---

## 4. product-intelligence-dropi

Single-file FastAPI at `backend/main.py` (338 lines). Downloads ZIP from Cloudflare R2, serves product data from memory. 8 GET endpoints, zero auth, zero rate limiting, no database. Standalone — no connection to other repos.

## 5. fastmoss-sync

Python cron (daily 6AM UTC). Scrapes FastMoss API with cookie-based auth, upserts to **separate** Supabase project (`papfcbiswvdgalfteujm.supabase.co`) table `fastmoss_products`. Consumer: `product-research/page.tsx` reads with **hardcoded** Supabase URL + publishable key.

---

## 6. IMPACT MAPS — If You Change X, Check Y

### 6.1 AI Text Service (`lib/services/ai-text.ts`)
```
BREAKS: Landing IA (stream, scrape), generate-angles, enhance-prompt, edit-section,
        coaching (if it uses AI), studio/prompt-bot, studio/prompt-generate,
        studio/copy-optimize, studio/resena-ugc, studio/clone-viral/*,
        studio/influencer/analyze, studio/influencer/visual-analysis,
        studio/influencer/video-constructor, landing-ia/agents/*,
        browserless.ts (uses Google Gemini for vision)
```

### 6.2 Image Providers (`lib/image-providers/`)
```
index.ts change BREAKS: generate-landing, edit-section, studio/generate-image
types.ts change BREAKS: ALL image UIs (studio, landing, generate pages)
Individual provider change: only that provider's models affected
```

### 6.3 Video Providers (`lib/video-providers/`)
```
kie-video.ts BREAKS: studio/generate-video, studio/video-status, studio/extend-video
types.ts BREAKS: studio video UI model selector, automation presets
```

### 6.4 Audio Providers (`lib/audio-providers/`)
```
BREAKS: studio/generate-audio, studio/voices, studio/resena-ugc
```

### 6.5 Encryption (`lib/services/encryption.ts`)
```
BREAKS: ALL BYOK keys for ALL users. NEVER modify without explicit owner approval.
Same key used by DropPage (backend/app/services/estrategas.py).
```

### 6.6 Supabase Auth (`lib/supabase/`, `middleware.ts`)
```
BREAKS: Every page, every API route, every auth check.
middleware.ts has 3s timeout to prevent MIDDLEWARE_INVOCATION_TIMEOUT.
```

### 6.7 DropPage ai_text.py (`backend/app/services/ai_text.py`)
```
BREAKS: voice_ai.py (voice sales), pages.py (legal policies),
        ai.py (upsell text), section_content.py (14 section types),
        review_images.py (review prompts)
```

### 6.8 DropPage estrategas.py (`backend/app/services/estrategas.py`)
```
BREAKS: ALL AI features in DropPage (key resolution for every AI call)
```

---

## 7. CRITICAL FILES — Risk Levels

### estrategas-landing-generator

| File | Risk | Reason |
|------|------|--------|
| `lib/services/encryption.ts` | MAXIMUM | Breaks ALL user API keys if changed |
| `middleware.ts` | MAXIMUM | Breaks ALL auth and route protection |
| `lib/supabase/server.ts` | MAXIMUM | Every API route uses createClient() |
| `lib/supabase/middleware.ts` | MAXIMUM | Core auth, session refresh, security headers |
| `lib/services/ai-text.ts` | HIGH | 15+ API routes depend on this |
| `lib/image-providers/index.ts` | HIGH | Central image router with KIE cascade |
| `lib/image-providers/types.ts` | HIGH | Model definitions used by all image UIs |
| `lib/video-providers/types.ts` | HIGH | Video model configs for studio |
| `lib/rate-limit.ts` | HIGH | Rate limiting for AI routes |
| `lib/auth/cron-auth.ts` | HIGH | Cron + API auth bypass pattern |
| `app/(dashboard)/layout.tsx` | HIGH | Dashboard sidebar, nav, auth check |
| `app/api/keys/route.ts` | HIGH | BYOK key management |
| `lib/services/r2-upload.ts` | HIGH | All file uploads |
| `vercel.json` | MEDIUM | Cron schedule, function timeouts, MiniShop rewrites |

### shopiestrategas

| File | Risk | Reason |
|------|------|--------|
| `backend/app/main.py` | MAXIMUM | App creation, ALL inline migrations, router registration |
| `backend/app/services/estrategas.py` | MAXIMUM | BYOK key decryption bridge |
| `backend/app/config.py` | HIGH | All env vars and settings |
| `backend/app/api/deps.py` | HIGH | JWT auth dependency for ALL admin routes |
| `backend/app/database.py` | HIGH | Engine, session, schema="minishop" |
| `backend/app/models/__init__.py` | HIGH | All model imports; missing = create_all breaks |
| `backend/app/services/ai_text.py` | HIGH | All AI text consumers |
| `backend/app/utils/security.py` | HIGH | JWT creation/verification, password hashing |
| `frontend-admin/src/api/client.js` | HIGH | Axios with JWT interceptor + SSO auto-retry |
| `frontend-store/src/hooks/useStore.js` | HIGH | Slug resolution for entire store |
| `frontend-store/src/pages/Checkout.jsx` | HIGH | Full checkout + upsells + downsells + tracking |
| `backend/app/api/store/checkout.py` | HIGH | Order creation, webhooks, server tracking |

---

## 8. RULES

### NEVER do:
1. **NEVER** modify `encryption.ts` or `estrategas.py` decryption without explicit owner approval — invalidates ALL existing keys
2. **NEVER** change one AI service without checking the impact map (Section 6)
3. **NEVER** modify `middleware.ts` without testing all auth flows
4. **NEVER** add direct AI API calls — use centralized services (`ai-text.ts` / `ai_text.py`)
5. **NEVER** modify `types.ts` in any provider directory without updating all consumers
6. **NEVER** change Supabase schema without backup
7. **NEVER** remove API endpoints without verifying no frontend uses them
8. **NEVER** use `"/"` in FastAPI routes — use `""` to avoid 307 redirects
9. **NEVER** modify the system prompts in `enhance-prompt/route.ts` or `generate-angles/route.ts` — these are hand-tuned, battle-tested prompts (~1,100 lines each) that produce exceptional banner results. Only touch cascade/infrastructure code around them.

### ALWAYS do:
1. **ALWAYS** check the impact map before touching any service file
2. **ALWAYS** run `npm run build` after changes (TypeScript catches many issues)
3. **ALWAYS** update `types.ts` when adding a new model to any provider
4. **ALWAYS** follow the provider pattern: types.ts -> provider.ts -> index.ts (router) -> UI
5. **ALWAYS** use per-user keys from profiles table (BYOK), not hardcoded keys
6. **ALWAYS** add `reasoning_effort: 'none'` for KIE calls and `thinkingBudget: 0` for Google direct to prevent timeout cascades (Google Gemini has thinking mode ON by default)

### Known Anti-Patterns (things that have broken production):
- Changing AI API in one route but not others (e.g., Landing IA updated but Coaching forgotten)
- Adding a model without updating types.ts → UI breaks
- Google enabling "thinking mode" by default → 100s+ responses → timeout cascade → 504s. Fixed with reasoning_effort:'none' (KIE) and thinkingBudget:0 (Google direct)
- KIE model cascade with slow models (gemini-2.5-pro) → total time exceeds Vercel 120s limit. Only use gemini-2.5-flash in KIE cascade for estrategas
- Wrong client.id for Lucio WebSocket → "missing scope" errors. Must use 'openclaw-control-ui'

---

## 9. ADDING NEW FEATURES — Patterns to Follow

### Adding a new image model:
1. Update `lib/image-providers/types.ts` (add to IMAGE_MODELS, company groups)
2. Create or update provider file in `lib/image-providers/`
3. Register in `lib/image-providers/index.ts` (router)
4. Update UI model selector components
5. Add BYOK key in Settings if new provider

### Adding a new API route:
1. Create route in `app/api/your-route/route.ts`
2. Use `createClient()` from `lib/supabase/server.ts` for auth
3. Use `getAIKeys()` + `generateAIText()` for any AI text needs
4. Add `aiLimiter` rate limiting for AI-heavy routes
5. Verify auth: `supabase.auth.getUser()` must return valid user

### Adding a new DropPage admin endpoint:
1. Create route file in `backend/app/api/admin/`
2. Use `require_active_tenant` dependency for auth
3. Prefix: `/api/admin/your-endpoint`
4. Use `""` not `"/"` for route paths
5. Register router in `backend/app/main.py`
6. If AI needed: use `generate_text()` from `backend/app/services/ai_text.py`

### Adding a new DropPage model:
1. Create model in `backend/app/models/your_model.py`
2. Import in `backend/app/models/__init__.py` (REQUIRED for create_all)
3. Include `tenant_id` column with FK to tenants.id
4. Use `Mapped[]` + `mapped_column()` (SA 2.0 style)
5. `Base.metadata.create_all()` will auto-create the table on next startup

---

## 10. KNOWN ISSUES (audit findings, not yet fixed)

### estrategas-landing-generator
- **FastMoss hardcoded credentials**: `product-research/page.tsx` has hardcoded Supabase URL + key for FastMoss
- **Admin email hardcoded**: `trucosecomydrop@gmail.com` in 5+ files, should be env var
- **Missing auth on 4 routes**: `/api/productos/search`, `/api/image-proxy`, `/api/landing-ia/proxy-image`, `/api/studio/voices`
- **Missing rate limiting on most AI routes**: Only 4 of 15+ AI routes use aiLimiter
- **Open image proxies**: image-proxy and landing-ia/proxy-image could be used for SSRF
- **Duplicate services**: `lib/services/gemini.ts` and `lib/services/google-ai.ts` have overlapping code
- **Dead code**: `lib/services/nanoBanana.ts` (never imported)
- **authLimiter exported but never used** in rate-limit.ts

### shopiestrategas
- **CRITICAL: Missing thinking mode fix**: `backend/app/services/ai_text.py` does NOT have `reasoning_effort:'none'` (KIE) or `thinkingBudget:0` (Gemini direct). Same bug that broke estrategas generate-angles. Will cause slow/timeout responses as Google Gemini has thinking ON by default.
- **ElevenLabs key exposed**: `store/voice.py` returns elevenlabs_api_key to public frontend
- **Order number race condition**: Uses COUNT(*)+1 instead of DB sequence
- **OTP debug endpoint** (`/auth/otp/debug`) in production
- **Emergency password endpoint** with shared SECRET_KEY
- **Inline migrations** (~500 lines of ALTER TABLE in main.py lifespan)
- **Supabase user lookup iterates all users** (no filter query) — degrades with scale
- **No DB indexes declared** on frequently-queried columns
- **Redis in docker-compose but unused** in codebase

### product-intelligence-dropi
- Zero auth, zero rate limiting on all endpoints
- Debug endpoint in production
- Hardcoded R2 URL

### fastmoss-sync
- Schema mismatch: commission_rate stored as "13%" string vs DECIMAL column
- Hardcoded credentials in consumer (product-research/page.tsx)
- No stale data cleanup

---

## 11. EXTERNAL SERVICES QUICK REFERENCE

| Service | Used By | API Base | Auth Type |
|---------|---------|----------|-----------|
| KIE.ai | Both repos | `api.kie.ai` | Per-user BYOK key |
| Google Gemini | Both repos | `generativelanguage.googleapis.com/v1beta` | Per-user BYOK + platform fallback |
| OpenAI | Both repos | `api.openai.com/v1` | Per-user BYOK + platform fallback |
| BFL/FLUX | estrategas only | `api.bfl.ai/v1` | Per-user BYOK |
| fal.ai | Both repos | `queue.fal.ai` | Per-user BYOK (profiles.fal_api_key) |
| ElevenLabs | Both repos | `api.elevenlabs.io/v1` | Per-user BYOK + platform fallback |
| Cloudflare R2 | Both repos | `{accountId}.r2.cloudflarestorage.com` | Per-user BYOK (estrategas) / env vars (DropPage) |
| Supabase | Both repos | env var | Service role key |
| Publer | estrategas only | `app.publer.com/api/v1` | Per-user BYOK |
| Canva | estrategas only | `api.canva.com/rest/v1` | Platform OAuth |
| Browserless | estrategas only | `chrome.browserless.io` | Platform API key |
| Apify | estrategas only | Apify API | Platform API token |
| DropKiller | estrategas only | `app.dropkiller.com` | User-provided cookies |
| Dropi | DropPage only | Dropi API | Per-tenant token |
| Resend | estrategas only | Resend API | Platform API key |
| Lucio/OpenClaw | estrategas only | WebSocket (env var) | Token auth |
| Vercel API | DropPage only | Vercel API | Platform token |
| FastMoss Supabase | fastmoss-sync writes, estrategas reads | `papfcbiswvdgalfteujm.supabase.co` | Hardcoded keys |

---

## 12. VERCEL CONFIG (vercel.json)

Key entries: cron schedule for `/api/cron/automations`, function maxDuration settings, rewrites for `/constructor*` -> shopiestrategas Vercel project (DropPage admin), rewrites for `/tienda*` -> shopiestrategas store Vercel project.

---

*Last updated: 2026-02-27 — Generated from file-by-file audit of all 4 repositories*
