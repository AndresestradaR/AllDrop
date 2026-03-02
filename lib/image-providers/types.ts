// Types for multi-model image generation system

// Provider types (companies)
export type ImageProviderCompany = 'google' | 'openai' | 'bytedance' | 'bfl' | 'fal'

// Specific model IDs (10 models — removed seedream-3, seedream-4, seedream-4-4k, flux-2-klein)
export type ImageModelId =
  // Google (1 model)
  | 'gemini-3-pro-image'
  // OpenAI (1 model only - GPT Image 1.5)
  | 'gpt-image-1.5'
  // ByteDance via KIE.ai (1 model)
  | 'seedream-4.5'
  // Black Forest Labs FLUX 2 (3 models)
  | 'flux-2-max'
  | 'flux-2-pro'
  | 'flux-2-flex'
  // fal.ai models (used as fallback + standalone)
  | 'nano-banana-2'
  | 'seedream-5-lite'
  | 'seedream-5'

// Legacy type for backward compatibility
export type ImageProviderType = 'gemini' | 'openai' | 'seedream' | 'flux' | 'fal'

export type ModelTag = 'NEW' | 'TRENDING' | 'FAST' | 'PREMIUM' | 'BEST_TEXT' | 'HD' | '4K' | 'RECOMENDADO' | 'TEXT_ONLY'

// Where models are available
export type ModelAvailability = 'landing' | 'studio' | 'both'

export interface ImageModelConfig {
  id: ImageModelId
  name: string
  description: string
  company: ImageProviderCompany
  companyName: string
  supportsImageInput: boolean
  supportsAspectRatio: boolean
  maxImages: number
  requiresPolling: boolean
  pricePerImage: string
  recommended?: boolean
  tags?: ModelTag[]
  // The actual API model ID to use when calling the provider
  apiModelId: string
  // fal.ai model ID for fallback cascade (if available on fal.ai)
  falModelId?: string
  // Where this model is available: 'landing', 'studio', or 'both'
  availableIn: ModelAvailability
  // Cascade configuration: defines provider endpoints for T2I vs I2I
  cascade?: {
    kie?: {
      t2i: string     // KIE model ID for text-to-image
      i2i?: string    // KIE model ID for image-to-image (undefined = no I2I on KIE)
      mode: 'nano-banana' | 'seedream' | 'gpt-image'  // controls how images are passed
    }
    fal: {
      t2i: string     // fal.ai full path for T2I
      i2i?: string    // fal.ai path for I2I (undefined = same T2I with image_url)
    }
    directApi?: 'gemini' | 'openai' | 'bfl'  // step 3: direct API fallback (undefined = STOP)
  }
}

export interface ImageCompanyGroup {
  id: ImageProviderCompany
  name: string
  icon: string
  color: string
  models: ImageModelConfig[]
}

// All available models with full configuration
export const IMAGE_MODELS: Record<ImageModelId, ImageModelConfig> = {
  // ============================================
  // GOOGLE (2 models) - Both support image input
  // ============================================
  'gemini-3-pro-image': {
    id: 'gemini-3-pro-image',
    name: 'Gemini 3 Pro Image',
    description: 'Mejor calidad, texto perfecto, resolucion 4K',
    company: 'google',
    companyName: 'Google',
    supportsImageInput: true,
    supportsAspectRatio: true,
    maxImages: 1,
    requiresPolling: false,
    pricePerImage: '~$0.04',
    recommended: true,
    tags: ['RECOMENDADO', 'BEST_TEXT', 'PREMIUM', 'NEW'],
    apiModelId: 'gemini-3-pro-image-preview',
    falModelId: 'nano-banana-pro',
    availableIn: 'both',
    cascade: {
      kie: { t2i: 'nano-banana-pro', i2i: 'nano-banana-pro', mode: 'nano-banana' },
      fal: { t2i: 'fal-ai/nano-banana-pro' },
      directApi: 'gemini',
    },
  },
  // ============================================
  // OPENAI (1 model) - Supports image input
  // ============================================
  'gpt-image-1.5': {
    id: 'gpt-image-1.5',
    name: 'GPT Image 1.5',
    description: 'Ultima version - Mejor calidad general',
    company: 'openai',
    companyName: 'OpenAI',
    supportsImageInput: true,
    supportsAspectRatio: true,
    maxImages: 1,
    requiresPolling: false,
    pricePerImage: '~$0.04',
    recommended: true,
    tags: ['RECOMENDADO', 'NEW', 'TRENDING'],
    apiModelId: 'gpt-image-1.5',
    falModelId: 'gpt-image-1.5',
    availableIn: 'both',
    cascade: {
      kie: { t2i: 'gpt-image/1.5-text-to-image', i2i: 'gpt-image/1.5-image-to-image', mode: 'gpt-image' },
      fal: { t2i: 'fal-ai/gpt-image-1.5' },
      directApi: 'openai',
    },
  },

  // ============================================
  // BYTEDANCE via KIE.ai (4 models)
  // Seedream 3: TEXT ONLY (no image input)
  // Seedream 4, 4.5, 4K: Support image input
  // ============================================
  'seedream-4.5': {
    id: 'seedream-4.5',
    name: 'Seedream 4.5',
    description: 'Multi-imagen estetica - Soporta imagenes de referencia',
    company: 'bytedance',
    companyName: 'ByteDance',
    supportsImageInput: true,
    supportsAspectRatio: true,
    maxImages: 6,
    requiresPolling: true,
    pricePerImage: '~$0.032',
    recommended: true,
    tags: ['RECOMENDADO', 'TRENDING'],
    apiModelId: 'seedream/4.5-text-to-image',
    availableIn: 'both',
    cascade: {
      kie: { t2i: 'seedream/4.5-text-to-image', i2i: 'seedream/4.5-edit', mode: 'seedream' },
      fal: { t2i: 'fal-ai/bytedance/seedream/v4.5/text-to-image', i2i: 'fal-ai/bytedance/seedream/v4.5/edit' },
    },
  },

  // ============================================
  // BLACK FOREST LABS FLUX 2 (3 models)
  // flux-2-max: no KIE, fal.ai → BFL direct
  // flux-2-pro, flex: KIE → fal.ai → BFL direct
  // ============================================
  'flux-2-max': {
    id: 'flux-2-max',
    name: 'Flux.2 Max',
    description: 'Edicion avanzada, maxima calidad',
    company: 'bfl',
    companyName: 'Black Forest Labs',
    supportsImageInput: true,
    supportsAspectRatio: true,
    maxImages: 1,
    requiresPolling: true,
    pricePerImage: '~$0.08',
    tags: ['PREMIUM'],
    apiModelId: 'flux-2-max',
    availableIn: 'studio',
    cascade: {
      fal: { t2i: 'fal-ai/flux-2-max', i2i: 'fal-ai/flux-2-max/edit' },
      directApi: 'bfl',
    },
  },
  'flux-2-pro': {
    id: 'flux-2-pro',
    name: 'Flux.2 Pro',
    description: 'Edicion y generacion next-gen',
    company: 'bfl',
    companyName: 'Black Forest Labs',
    supportsImageInput: true,
    supportsAspectRatio: true,
    maxImages: 1,
    requiresPolling: true,
    pricePerImage: '~$0.05',
    tags: ['NEW'],
    apiModelId: 'flux-2-pro',
    availableIn: 'studio',
    cascade: {
      kie: { t2i: 'flux-2/pro-text-to-image', i2i: 'flux-2/pro-image-to-image', mode: 'nano-banana' },
      fal: { t2i: 'fal-ai/flux-2-pro', i2i: 'fal-ai/flux-2-pro/edit' },
      directApi: 'bfl',
    },
  },
  'flux-2-flex': {
    id: 'flux-2-flex',
    name: 'Flux.2 Flex',
    description: 'Soporte de tipografia',
    company: 'bfl',
    companyName: 'Black Forest Labs',
    supportsImageInput: true,
    supportsAspectRatio: true,
    maxImages: 1,
    requiresPolling: true,
    pricePerImage: '~$0.05',
    tags: ['NEW'],
    apiModelId: 'flux-2-flex',
    availableIn: 'studio',
    cascade: {
      kie: { t2i: 'flux-2/flex-text-to-image', i2i: 'flux-2/flex-image-to-image', mode: 'nano-banana' },
      fal: { t2i: 'fal-ai/flux-2-flex', i2i: 'fal-ai/flux-2-flex/edit' },
      directApi: 'bfl',
    },
  },

  // ============================================
  // FAL.AI (3 models — backup + standalone)
  // ============================================
  'nano-banana-2': {
    id: 'nano-banana-2',
    name: 'Gemini 3.1 Flash Image',
    description: 'Rapido y economico via fal.ai — Ideal para landings',
    company: 'fal',
    companyName: 'fal.ai',
    supportsImageInput: true,
    supportsAspectRatio: true,
    maxImages: 1,
    requiresPolling: true,
    pricePerImage: '~$0.03',
    recommended: true,
    tags: ['RECOMENDADO', 'FAST', 'NEW'],
    apiModelId: 'fal-ai/nano-banana-2',
    falModelId: 'nano-banana-2',
    availableIn: 'both',
    cascade: {
      kie: { t2i: 'nano-banana-2', i2i: 'nano-banana-2', mode: 'nano-banana' },
      fal: { t2i: 'fal-ai/nano-banana-2' },
      directApi: 'gemini',
    },
  },
  'seedream-5-lite': {
    id: 'seedream-5-lite',
    name: 'Seedream 5 Lite',
    description: 'ByteDance Seedream 5 Lite via fal.ai — Rapido',
    company: 'fal',
    companyName: 'fal.ai',
    supportsImageInput: true,
    supportsAspectRatio: true,
    maxImages: 1,
    requiresPolling: true,
    pricePerImage: '~$0.03',
    tags: ['NEW', 'FAST'],
    apiModelId: 'fal-ai/seedream-3.0',
    falModelId: 'seedream/5-lite',
    availableIn: 'both',
    cascade: {
      kie: { t2i: 'seedream/5-lite-text-to-image', i2i: 'seedream/5-lite-image-to-image', mode: 'seedream' },
      fal: { t2i: 'fal-ai/bytedance/seedream/v5/lite/text-to-image', i2i: 'fal-ai/bytedance/seedream/v5/lite/edit' },
    },
  },
  'seedream-5': {
    id: 'seedream-5',
    name: 'Seedream 5',
    description: 'ByteDance Seedream 5 Pro via fal.ai — Mayor calidad',
    company: 'fal',
    companyName: 'fal.ai',
    supportsImageInput: true,
    supportsAspectRatio: true,
    maxImages: 1,
    requiresPolling: true,
    pricePerImage: '~$0.05',
    tags: ['NEW', 'PREMIUM'],
    apiModelId: 'fal-ai/seedream-3.0/pro',
    falModelId: 'seedream/5',
    availableIn: 'studio',
    cascade: {
      kie: { t2i: 'seedream/5-lite-text-to-image', i2i: 'seedream/5-lite-image-to-image', mode: 'seedream' },
      fal: { t2i: 'fal-ai/seedream-3.0/pro' },
    },
  },
}

// Helper to filter models by availability
function filterModelsByAvailability(models: ImageModelConfig[], target: ModelAvailability): ImageModelConfig[] {
  return models.filter(m => m.availableIn === target || m.availableIn === 'both')
}

// Grouped by company for hierarchical selector - ALL models (for Studio IA)
export const IMAGE_COMPANY_GROUPS: ImageCompanyGroup[] = [
  {
    id: 'fal',
    name: 'fal.ai',
    icon: 'Zap',
    color: 'from-indigo-500 to-violet-500',
    models: [
      IMAGE_MODELS['nano-banana-2'],
      IMAGE_MODELS['seedream-5-lite'],
      IMAGE_MODELS['seedream-5'],
    ],
  },
  {
    id: 'google',
    name: 'Google',
    icon: 'Sparkles',
    color: 'from-blue-500 to-purple-500',
    models: [
      IMAGE_MODELS['gemini-3-pro-image'],
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: 'Zap',
    color: 'from-green-500 to-emerald-500',
    models: [
      IMAGE_MODELS['gpt-image-1.5'],
    ],
  },
  {
    id: 'bytedance',
    name: 'ByteDance',
    icon: 'Image',
    color: 'from-orange-500 to-red-500',
    models: [
      IMAGE_MODELS['seedream-4.5'],
    ],
  },
  {
    id: 'bfl',
    name: 'Black Forest Labs',
    icon: 'Cpu',
    color: 'from-pink-500 to-rose-500',
    models: [
      IMAGE_MODELS['flux-2-max'],
      IMAGE_MODELS['flux-2-pro'],
      IMAGE_MODELS['flux-2-flex'],
    ],
  },
]

// Models available for LANDING page generation
// Only models that preserve product + template well
export const LANDING_COMPANY_GROUPS: ImageCompanyGroup[] = [
  {
    id: 'fal',
    name: 'fal.ai',
    icon: 'Zap',
    color: 'from-indigo-500 to-violet-500',
    models: filterModelsByAvailability([
      IMAGE_MODELS['nano-banana-2'],
      IMAGE_MODELS['seedream-5-lite'],
    ], 'landing'),
  },
  {
    id: 'google',
    name: 'Google',
    icon: 'Sparkles',
    color: 'from-blue-500 to-purple-500',
    models: filterModelsByAvailability([
      IMAGE_MODELS['gemini-3-pro-image'],
    ], 'landing'),
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: 'Zap',
    color: 'from-green-500 to-emerald-500',
    models: filterModelsByAvailability([
      IMAGE_MODELS['gpt-image-1.5'],
    ], 'landing'),
  },
]

// Models available for STUDIO IA (creative generation)
// All models including experimental ones
export const STUDIO_COMPANY_GROUPS: ImageCompanyGroup[] = IMAGE_COMPANY_GROUPS

// Legacy providers for backward compatibility
export interface ImageProviderConfig {
  id: ImageProviderType
  name: string
  description: string
  supportsImageInput: boolean
  supportsAspectRatio: boolean
  maxImages: number
  requiresPolling: boolean
}

export const IMAGE_PROVIDERS: Record<ImageProviderType, ImageProviderConfig> = {
  gemini: {
    id: 'gemini',
    name: 'Gemini 3 Pro Image',
    description: 'Google Gemini - Mejor calidad y texto perfecto',
    supportsImageInput: true,
    supportsAspectRatio: true,
    maxImages: 1,
    requiresPolling: false,
  },
  openai: {
    id: 'openai',
    name: 'GPT Image 1.5',
    description: 'OpenAI GPT Image - Alta calidad general',
    supportsImageInput: true,
    supportsAspectRatio: true,
    maxImages: 1,
    requiresPolling: false,
  },
  seedream: {
    id: 'seedream',
    name: 'Seedream 4.5',
    description: 'ByteDance Seedream - Excelente para edicion',
    supportsImageInput: true,
    supportsAspectRatio: true,
    maxImages: 6,
    requiresPolling: true,
  },
  flux: {
    id: 'flux',
    name: 'FLUX 2 Pro',
    description: 'Black Forest Labs - Next-gen generation',
    supportsImageInput: true,
    supportsAspectRatio: true,
    maxImages: 1,
    requiresPolling: true,
  },
  fal: {
    id: 'fal',
    name: 'fal.ai',
    description: 'fal.ai - Modelos serverless rapidos',
    supportsImageInput: true,
    supportsAspectRatio: true,
    maxImages: 1,
    requiresPolling: true,
  },
}

// Map model ID to legacy provider type
export function modelIdToProviderType(modelId: ImageModelId): ImageProviderType {
  const model = IMAGE_MODELS[modelId]
  switch (model.company) {
    case 'google':
      return 'gemini'
    case 'openai':
      return 'openai'
    case 'bytedance':
      return 'seedream'
    case 'bfl':
      return 'flux'
    case 'fal':
      return 'fal'
  }
}

// Get API key field name for a model
export function getApiKeyField(modelId: ImageModelId): string {
  const model = IMAGE_MODELS[modelId]
  switch (model.company) {
    case 'google':
      return 'google_api_key'
    case 'openai':
      return 'openai_api_key'
    case 'bytedance':
      return 'kie_api_key'
    case 'bfl':
      return 'bfl_api_key'
    case 'fal':
      return 'fal_api_key'
  }
}

// Get the API model ID for a given model
export function getApiModelId(modelId: ImageModelId): string {
  return IMAGE_MODELS[modelId].apiModelId
}

export interface GenerateImageRequest {
  provider: ImageProviderType
  // The specific model ID selected by user
  modelId: ImageModelId
  prompt: string
  // Template as URL (preferred) or base64
  templateUrl?: string
  templateBase64?: string
  templateMimeType?: string
  // Product images as base64 (for providers that accept it)
  productImagesBase64?: { data: string; mimeType: string }[]
  // Product images as public URLs (for KIE.ai which requires URLs)
  productImageUrls?: string[]
  // Aspect ratio
  aspectRatio?: '9:16' | '1:1' | '16:9' | '4:5' | '4:3' | '3:4' | '3:2' | '2:3'
  // Quality settings
  quality?: 'standard' | 'hd' | '2k' | '4k'
  // Product info for prompt building
  productName?: string
  creativeControls?: {
    productDetails?: string
    salesAngle?: string
    targetAvatar?: string
    additionalInstructions?: string
    // Pricing (all optional)
    priceAfter?: string
    priceBefore?: string
    priceCombo2?: string
    priceCombo3?: string
    currencySymbol?: string
    // Country
    targetCountry?: string
    // Visual style
    colorPalette?: {
      primary: string
      secondary: string
      accent: string
      extra?: string
    }
    typography?: {
      headings: string
      subheadings: string
      body: string
    }
    productContext?: {
      description?: string
      benefits?: string
      problems?: string
      ingredients?: string
      differentiator?: string
    }
    // Section & angle info (Phase 3)
    sectionType?: string
    angleName?: string
    angleTone?: string
  }
}

export interface GenerateImageResult {
  success: boolean
  imageBase64?: string
  mimeType?: string
  error?: string
  provider: ImageProviderType
  // For async providers
  taskId?: string
  status?: 'pending' | 'processing' | 'completed' | 'failed'
}

export interface ImageProvider {
  id: ImageProviderType
  generate(request: GenerateImageRequest, apiKey: string): Promise<GenerateImageResult>
  // For providers that require polling
  checkStatus?(taskId: string, apiKey: string): Promise<GenerateImageResult>
}

// Helper to convert aspect ratio string to dimensions
export function aspectRatioToDimensions(ratio: string): { width: number; height: number } {
  const dimensions: Record<string, { width: number; height: number }> = {
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1024, height: 1024 },
    '16:9': { width: 1920, height: 1080 },
    '4:5': { width: 1080, height: 1350 },
    '4:3': { width: 1024, height: 768 },
    '3:4': { width: 768, height: 1024 },
    '3:2': { width: 1024, height: 683 },
    '2:3': { width: 683, height: 1024 },
  }
  return dimensions[ratio] || dimensions['1:1']
}

// Helper to map aspect ratio to provider-specific formats
export function mapAspectRatioForProvider(ratio: string, provider: ImageProviderType): string {
  // Most providers use the same format
  if (provider === 'seedream') {
    // Seedream 4.5 uses direct aspect_ratio like "1:1", "9:16", etc.
    // Seedream 4.0 and 3.0 use image_size enum
    // We'll return the direct ratio and let the provider handle it
    return ratio
  }
  return ratio
}
