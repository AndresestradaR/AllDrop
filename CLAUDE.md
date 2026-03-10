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

  8 modelos, 4 companias (Google, OpenAI, ByteDance, BFL)
  Modelos eliminados: seedream-3, seedream-4, seedream-4-4k, seedream-4.5, flux-2-klein
  fal.ai es proveedor de infraestructura (multi-provider), NO es compania dueña de modelos

  Cascade config por modelo (en ImageModelConfig.cascade):
    cascade.kie   → { t2i, i2i?, mode } — KIE model IDs
    cascade.fal   → { t2i, i2i? }       — fal.ai full paths
    cascade.directApi → 'gemini' | 'openai' | 'bfl' — fallback final

  Tabla de cascada:
    | Modelo           | Compania  | KIE T2I / I2I                    | fal T2I / I2I                          | Direct |
    | gemini-3-pro     | Google    | nano-banana-pro / (mismo)        | fal-ai/nano-banana-pro                 | gemini |
    | nano-banana-2    | Google    | nano-banana-2 / (mismo)          | fal-ai/nano-banana-2                   | gemini |
    | gpt-image-1.5    | OpenAI    | gpt-image/1.5-t2i / 1.5-i2i     | fal-ai/gpt-image-1.5                   | openai |
    | seedream-5-lite  | ByteDance | seedream/5-lite-t2i / 5-lite-i2i | bytedance/seedream/v5/lite/t2i / edit  | —      |
    | seedream-5       | ByteDance | seedream/5-lite-t2i / 5-lite-i2i | fal-ai/seedream-3.0/pro                | —      |
    | flux-2-max       | BFL       | (sin KIE)                        | fal-ai/flux-2-max / edit               | bfl    |
    | flux-2-pro       | BFL       | flux-2/pro-t2i / pro-i2i         | fal-ai/flux-2-pro / edit               | bfl    |
    | flux-2-flex      | BFL       | flux-2/flex-t2i / flex-i2i       | fal-ai/flux-2-flex / edit              | bfl    |

  Flujo de ejecucion:
    1. OpenAI directo PRIMERO (solo modelos GPT Image)
    2. KIE principal (mas barato) — elige T2I o I2I segun hasImages
    3. fal.ai fallback de KIE — elige T2I o I2I segun hasImages
    4. Direct API ultimo fallback (Gemini o BFL — mas caro)

  Hard timeout con withTimeout() — Promise.race en CADA paso de la cascada:
    Cada paso tiene budget proporcional al tiempo restante:
      OpenAI: min(remaining*0.35, 30s)
      KIE: min(remaining*0.45, 40s) + 2s grace
      fal.ai: min(remaining - directReserve, 50s), min 15s + 2s grace
      Direct API: remaining - 2s, min 10s
    Si fetch() se cuelga (KIE polling infinito, fal.ai lento), withTimeout() lo MATA
    y la cascada continua al siguiente paso. Sin esto → Vercel mata la funcion a 120s → 504.
    NUNCA quitar withTimeout() de ningun paso. NUNCA confiar en soft timeouts (loops/counters).
    hasTime() verifica que queda tiempo antes de iniciar cada paso.

  Input de imagenes en KIE (segun cascade.kie.mode):
    nano-banana (Flash/Pro): image_input + resolution:'1K'
    seedream: image_urls + quality:'basic'
    gpt-image: image_input

  Studio IA temp images (referencia para cascade):
    Siempre sube imagenes a Supabase Storage (temp/{userId}/...)
    Genera URLs publicas para KIE/fal.ai
    Limpieza fire-and-forget al final

  Studio IA image persistence (generadas):
    Las imagenes generadas DEBEN sobrevivir refresh de pagina. Flujo:
    1. Genera imagen → base64 → se muestra inmediato en UI (SIEMPRE base64, nunca URL)
    2. Intenta R2 (user's Cloudflare) → SI tiene publicUrl → guarda R2 URL
       SI NO tiene publicUrl → retorna null (archivo sube como backup pero URL no sirve)
       NUNCA retornar URL del endpoint S3 (bucket.accountId.r2.cloudflarestorage.com) → requiere auth → 400
    3. SIEMPRE sube a Supabase Storage (studio/{userId}/...) como fallback garantizado
    4. Guarda en tabla `generations`: product_name='Studio: {modelName}',
       generated_image_url = R2 URL si existe, o "storage:{path}" si no
    5. Al recargar pagina: useEffect carga de `generations` table:
       - URL con "storage:" → extrae path → crea signed URL (24h, se renueva cada carga)
       - URL con "supabase" + "/landing-images/" → legacy → signed URL
       - URL https:// normal → R2 URL → carga directa
    6. Boton eliminar: borra de UI + DELETE de tabla generations
    7. Descarga: fetch como blob → URL.createObjectURL → <a download> (cross-origin fix)

  Studio IA video persistence (generados):
    Videos TAMBIEN sobreviven refresh. Mismo patron que imagenes pero con diferencias:
    1. Backend (video-status): cuando polling detecta status=completed, guarda en `generations`:
       - product_name='Video: {modelName}'
       - generated_image_url = R2 URL (tryUploadUrlToR2) o KIE URL directo
       - enhanced_prompt = "ar:{aspectRatio}|tid:{taskId}" (metadata para UI)
    2. Frontend (VideoGenerator.tsx): useEffect carga de generations WHERE product_name LIKE 'Video:%'
       - Parsea enhanced_prompt para extraer aspectRatio (ar:9:16) y taskId (tid:abc123)
       - Videos sin metadata legacy: aspectRatio default 16:9, sin taskId
    3. Galeria adaptativa: videos verticales (9:16) → max-w-200px tipo telefono,
       horizontales (16:9) → ancho completo, cuadrados (1:1) → 48%
    4. Botones siempre visibles debajo del video (NO hover overlay — <video controls> captura mouse):
       - Compartir | Descargar (blob) | Extender (solo Veo) | Eliminar (UI + DB)
    5. Video element usa object-contain + bg-black (respeta aspect ratio sin recortar)

  Veo Extend (boton FastForward en galeria):
    Solo aparece para videos Veo 3.1 y Veo 3.1 Fast que tienen taskId guardado.
    - Usa prompt del campo de texto si el usuario escribio algo nuevo, sino prompt original
    - Llama a /api/studio/extend-video con {taskId, prompt, model: 'veo3'|'veo3_fast'}
    - KIE continua desde el ultimo frame del video original
    - El video extendido se agrega como nuevo item "(ext)" en la galeria
    - El video extendido TAMBIEN se puede extender de nuevo (tiene su propio taskId)
    - Requisito: solo funciona con videos generados via KIE (no fal.ai — fal no da taskId)

  REGLAS CRITICAS de persistencia Studio IA (imagenes Y videos):
    - NUNCA usar persistedUrl/publicUrl para mostrar imagen recien generada → SIEMPRE base64
    - NUNCA retornar URL del S3 API de R2 como URL publica → SIEMPRE 400 sin auth
    - NUNCA usar <a download> con URLs cross-origin → browser NAVEGA en vez de descargar
    - SIEMPRE subir a Supabase Storage como fallback para imagenes (R2 opcional, Storage garantizado)
    - SIEMPRE usar signed URLs para cargar de Storage (bucket puede no ser publico)
    - SIEMPRE usar createServiceClient() para INSERT en generations (bypassa RLS)
    - NUNCA poner botones de accion en hover overlay sobre <video controls> → controles nativos capturan mouse
    - SIEMPRE guardar aspectRatio y taskId en enhanced_prompt con formato "ar:{ratio}|tid:{id}"

  Errores: siempre en espanol simple (humanizeErrors), sin JSON ni IDs de modelo.
  Providers: gemini.ts | openai.ts | kie-seedream.ts | bfl-flux.ts | fal.ts
  Clasificacion errores: lib/services/ai-errors.ts (auth, quota, server, timeout)
  Tipos: lib/image-providers/types.ts
  Monitoreo: lib/services/ai-monitor.ts (fire-and-forget logAI() en cada intento)

  Direct API fallback — campo `directModelId` en cascade config:
    Cada modelo especifica el ID exacto para su API directa (Google/OpenAI/BFL).
    nano-banana-2 → directModelId: 'gemini-3.1-flash-image-preview'
    gemini-3-pro-image → directModelId: 'gemini-3-pro-image-preview'
    PROHIBIDO: gemini-2.5-flash-image — NO USAR NUNCA en esta herramienta.

  usedProvider tracking:
    Cada paso de la cascada retorna `usedProvider` (ej: 'kie:nano-banana-2', 'fal:fal-ai/nano-banana-2', 'google:gemini-3.1-flash-image-preview').
    Se devuelve en la respuesta API para debugging.

  Seedream text length limit:
    KIE rechaza prompts >800 chars para seedream con "The text length cannot exceed the maximum limit".
    Se trunca a 800 chars automaticamente en generateViaKie() y en fal.ai para paths seedream.
    fal.ai timeout para seedream: 90s (en vez de 45s default) — /edit endpoints son lentos.

  Env var fallbacks (platform keys):
    Ambas rutas (generate-landing + studio/generate-image) tienen fallback a env vars:
    GEMINI_API_KEY, OPENAI_API_KEY, KIE_API_KEY, BFL_API_KEY, FAL_API_KEY
    hasCascadeKey() valida si AL MENOS UNA key existe en toda la cadena del modelo.
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
    Requires original taskId from KIE generation (fal.ai no da taskId → no se puede extender)
    API route: /api/studio/extend-video
    UI: boton FastForward en galeria, solo visible si video.taskId existe y modelo es Veo
    Prompt: usa campo de texto actual si tiene contenido, sino prompt original del video

  Video persistence: videos se guardan en tabla `generations` (product_name LIKE 'Video:%')
    Metadata en enhanced_prompt: "ar:{aspectRatio}|tid:{taskId}"
    Galeria adaptativa: verticales como telefono, horizontales ancho completo
    Botones debajo del video (NO hover overlay — <video controls> se come los eventos)

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

#### Dropshipping Tools (Studio IA tabs: Mi Influencer, Clonar Viral, Reseña UGC, Video Producto, Auto Publicar)
```
Todas las herramientas de dropshipping tienen cascade para no fallar.
Patron comun: KIE user key → KIE platform key (env KIE_API_KEY).
Donde es posible, cascade completa multi-proveedor via servicios centralizados.

  MI INFLUENCER (11 endpoints en app/api/studio/influencer/):
    Todos ya usan servicios centralizados — cascade completa.
    Todas las rutas con generateImage() tienen env var fallbacks (OPENAI_API_KEY, KIE_API_KEY, etc).
    FIX (2026-03-04): Se agregaron env var fallbacks a las 5 rutas de imagen que no los tenian
    (generate-base, enhance-realism, generate-angles, generate-body-grid, generate-content).
    Sin fallbacks, la cascada solo intentaba 1 provider si el usuario no tenia BYOK keys.

    | Endpoint           | Servicio                | Cascade                           |
    | generate-base      | generateImage()         | KIE → fal.ai → Direct API        |
    | enhance-realism    | generateImage()         | KIE → fal.ai → Direct API        |
    | generate-angles    | generateImage()         | KIE → fal.ai → Direct API        |
    | generate-body-grid | generateImage()         | KIE → fal.ai → Direct API        |
    | generate-content   | generateImage()         | KIE → fal.ai → Direct API        |
    | analyze            | generateAIText()        | KIE → OpenAI → Google Gemini     |
    | visual-analysis    | generateAIText()        | KIE → OpenAI → Google Gemini     |
    | video-constructor  | generateAIText()        | KIE → OpenAI → Google Gemini     |
    | generate-script    | generateAIText()        | KIE → OpenAI → Google Gemini     |
    | gallery + CRUD     | Sin IA (solo Supabase)  | N/A                               |
    | saved-angles CRUD  | Sin IA (solo Supabase)  | N/A                               |

    Galeria de Contenido (Step 6 — generate-content + gallery):
      - Soporta 4 aspect ratios: 9:16 (vertical), 16:9 (horizontal), 1:1 (cuadrado), 4:5 (IG post)
      - aspectRatio se pasa en body del POST, default '9:16', se guarda en influencer_gallery.aspect_ratio
      - Publicacion directa a redes via Publer (PublisherModal) desde botones hover de galeria
      - Migracion: supabase/migrations/20260304_gallery_aspect_ratio.sql

    Video Influencer (Step 7 — Step7Video.tsx):
      - Video resultado se muestra estilo Instagram: 9:16 → max-w-220px, 16:9 → max-w-lg, 1:1 → max-w-300px
      - object-contain + bg-black (respeta aspect ratio sin recortar)
      - Botones debajo del video (NO hover overlay — <video controls> captura mouse):
        - Extender (solo Veo) → usa /api/studio/extend-video con completedTaskId
        - Compartir → PublisherModal para publicar a redes via Publer
        - Pizarra → onBack() para volver al InfluencerBoard
      - completedTaskId se guarda al terminar polling exitoso para habilitar extend
      - Extend reutiliza el polling existente: setTaskId(newId) + setVideoUrl(null) + setIsGenerating(true)
      - Picker de imagen de inicio: filtra content_type='video' para no mostrar videos como imgs rotas

    Guion por Escenas (Step 7 — SceneScriptGenerator.tsx + ParallelVideoManager.tsx):
      - Flujo: Seleccionar angulo guardado → Describir producto → Generar guion AI → Editar prompts → Generar videos
      - SceneScriptGenerator: panel colapsable con 3 pasos:
        1. SavedAnglesPanel con showProductFilter (dropdown de producto)
        2. Textarea producto + selector voz (femenina/masculina) + slider escenas (3-6)
        3. Cards de escenas editables con veoPrompt editable (max 400 chars)
      - API: POST /api/studio/influencer/generate-script
        - Usa generateAIText() con skipKIE:true, googleModel:'gemini-2.5-pro', temp 0.8, jsonMode:true
        - System prompt: director UGC LATAM, 8s por escena, dialogo espanol, veoPrompt ingles
        - Arcos narrativos: 3 escenas (Hook→Demo→CTA) hasta 6 (Hook→Problema→Descubrimiento→Demo→Resultado→CTA)
      - ParallelVideoManager: genera multiples escenas en paralelo con Veo 3.1
        - Semaforo: max 3 concurrentes, poll cada 5s, max 60 polls
        - Cada escena: POST /api/studio/generate-video con modelId:'veo-3.1', duration:8, enableAudio:true
        - Auto-save a gallery al completar cada escena
        - UI: barra progreso + grid cards con status (gris=pendiente, ambar=generando, azul=polling, verde=ok, rojo=error)
      - Botones: "Generar Video" por escena (llena prompt de Step7Video) o "Generar Todo en Paralelo"

    Hub de Angulos Guardados (SavedAnglesPanel.tsx — componente compartido):
      - Tabla Supabase: saved_angles (id, user_id, product_name, angle_data JSONB, created_at)
      - API: app/api/studio/saved-angles/ (GET ?productName=X, POST batch upsert, DELETE por producto)
      - Props adaptativas: filterByProduct (solo ese producto), showProductFilter (dropdown), selectable (modo seleccion)
      - Usado en Banner Generator: filterByProduct={product.name}, solo lectura
      - Usado en SceneScriptGenerator: showProductFilter=true, selectable=true
      - Cada angulo es accordion: click expande info completa (salesAngle, description, avatarSuggestion)
      - Boton copiar por angulo (clipboard formatted text)
      - Boton "Guardar Angulos" en Banner Generator: persiste angulos generados a Supabase
      - Migracion: supabase/migrations/20260305_saved_angles.sql

    Resumen del Influencer (InfluencerSummary.tsx) — Pizarra de Contenido mini:
      - Click en item → abre lightbox con vista completa (video con controls, imagen object-contain)
      - Hover overlay: favorito, share (PublisherModal), download, delete
      - Lightbox: share, favorito, download, delete — mismas acciones que InfluencerBoard
      - stopPropagation en botones hover para no disparar lightbox al clickear accion
      - Seleccion de videos: boton "Editar videos" activa modo seleccion
        - Solo se pueden seleccionar items con content_type='video' y video_url
        - Imagenes se atenuan con overlay "Solo videos" en modo seleccion
        - Barra flotante inferior muestra count + boton "Enviar al Editor"
        - onSendToEditor prop: envia clips seleccionados al VideoEditor

    Pizarra de Contenido (InfluencerBoard.tsx):
      - Misma funcionalidad de seleccion de videos que InfluencerSummary
      - Boton "Editar videos" en barra de filtros junto a "Crear Foto" y "Crear Video"
      - onSendToEditor prop: envia clips seleccionados al VideoEditor

    Video Editor (VideoEditor.tsx — components/studio/video-prompt/):
      - Layout estilo CapCut/NLE: preview arriba, panel audio derecha, timeline abajo
      - Props: { initialClips: {url, label}[], onBack: ()=>void, onExported?: (url)=>void }
      - Preview: <video> element reproduce clips en secuencia (clipTimeMap computed)
        - Play/pause, seek global, progress bar que cubre todos los clips
        - object-contain con fondo negro (respeta aspect ratio sin recortar — videos verticales ok)
      - Timeline horizontal: bloques proporcionales a duracion del clip
        - Click en bloque → selecciona clip (border highlight)
        - Trim handles: drag bordes izq/der para ajustar startTime/endTime (min 1s)
        - Playhead: linea blanca vertical que se mueve durante reproduccion
        - Zoom: slider 1x-5x para ver clips en detalle
      - Audio panel (derecha): upload musica (MP3/WAV/M4A via Supabase Storage)
        - Sliders volumen voz (0-200%) y musica (0-200%)
      - Toolbar: mover clips, cortar/split en playhead, borrar clip
      - Split/cut: divide clip en posicion del playhead en dos clips (mismo URL, diferente startTime/endTime)
      - Export: POST /api/studio/video-editor/process → poll /api/studio/video-editor/status?jobId=
        - Overlay fijo con resultado: player, descargar, copiar URL
      - Navegacion: InfluencerWizard maneja vista 'editor', volver regresa a vista anterior

    Video Viral (Step 7 — ViralTransformationMode.tsx):
      Modo "Viral" en Step 7 del Influencer Wizard.
      Sube video de referencia (TikTok/Reels viral) → Gemini 3.1 Pro analiza segundo a segundo
      → genera guión escena por escena → genera imagen de primer frame por escena
      → anima cada frame en clip de 8s via Veo → todos los clips forman UN video continuo.

      Archivos clave:
        - System prompt + API: app/api/studio/influencer/generate-viral-script/route.ts
        - Componente UI: components/studio/influencer/ViralTransformationMode.tsx
        - Video generation: app/api/studio/generate-video/route.ts + lib/video-providers/kie-video.ts
        - Image generation: app/api/studio/generate-image/route.ts + lib/image-providers/index.ts
        - AI text: lib/services/ai-text.ts (cascade KIE→OpenAI→Google)

      Pipeline por escena (2 pasos normales, 3 para transformación):
        Normal: genera imagen (imagePrompt + referenceImages) → anima imagen → video 8s via Veo
        Transformación (dirty→clean): genera imagen BEFORE (imagePrompt) → genera imagen AFTER
          (imagePromptEnd) → usa FIRST_AND_LAST_FRAMES_2_VIDEO de Veo → interpola entre before/after

      System prompt es ADAPTATIVO — detecta estilo del video de referencia:
        - UGC (talking head), transformación (before/after), demo, etc.
        - Replica estructura EXACTA del video de referencia
        - NO TOCAR el system prompt — el usuario está contento con resultados

      Interfaces:
        ViralScene: { sceneNumber, sceneType ('transformation'|'influencer'|'beauty-shot'|'product-demo'),
          sceneDescription, imagePrompt, imagePromptEnd? (solo transformación — last frame),
          animationPrompt, influencerDialogue, duration (8s), static (false), complexity,
          usesInfluencer, usesProductPhoto, startsAtSecond? }
        ViralScriptResult: { videoTitle, videoConcept, detectedStyle?, referenceAnalysis,
          fullScript?, totalDuration, scenes: ViralScene[], productionNotes }

      Modelos usados:
        - Análisis video: gemini-3.1-pro-preview (Google direct, con thinking para video)
        - Imagen primer frame: nano-banana-2 (default, usuario puede cambiar)
        - Video animación: veo-3.1-fast (default, más barato que veo-3.1)
        - Text cascade: skipKIE cuando hay multimodal → Google directo

      UI: análisis de referencia y guión completo colapsables, campos editables por escena,
        campo rosa "Last Frame (Resultado Final)" en escenas de transformación,
        semáforo MAX_CONCURRENT = 2 para generación paralela,
        botón "Enviar al Editor" cuando hay videos completados

    InfluencerWizard.tsx — Flujo de vistas:
      - Views: 'list' | 'wizard' | 'summary' | 'board' | 'editor'
      - handleSendToEditor: recibe clips de Summary/Board → navega a vista 'editor'
      - Estado: editorClips (clips para VideoEditor), editorReturnView (vista a la que volver)

    ANTI-PATRON: Rutas que usan generateImage() sin env var fallbacks → cascade solo intenta 1 provider.
    Todas las rutas de imagen DEBEN tener fallback a env vars (ver generate-content como referencia).

  CLONAR VIRAL (8 endpoints en app/api/studio/clone-viral/):
    Texto: usa servicios centralizados. Video/audio: KIE key cascade.
    | Endpoint           | Modelo KIE                              | Cascade                           |
    | transcribe         | generateAIText()                        | KIE → OpenAI → Google Gemini     |
    | translate          | generateAIText()                        | KIE → OpenAI → Google Gemini     |
    | generate-prompts   | generateAIText()                        | KIE → OpenAI → Google Gemini     |
    | extract-frame      | Sin IA (solo upload)                    | N/A                               |
    | generate-pose      | kling-2.6/image                         | KIE user → KIE platform          |
    | generate-voice     | elevenlabs/text-to-speech-multilingual-v2 | KIE user → KIE platform        |
    | lip-sync           | kling/ai-avatar-pro|standard            | KIE user → KIE platform          |
    | motion-control     | kling-2.6/motion-control                | KIE user → KIE platform          |

  RESEÑA UGC (app/api/studio/resena-ugc/):
    Pipeline: face image → character profile → script → upload → video.
    | Paso               | Servicio                | Cascade                           |
    | Face generation    | generateImage()         | KIE → fal.ai → Direct API        |
    | Character profile  | generateAIText()        | KIE → OpenAI → Google Gemini     |
    | Script generation  | generateAIText()        | KIE → OpenAI → Google Gemini     |
    | Video generation   | generateVideo()         | KIE → fal.ai                     |
    Env var fallbacks: GEMINI, OPENAI, KIE, BFL, FAL (todas las keys de imagen + video).
    FIX (2026-03-05): Se agregaron env var fallbacks para TODAS las API keys.
    Antes exigia BYOK KIE key y no tenia fallback para imagen (gemini, openai, bfl, fal).
    Si KIE fallaba, la cascada de imagen moria sin intentar otros providers.

  VIDEO PRODUCTO (app/api/studio/generate-video/):
    Usa generateVideo() centralizado — cascade KIE → fal.ai.
    13 modelos de video disponibles (ver Video Generation section arriba).
    Env var fallbacks: KIE_API_KEY (platform key) + FAL_API_KEY (cascade fallback).
    FIX (2026-03-05): generate-video route ahora tiene fallback a env vars
    (antes solo usaba BYOK keys, sin platform fallback → cascade no llegaba a fal.ai).

  AUTO PUBLICAR (app/api/studio/automations/):
    | Endpoint           | Servicio                | Cascade                           |
    | route.ts (CRUD)    | Sin IA (solo Supabase)  | N/A                               |
    | execute-now        | generateAIText() + generateVideo() | Texto: KIE→OpenAI→Google. Video: KIE→fal.ai |
    | cron/automations   | Delega a execute-now    | Misma cascade                     |

  DEEP FACE (app/api/studio/tools/ — herramienta "deep-face"):
    Solo KIE soporta deep-face-swap. KIE user → KIE platform.
    No hay alternativa en fal.ai ni otro proveedor.

  System prompts: TODOS son SACRED — NO SE TOCAN.
  Polling: video-status solo soporta KIE tasks (no fal.ai task IDs).
  Por eso clone-viral endpoints usan KIE key cascade, no provider switch.
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

#### Canva Connect Integration — `lib/canva/` + `app/api/canva/`
```
Permite editar banners generados directamente en Canva.
Boton "Editar en Canva" en el editor de landing (/dashboard/landing/[id]).

Archivos:
  lib/canva/pkce.ts          — PKCE helpers + encryptState/decryptState (AES-256-GCM)
  app/api/canva/auth/route.ts    — Inicia OAuth: genera PKCE, encripta state, redirige a Canva
  app/api/canva/callback/route.ts — Callback: descifra state, intercambia code por tokens
  app/api/canva/upload/route.ts  — Sube imagen + crea diseño en Canva, retorna editUrl

OAuth Flow (stateless — SIN cookies para PKCE):
  1. Frontend llama GET /api/canva/auth?returnUrl=/dashboard/landing/[id]
  2. Auth route genera code_verifier + code_challenge (PKCE S256)
  3. Encripta {code_verifier, returnUrl, timestamp} con AES-256-GCM (key = sha256(CANVA_CLIENT_SECRET))
  4. El blob encriptado ES el parametro `state` de OAuth — no se usan cookies
  5. Redirige a canva.com/api/oauth/authorize
  6. Usuario autoriza → Canva redirige a /api/canva/callback?code=...&state=...
  7. Callback descifra state → recupera code_verifier + returnUrl
  8. Intercambia code por tokens (access_token + refresh_token)
  9. Guarda tokens en cookies httpOnly, redirige a returnUrl?canva_success=true
  10. Frontend detecta canva_success, reintenta upload pendiente

POR QUE stateless (no cookies para PKCE):
  Cookies en redirect responses se pierden en Vercel/cross-site OAuth.
  El state encriptado viaja con el flujo OAuth y se descifra al volver.
  La encripcion AES-256-GCM sirve como CSRF protection (solo nuestro server puede crearlo).

Upload Flow:
  1. Frontend POST /api/canva/upload con {imageUrl, sectionId, productName}
  2. Server fetch imagen desde Supabase Storage → Buffer
  3. POST a Canva Asset Upload API (octet-stream + Asset-Upload-Metadata header)
  4. Poll job hasta completar → obtiene assetId
  5. POST a Canva Design API → crea diseño 1080x1920 con el asset
  6. Retorna editUrl → frontend abre en nueva pestaña

Limites Canva API:
  - Asset name: max 50 chars (unencoded) en Asset-Upload-Metadata.name_base64
  - Rate limit: 30 requests/min por usuario
  - Scopes requeridos: asset:read, asset:write, design:content:read, design:content:write

Env vars requeridas:
  CANVA_CLIENT_ID — OAuth client ID (registrado en canva.dev)
  CANVA_CLIENT_SECRET — OAuth secret (tambien se usa como key de encripcion del state)
  CANVA_REDIRECT_URI — Debe ser https://estrategasia.com/api/canva/callback

Tokens:
  canva_access_token — cookie httpOnly, expira segun Canva (tipicamente 4h)
  canva_refresh_token — cookie httpOnly, 30 dias, se usa para renovar access_token
  Si ambos expiran → redirige a OAuth de nuevo automaticamente
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
| Home | `/dashboard` | Server-side: profiles, generations (videos como `<video>`). Client: BalanceCards → keys/balance (KIE, ElevenLabs, BFL en USD) |
| Banner Generator | `/dashboard/landing/[id]` | generate-landing, edit-section, enhance-prompt, generate-angles, templates, sections, share |
| Image Generator (legacy) | `/dashboard/generate` | generate (uses @google/generative-ai SDK directly) |
| Studio Creativo | `/dashboard/studio` | studio/* (image, video, audio, tools, influencer/*, clone-viral/*, automations/*, prompt-bot, copy-optimize, resena-ugc) |
| Landing IA (Landing Code) | `/dashboard/landing-ia` | landing-ia/scrape, landing-ia/stream, landing-ia/draft/* | **ADMIN ONLY en sidebar** |
| Product Research | `/dashboard/product-research` | productos/search (DropKiller), FastMoss (hardcoded Supabase) |
| Coaching | `/dashboard/coaching` | coaching/mentors, coaching/availability, coaching/bookings |
| Settings | `/dashboard/settings` | keys (BYOK management) |
| Lucio | `/dashboard/lucio` | WebSocket to LUCIO_URL (OpenClaw gateway, client.id='openclaw-control-ui') |
| Gallery | `/dashboard/gallery` | None (YouTube embeds) |
| Admin Templates | `/dashboard/admin/templates` | admin/templates/upload, admin/templates/delete |

### Supabase Tables (this repo)

profiles, templates, products, landing_sections, generations, allowed_emails, landing_ia_drafts, influencers, influencer_gallery, automation_flows, automation_runs, coaching_mentors, coaching_availability, coaching_bookings, import_bundles, saved_angles. Storage bucket: `landing-images`.

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
| `CANVA_CLIENT_ID` + `CANVA_CLIENT_SECRET` | Canva OAuth + state encryption key | Canva integration breaks |
| `CANVA_REDIRECT_URI` | Canva OAuth callback URL | Must be `https://estrategasia.com/api/canva/callback` |
| `FAL_API_KEY` | fal.ai platform fallback | Image/video cascade skips fal.ai step |
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
| `app/(dashboard)/layout.tsx` | HIGH | Dashboard sidebar, nav, auth check. Landing Code filtrado para !isAdmin |
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
10. **NEVER** hacer `git push` cuando CLAUDE.md es el unico archivo modificado — triggerea deploy en Vercel innecesariamente. Commit local OK, push solo junto con cambios de codigo real.

### ALWAYS do:
1. **ALWAYS** check the impact map before touching any service file
2. **ALWAYS** run `npm run build` after changes (TypeScript catches many issues)
3. **ALWAYS** update `types.ts` when adding a new model to any provider
4. **ALWAYS** follow the provider pattern: types.ts -> provider.ts -> index.ts (router) -> UI
5. **ALWAYS** use per-user keys from profiles table (BYOK), not hardcoded keys
6. **ALWAYS** add `reasoning_effort: 'none'` for KIE calls and `thinkingBudget: 0` for Google direct to prevent timeout cascades (Google Gemini has thinking mode ON by default)

### Known Anti-Patterns & Production Bugs (documentados para no repetir):

#### AI Model Errors
- **Google thinking mode por defecto** → 100s+ responses → timeout cascade → 504s en Vercel. FIX: `reasoning_effort:'none'` (KIE) y `thinkingBudget:0` (Google direct). SIEMPRE agregar en toda llamada a Gemini.
- **KIE cascade con gemini-2.5-pro** → demasiado lento, total excede Vercel 120s. FIX: solo `gemini-2.5-flash` en KIE cascade (salvo copy-optimize/enhance-prompt que tienen maxDuration=120s y usan pro explicitamente).
- **KIE gemini-2.5-pro + reasoning_effort:'none' + imagenes = respuesta vacia** → En tareas multimodal complejas (ej: visual-analysis con 3 imagenes), pro con reasoning desactivado devuelve empty response. Luego OpenAI consume 90s timeout, Google no tiene tiempo. FIX: NUNCA usar `kieModel: 'gemini-2.5-pro'` con imagenes. Usar flash por defecto para KIE (confiable con multimodal), y `googleModel: 'gemini-2.5-pro'` solo para Google direct como fallback final. Afecta: influencer/visual-analysis, tools/describe-person. REGLA: `kieModel: 'gemini-2.5-pro'` solo para texto puro (copy-optimize, enhance-prompt), NUNCA con `images: [...]`.
- **Wrong model ID para Gemini direct** → `modelConfig.apiModelId` contiene paths de fal.ai (ej: `fal-ai/nano-banana-2`) que causan 404 en Google API. FIX: SIEMPRE usar `cascade.directModelId` para direct API.
- **gemini-2.5-flash-image NO EXISTE** como modelo de imagen. Se intentó usar → 404. El correcto es `gemini-3.1-flash-image-preview` o `gemini-3-pro-image-preview`.
- **Seedream prompts > 800 chars** → KIE error "The text length cannot exceed the maximum limit". FIX: truncar automaticamente a 800 chars en generateViaKie() y fal.ai para paths seedream.
- **Seedream /edit endpoints en fal.ai son lentos** → timeout 45s insuficiente. FIX: timeout 90s para seedream en fal.ai.
- **Modelos eliminados que causaban errores**: seedream-3 (sin image input), seedream-4 (duplicado), seedream-4-4k (sin uso), seedream-4.5 (reemplazado por 5/5Pro), flux-2-klein (sin uso). NUNCA re-agregar.
- **fal.ai NO es compania de modelos** — es proveedor de infraestructura multi-provider. Los modelos se atribuyen a su empresa real: nano-banana → Google, seedream → ByteDance, flux → BFL.

#### Cambios de tipo que rompen multiples archivos
- **Eliminar un valor de `ImageProviderType` o `ImageProviderCompany`** → rompe TODOS los `Record<ImageProviderType, ...>` en 7+ archivos. SIEMPRE grep por el tipo antes de eliminarlo y actualizar TODOS los records.
- **Agregar modelo sin actualizar types.ts** → UI selector no lo muestra, cascada lo ignora.
- **Cambiar company de un modelo** → IMAGE_COMPANY_GROUPS se desincroniza, modelo aparece en grupo equivocado.

#### OAuth & Auth Errors
- **Cookies en redirect responses de Vercel** → se pierden en cross-site OAuth (estrategasia.com → canva.com → estrategasia.com). Vercel serverless no persiste cookies en 307 redirects de forma confiable. FIX: state encriptado AES-256-GCM que viaja con el flujo OAuth. Nunca depender de cookies para data que cruza dominios.
- **Canva OAuth `invalid_state`** → se perdia el code_verifier guardado en cookie. FIX: encriptar {code_verifier, returnUrl, timestamp} EN el parametro state de OAuth con AES-256-GCM (key = sha256(CANVA_CLIENT_SECRET)).

#### API External Limits
- **Canva Asset-Upload-Metadata name > 50 chars** → "Invalid upload metadata header" (HTTP 500). El header `name_base64` se decodifica y Canva valida max 50 chars del nombre. FIX: truncar filename a 46 chars + ".png" = 50. NUNCA incluir UUIDs en filenames para Canva.
- **Canva rate limit**: 30 requests/min por usuario. No hay retry automatico.

#### Storage & R2 Errors
- **R2 S3 API endpoint URL en browser → SIEMPRE 400** → `bucket.accountId.r2.cloudflarestorage.com` es el endpoint de API S3, REQUIERE auth headers (AWS Signature V4). Browsers NO pueden cargar estas URLs. Error: `<Error><Code>InvalidArgument</Code><Message>Authorization</Message></Error>`. FIX: `tryUploadToR2()` retorna null si no hay `publicUrl` configurado (el archivo SI se sube como backup, pero la URL no es usable). NUNCA guardar URL del S3 endpoint en la DB. Solo guardar R2 URLs cuando el usuario tiene un dominio publico configurado (campo `cf_public_url` en profiles).
- **Imagenes generadas perdidas al refrescar** → Si solo se guardan en React state (base64), se pierden al recargar. FIX: SIEMPRE persistir a Storage + DB (tabla `generations`). Al recargar, useEffect carga de DB y genera signed URLs.
- **Usar persistedUrl/R2 URL para mostrar imagen recien generada** → la URL puede tardar en propagarse, o puede estar rota (R2 sin public URL, Storage error). FIX: SIEMPRE usar base64 del response API para display inmediato. La URL persistida solo se usa al recargar pagina desde DB.
- **Supabase Storage URLs sin signed URL** → si el bucket no es publico, la URL directa da 400. FIX: SIEMPRE usar `createSignedUrl(path, 86400)` para generar URLs temporales (24h). Patron `storage:` prefix en DB: `generated_image_url = "storage:studio/{userId}/file.png"` → frontend extrae path → signed URL.

#### Frontend Errors
- **Cross-origin `<a download>`** → el atributo `download` es ignorado por browsers para URLs de otro dominio. El browser NAVEGA la pagina en vez de descargar. NUNCA usar `<a download>` directo con URLs cross-origin (ej: Supabase signed URLs, R2 URLs). FIX: fetch como blob → `URL.createObjectURL(blob)` → `<a download>` con blob URL (same-origin). Fallback: `window.open(url, '_blank')` + toast de error.
- **`window.open()` bloqueado por popup blocker** → solo funciona en contexto de click directo del usuario, no en callbacks async. Considerar esto al diseñar flujos que abren URLs.
- **Event handlers en server components** → `onMouseEnter`, `onClick`, etc. en un async server component (como dashboard/page.tsx) causan crash en produccion ("server-side exception"). Next.js NO lo detecta en build. FIX: NUNCA poner event handlers en server components. Si necesitas interactividad, extraer a un client component con 'use client'. Este bug tumbo el dashboard entero en produccion.
- **Videos renderizados como `<img>`** → Generaciones recientes y galeria pueden tener videos (product_name LIKE 'Video:%'). Si se renderizan como `<img>`, se ven como iconos rotos. FIX: detectar `product_name?.startsWith('Video:')` y renderizar `<video>` en vez de `<img>`.

#### Env Var & Key Errors
- **Fallback keys faltantes en env vars** → cuando un usuario no tiene BYOK key Y no hay env var de plataforma, la cascada ENTERA falla silenciosamente. FIX: `hasCascadeKey()` valida que AL MENOS UNA key existe antes de intentar generar. Ambas rutas (landing + studio) tienen fallback a: GEMINI_API_KEY, OPENAI_API_KEY, KIE_API_KEY, BFL_API_KEY, FAL_API_KEY.
- **Video cascade `throw` en vez de `return`** → `generateVeoVideo()` y `generateStandardVideo()` en kie-video.ts usaban `throw new Error(...)` cuando KIE fallaba (sin saldo, error API). El throw era atrapado por el try/catch EXTERNO de `generateVideo()`, saltandose completamente el codigo de fallback a fal.ai. FIX (2026-03-05): cambiar todos los `throw` a `return { success: false, error: ... }` para que la cascada continue a fal.ai. REGLA: funciones internas de cascade NUNCA deben hacer throw — siempre retornar `{success: false}` para que el router pueda intentar el siguiente provider.
- **ENCRYPTION_KEY incorrecto** → NO HAY error visible, simplemente todas las keys BYOK se descifran como basura → 401s en todos los proveedores. Si todos los usuarios fallan simultaneamente, verificar ENCRYPTION_KEY primero.

#### Deploy & Infrastructure
- **PROHIBIDO push de CLAUDE.md solo** → CLAUDE.md es documentacion interna para Claude, NO es codigo. Hacer push de CLAUDE.md SOLO triggerea un deploy en Vercel COMPLETAMENTE INNECESARIO que gasta build minutes y tiempo del usuario. REGLA ABSOLUTA: NUNCA hacer `git push` cuando el unico archivo modificado es CLAUDE.md. Opciones: (1) acumular cambios de CLAUDE.md y pushearlos junto con el proximo cambio de codigo real, o (2) hacer commit local sin push. Si el usuario pide explicitamente pushear CLAUDE.md, advertirle que triggerea deploy innecesario.
- **Vercel maxDuration** → funciones serverless tienen limite (120s por default en vercel.json). Toda cadena de cascada debe completar dentro de este limite. Si un paso tarda mucho, los siguientes no tienen tiempo.
- **Vercel MIDDLEWARE_INVOCATION_TIMEOUT** → middleware.ts tiene timeout 3s para evitar esto. NO agregar logica pesada al middleware.

#### Cascade I2I vs T2I
- **`hasImages` en index.ts DEBE revisar TODAS las formas de pasar imagenes** → `productImageUrls`, `productImagesBase64`, y `templateUrl`. Si solo revisa URLs, los fallbacks de la cascada usan T2I (texto→imagen) y generan imagenes random en vez de transformar la referencia. FIX (2026-03-06): se agrego `productImagesBase64?.length` al check.
- **Rutas que usan I2I (enhance-realism, generate-angles, etc.) SIEMPRE deben subir la imagen a Storage y generar URL publica** → sin importar el provider seleccionado. Las URLs son necesarias para KIE y fal.ai en la cascada. Si solo se generan URLs para ciertos providers, los fallbacks no reciben la imagen. REGLA: si una ruta pasa imagenes de referencia, SIEMPRE generar `productImageUrls` ademas de `productImagesBase64`.

#### Patrones Generales
- **Cambiar AI API en una ruta pero no en otras** → ej: Landing IA actualizado pero Coaching olvidado. SIEMPRE revisar impact map (Section 6) antes de cambiar cualquier servicio.
- **Wrong client.id para Lucio WebSocket** → "missing scope" errors. DEBE ser 'openclaw-control-ui'.
- **`usedProvider` tracking** → cada paso de cascada retorna cual proveedor realmente genero la imagen (ej: 'kie:nano-banana-2', 'fal:fal-ai/nano-banana-2'). SIEMPRE incluir en respuesta API para debugging.

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
| KIE.ai | Both repos | `api.kie.ai` | Per-user BYOK key | Balance: `GET /api/v1/chat/credit` → `{data: int}` (1cr=$0.005) |
| Google Gemini | Both repos | `generativelanguage.googleapis.com/v1beta` | Per-user BYOK + platform fallback |
| OpenAI | Both repos | `api.openai.com/v1` | Per-user BYOK + platform fallback |
| BFL/FLUX | estrategas only | `api.bfl.ai/v1` | Per-user BYOK | Balance: `GET /v1/credits` → `{credits: num}` (1cr=$0.01) |
| fal.ai | Both repos | `queue.fal.ai` | Per-user BYOK (profiles.fal_api_key) |
| ElevenLabs | Both repos | `api.elevenlabs.io/v1` | Per-user BYOK + platform fallback | Balance: `GET /v1/user/subscription` → chars used/limit + tier (suscripcion, no creditos) |
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

---

## 13. TRABAJO EN PROGRESO — Video Viral (2026-03-10)

### ⚠️ PUSH PENDIENTE — EJECUTAR PRIMERO
```bash
cd C:/Users/Asus/Downloads/estrategas-landing-generator && git push origin developers
```
Commit `9e5ddb1` (first-last-frame para transformaciones) NO se pudo pushear por caída de internet.

### Qué se hizo en la última sesión (5 commits)

| # | Commit | Descripción | Estado |
|---|--------|-------------|--------|
| 1 | `646017c` | Rewrite system prompt adaptativo (detecta estilo UGC/transformación/demo) | ✅ PUSHEADO |
| 2 | `b116357` | Botón "Enviar al Editor" — clips en orden al VideoEditor | ✅ PUSHEADO |
| 3 | `cd1b5cb` | Default Veo Fast + intento fix mid-transformation (NO funcionó) | ✅ PUSHEADO |
| 4 | `61deced` | Upgrade análisis video a Gemini 3.1 Pro | ✅ PUSHEADO |
| 5 | `9e5ddb1` | **First-last-frame para transformaciones** — genera 2 imgs (before+after), usa `FIRST_AND_LAST_FRAMES_2_VIDEO` de Veo | ⚠️ **NO PUSHEADO** |

### Problema técnico que se resolvió
Veo image-to-video toma UNA imagen y le agrega MOVIMIENTO. NO puede quitar texturas.
Si la imagen tiene grasa negra, el video tendrá grasa negra — Veo no sabe qué es "limpio".
**Solución**: darle DOS imágenes (sucio + limpio) y que INTERPOLE entre ellas = `FIRST_AND_LAST_FRAMES_2_VIDEO`.

### Lo que funciona bien
- Videos UGC (gomitas Resveratrol + Camila) → resultado "brutal"
- Análisis de video segundo a segundo con Gemini
- Generación de imágenes con references (influencer + producto)
- Pipeline paralelo con semáforo (MAX_CONCURRENT = 2)
- Botón enviar al editor
- Selección de producto + ángulo de venta + contexto extra

### Lo que falta probar / hacer
- [ ] Probar first-last-frame para transformaciones (commit sin pushear)
- [ ] Probar con más videos de referencia de diferentes estilos
- [ ] Audio/voiceover (TTS desde influencerDialogue) — NO implementado aún
- [ ] El usuario quiere probar con otro video diferente después del fix

### Reglas del usuario
- **NO tocar el system prompt** sin que él lo pida — está contento con el resultado
- Siempre commit + push después de cada cambio
- Hablar en español
- Default Veo 3.1 Fast (no Pro, es muy caro)

---

*Last updated: 2026-03-10 — Video Viral mode (ViralTransformationMode), system prompt adaptativo, first-last-frame para transformaciones (PUSH PENDIENTE), botón enviar al editor*
