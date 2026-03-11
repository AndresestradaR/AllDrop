// Video Provider Types for Estudio IA
// Model IDs from KIE.ai (January 2026)

export type VideoProviderCompany = 'google' | 'kuaishou' | 'openai' | 'minimax' | 'seedance' | 'wan' | 'xai'

export type VideoModelId =
  // Google Veo 3.1 (special endpoint)
  | 'veo-3.1'
  | 'veo-3.1-fast'
  // Kling (Kuaishou)
  | 'kling-3.0'
  | 'kling-2.6'
  | 'kling-v25-turbo'
  // OpenAI Sora
  | 'sora-2'
  // MiniMax Hailuo
  | 'hailuo-2.3-pro'
  | 'hailuo-2.3-standard'
  // Seedance (ByteDance)
  | 'seedance-2'
  | 'seedance-1.5-pro'
  | 'seedance-1.0-fast'
  // Wan
  | 'wan-2.6'
  | 'wan-2.5'
  // xAI Grok Imagine
  | 'grok-imagine'

export type VideoModelTag = 'NEW' | 'FAST' | 'PREMIUM' | 'AUDIO' | 'REFERENCES' | 'MULTI_SHOTS' | 'RECOMENDADO' | 'IMG2VID'

export interface VideoModelConfig {
  id: VideoModelId
  apiModelId: string // KIE.ai model identifier for image-to-video
  apiModelIdText?: string // KIE.ai model identifier for text-to-video (if different)
  name: string
  description: string
  company: VideoProviderCompany
  companyName: string
  priceRange: string // USD price range
  durationRange: string // e.g., "4-12s"
  resolutions: string[] // e.g., ["720p", "1080p", "4K"]
  defaultResolution: string
  supportsAudio: boolean
  supportsReferences: boolean
  supportsStartEndFrames: boolean
  supportsMultiShots: boolean
  requiresImage?: boolean // True if model ONLY supports image-to-video (no text-to-video)
  noResolutionParam?: boolean // True if model doesn't accept resolution parameter
  useVeoEndpoint?: boolean // Special endpoint for Veo models
  falModelId?: string // fal.ai model path (legacy single path fallback)
  // fal.ai cascade — mode-aware fallback paths
  fal?: {
    t2v?: string    // fal.ai path for text-to-video
    i2v?: string    // fal.ai path for image-to-video
    v2v?: string    // fal.ai path for video-to-video/remix
  }
  supportsExtend?: boolean // Veo only — can extend via /veo/extend
  tags?: VideoModelTag[]
  recommended?: boolean
}

export interface VideoCompanyGroup {
  id: VideoProviderCompany
  name: string
  icon: string
  color: string
  models: VideoModelConfig[]
}

// Video Model Definitions - Model IDs from KIE.ai
export const VIDEO_MODELS: Record<VideoModelId, VideoModelConfig> = {
  // ============ GOOGLE VEO (Special endpoint /api/v1/veo/generate) ============
  'veo-3.1': {
    id: 'veo-3.1',
    apiModelId: 'veo3', // Special: uses /api/v1/veo/generate
    name: 'Google Veo 3.1 Pro',
    description: 'Flagship con audio y 4K',
    company: 'google',
    companyName: 'Google',
    priceRange: '$0.55-1.10',
    durationRange: '5-10s',
    resolutions: ['1080p', '4K'],
    defaultResolution: '1080p',
    supportsAudio: true,
    supportsReferences: true,
    supportsStartEndFrames: true,
    supportsMultiShots: false,
    useVeoEndpoint: true,
    supportsExtend: true,
    fal: { t2v: 'fal-ai/veo3.1', i2v: 'fal-ai/veo3.1/first-last-frame-to-video' },
    tags: ['PREMIUM', 'AUDIO', 'REFERENCES'],
    recommended: true,
  },
  'veo-3.1-fast': {
    id: 'veo-3.1-fast',
    apiModelId: 'veo3_fast', // Special: uses /api/v1/veo/generate
    name: 'Veo 3.1 Fast',
    description: 'Rápido y económico con audio',
    company: 'google',
    companyName: 'Google',
    priceRange: '$0.28-0.55',
    durationRange: '5-10s',
    resolutions: ['1080p'],
    defaultResolution: '1080p',
    supportsAudio: true,
    supportsReferences: true,
    supportsStartEndFrames: true,
    supportsMultiShots: false,
    useVeoEndpoint: true,
    supportsExtend: true,
    fal: { t2v: 'fal-ai/veo3.1/fast', i2v: 'fal-ai/veo3.1/image-to-video' },
    tags: ['FAST', 'AUDIO', 'RECOMENDADO'],
    recommended: true,
  },

  // ============ KLING (KUAISHOU) ============
  'kling-3.0': {
    id: 'kling-3.0',
    apiModelId: 'kling-3.0/video',
    apiModelIdText: 'kling-3.0/video',
    name: 'Kling 3.0',
    description: 'Multi-shot, consistencia de personaje, audio nativo en español. Hasta 15s.',
    company: 'kuaishou',
    companyName: 'Kling',
    priceRange: '$0.07-0.42',
    durationRange: '3-15',
    resolutions: ['720p', '1080p'],
    defaultResolution: '1080p',
    supportsAudio: true,
    supportsReferences: true,
    supportsStartEndFrames: true,
    supportsMultiShots: true,
    fal: { i2v: 'fal-ai/kling-video/v3/pro/image-to-video' },
    tags: ['NEW', 'PREMIUM', 'AUDIO', 'REFERENCES', 'MULTI_SHOTS'],
    recommended: true,
  },
  'kling-2.6': {
    id: 'kling-2.6',
    apiModelId: 'kling-2.6/image-to-video',
    apiModelIdText: 'kling-2.6/text-to-video',
    name: 'Kling 2.6',
    description: 'Último modelo con audio, muy económico',
    company: 'kuaishou',
    companyName: 'Kling',
    priceRange: '$0.08-0.55',
    durationRange: '5-10s',
    resolutions: ['720p', '1080p'],
    defaultResolution: '1080p',
    supportsAudio: true,
    supportsReferences: false,
    supportsStartEndFrames: true,
    supportsMultiShots: false,
    tags: ['NEW', 'AUDIO', 'RECOMENDADO'],
    recommended: true,
  },
  'kling-v25-turbo': {
    id: 'kling-v25-turbo',
    apiModelId: 'kling/v2-5-turbo-image-to-video-pro',
    apiModelIdText: 'kling/v2-5-turbo-text-to-video-pro',
    name: 'Kling V2.5 Turbo',
    description: 'Rápido y económico, sin audio',
    company: 'kuaishou',
    companyName: 'Kling',
    priceRange: '$0.21-0.42',
    durationRange: '5-10s',
    resolutions: ['1080p'],
    defaultResolution: '1080p',
    supportsAudio: false,
    supportsReferences: false,
    supportsStartEndFrames: true,
    supportsMultiShots: false,
    noResolutionParam: true,
    fal: { t2v: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video', i2v: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video' },
    tags: ['FAST'],
  },

  // ============ OPENAI SORA ============
  'sora-2': {
    id: 'sora-2',
    apiModelId: 'sora-2-image-to-video',
    apiModelIdText: 'sora-2-text-to-video',
    name: 'OpenAI Sora 2',
    description: 'El modelo de video de OpenAI',
    company: 'openai',
    companyName: 'OpenAI',
    priceRange: '$0.15-0.75',
    durationRange: '10-15s',
    resolutions: ['720p', '1080p'],
    defaultResolution: '1080p',
    supportsAudio: true,
    supportsReferences: false,
    supportsStartEndFrames: true,
    supportsMultiShots: false,
    fal: { t2v: 'fal-ai/sora-2/text-to-video', i2v: 'fal-ai/sora-2/image-to-video', v2v: 'fal-ai/sora-2/video-to-video/remix' },
    tags: ['AUDIO', 'RECOMENDADO'],
    recommended: true,
  },

  // ============ MINIMAX HAILUO ============
  'hailuo-2.3-pro': {
    id: 'hailuo-2.3-pro',
    apiModelId: 'hailuo/2-3-image-to-video-pro',
    apiModelIdText: 'hailuo/02-text-to-video-pro',
    name: 'Hailuo 2.3 Pro',
    description: 'Alta calidad, soporta texto e imagen',
    company: 'minimax',
    companyName: 'MiniMax',
    priceRange: '$0.22-0.45',
    durationRange: '6-10s',
    resolutions: ['768p', '1080p'],
    defaultResolution: '768p',
    supportsAudio: false,
    supportsReferences: false,
    supportsStartEndFrames: true,
    supportsMultiShots: false,
    fal: { i2v: 'fal-ai/minimax/hailuo-02/pro/image-to-video' },
    tags: ['RECOMENDADO'],
    recommended: true,
  },
  'hailuo-2.3-standard': {
    id: 'hailuo-2.3-standard',
    apiModelId: 'hailuo/2-3-image-to-video-standard',
    apiModelIdText: 'hailuo/02-text-to-video-standard',
    name: 'Hailuo 2.3 Standard',
    description: 'Económico, soporta texto e imagen',
    company: 'minimax',
    companyName: 'MiniMax',
    priceRange: '$0.15-0.26',
    durationRange: '6-10s',
    resolutions: ['768p', '1080p'],
    defaultResolution: '768p',
    supportsAudio: false,
    supportsReferences: false,
    supportsStartEndFrames: true,
    supportsMultiShots: false,
    fal: { i2v: 'fal-ai/minimax/hailuo-02/standard/image-to-video' },
    tags: ['FAST'],
  },

  // ============ SEEDANCE (BYTEDANCE) ============
  'seedance-2': {
    id: 'seedance-2',
    apiModelId: 'bytedance/seedance-2-image-to-video',
    apiModelIdText: 'bytedance/seedance-2-text-to-video',
    name: 'Seedance 2.0',
    description: 'Multimodal: texto, imagen, video, audio. Cinematico con audio nativo.',
    company: 'seedance',
    companyName: 'Seedance',
    priceRange: '$0.50-1.00',
    durationRange: '4-15s',
    resolutions: ['1080p'],
    defaultResolution: '1080p',
    supportsAudio: true,
    supportsReferences: true,
    supportsStartEndFrames: true,
    supportsMultiShots: true,
    tags: ['NEW', 'PREMIUM', 'AUDIO', 'REFERENCES', 'MULTI_SHOTS'],
    recommended: true,
  },
  'seedance-1.5-pro': {
    id: 'seedance-1.5-pro',
    apiModelId: 'bytedance/seedance-1.5-pro',
    name: 'Seedance 1.5 Pro',
    description: 'Multi-shots y audio, de ByteDance',
    company: 'seedance',
    companyName: 'Seedance',
    priceRange: '$1.25',
    durationRange: '4-12s',
    resolutions: ['1080p'],
    defaultResolution: '1080p',
    supportsAudio: true,
    supportsReferences: false,
    supportsStartEndFrames: true,
    supportsMultiShots: true,
    fal: { t2v: 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video' },
    tags: ['AUDIO', 'MULTI_SHOTS'],
  },
  'seedance-1.0-fast': {
    id: 'seedance-1.0-fast',
    apiModelId: 'bytedance/v1-pro-fast-image-to-video',
    name: 'Seedance 1.0 Fast',
    description: 'Solo image-to-video, económico',
    company: 'seedance',
    companyName: 'Seedance',
    priceRange: '$0.30',
    durationRange: '2-12s',
    resolutions: ['480p', '1080p'],
    defaultResolution: '1080p',
    supportsAudio: false,
    supportsReferences: true,
    supportsStartEndFrames: true,
    supportsMultiShots: true,
    requiresImage: true,
    falModelId: 'fal-ai/seedance/1.0-pro',
    fal: { i2v: 'fal-ai/bytedance/seedance/v1/pro/image-to-video' },
    tags: ['IMG2VID', 'FAST', 'REFERENCES', 'MULTI_SHOTS'],
  },

  // ============ WAN ============
  'wan-2.6': {
    id: 'wan-2.6',
    apiModelId: 'wan/2-6-image-to-video',
    apiModelIdText: 'wan/2-6-text-to-video',
    name: 'Wan 2.6',
    description: 'Nuevo con multi-shots y audio',
    company: 'wan',
    companyName: 'Wan',
    priceRange: '$0.35-1.58',
    durationRange: '5-15s',
    resolutions: ['720p', '1080p'],
    defaultResolution: '1080p',
    supportsAudio: true,
    supportsReferences: false,
    supportsStartEndFrames: true,
    supportsMultiShots: true,
    tags: ['NEW', 'AUDIO', 'MULTI_SHOTS'],
  },
  'wan-2.5': {
    id: 'wan-2.5',
    apiModelId: 'wan/2-5-image-to-video',
    apiModelIdText: 'wan/2-5-text-to-video',
    name: 'Wan 2.5',
    description: '$0.06/s en 720p, $0.10/s en 1080p',
    company: 'wan',
    companyName: 'Wan',
    priceRange: '$0.30-1.00',
    durationRange: '5-10s',
    resolutions: ['720p', '1080p'],
    defaultResolution: '1080p',
    supportsAudio: true,
    supportsReferences: false,
    supportsStartEndFrames: true,
    supportsMultiShots: false,
    tags: ['AUDIO'],
  },

  // ============ XAI GROK IMAGINE ============
  'grok-imagine': {
    id: 'grok-imagine',
    apiModelId: 'grok-imagine/image-to-video',
    apiModelIdText: 'grok-imagine/text-to-video',
    name: 'Grok Imagine',
    description: 'xAI multimodal con audio sincronizado. Muy económico.',
    company: 'xai',
    companyName: 'xAI',
    priceRange: '$0.05-0.20',
    durationRange: '6-15s',
    resolutions: ['480p', '720p'],
    defaultResolution: '720p',
    supportsAudio: true,
    supportsReferences: false,
    supportsStartEndFrames: false,
    supportsMultiShots: false,
    tags: ['NEW', 'FAST', 'AUDIO'],
    recommended: true,
  },
}

// Group models by company for UI
export const VIDEO_COMPANY_GROUPS: VideoCompanyGroup[] = [
  {
    id: 'google',
    name: 'Google',
    icon: 'Sparkles',
    color: 'from-blue-500 to-blue-600',
    models: [
      VIDEO_MODELS['veo-3.1'],
      VIDEO_MODELS['veo-3.1-fast'],
    ],
  },
  {
    id: 'kuaishou',
    name: 'Kling',
    icon: 'Zap',
    color: 'from-purple-500 to-purple-600',
    models: [
      VIDEO_MODELS['kling-3.0'],
      VIDEO_MODELS['kling-2.6'],
      VIDEO_MODELS['kling-v25-turbo'],
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: 'Cpu',
    color: 'from-emerald-500 to-emerald-600',
    models: [
      VIDEO_MODELS['sora-2'],
    ],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    icon: 'Video',
    color: 'from-orange-500 to-orange-600',
    models: [
      VIDEO_MODELS['hailuo-2.3-pro'],
      VIDEO_MODELS['hailuo-2.3-standard'],
    ],
  },
  {
    id: 'seedance',
    name: 'Seedance',
    icon: 'Film',
    color: 'from-cyan-500 to-cyan-600',
    models: [
      VIDEO_MODELS['seedance-2'],
      VIDEO_MODELS['seedance-1.5-pro'],
      VIDEO_MODELS['seedance-1.0-fast'],
    ],
  },
  {
    id: 'wan',
    name: 'Wan',
    icon: 'Clapperboard',
    color: 'from-rose-500 to-rose-600',
    models: [
      VIDEO_MODELS['wan-2.6'],
      VIDEO_MODELS['wan-2.5'],
    ],
  },
  {
    id: 'xai',
    name: 'xAI',
    icon: 'Bot',
    color: 'from-gray-700 to-gray-900',
    models: [
      VIDEO_MODELS['grok-imagine'],
    ],
  },
]

// Helper to get API model ID based on whether we have an image
export function getVideoApiModelId(modelId: VideoModelId, hasImage: boolean): string {
  const model = VIDEO_MODELS[modelId]
  if (!model) return modelId
  
  // If no image and we have a text-to-video variant, use it
  if (!hasImage && model.apiModelIdText) {
    return model.apiModelIdText
  }
  
  return model.apiModelId
}

// Helper to check if model requires an image
export function modelRequiresImage(modelId: VideoModelId): boolean {
  const model = VIDEO_MODELS[modelId]
  return model?.requiresImage === true
}

// Veo generation types
export type VeoGenerationType = 'TEXT_2_VIDEO' | 'FIRST_AND_LAST_FRAMES_2_VIDEO' | 'REFERENCE_2_VIDEO'

// Generation request interface
export interface GenerateVideoRequest {
  modelId: VideoModelId
  prompt: string
  duration?: number // seconds
  resolution?: string
  aspectRatio?: '16:9' | '9:16' | '1:1'
  imageUrls?: string[] // Public URLs for reference images
  enableAudio?: boolean
  // Veo-specific parameters
  veoGenerationType?: VeoGenerationType
  veoSeed?: number // 10000-99999
  // Kling 3.0 multi-shot
  multiShots?: boolean
  multiPrompt?: Array<{ prompt: string; duration: number }>
  // Kling 3.0 mode (pro = better quality, std = faster/cheaper)
  klingMode?: 'pro' | 'std'
  // Kling 3.0 element references
  klingElements?: Array<{
    name: string
    description: string
    element_input_urls?: string[]
    element_input_video_urls?: string[]
  }>
}

export interface GenerateVideoResult {
  success: boolean
  taskId?: string
  videoUrl?: string
  videoBase64?: string
  mimeType?: string
  status?: 'processing' | 'completed' | 'failed'
  error?: string
  provider?: string
}
