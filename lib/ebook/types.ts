// ============================================
// EBOOK GENERATOR — Types & Interfaces
// ============================================

export type ProductSource = 'dropkiller' | 'landing' | 'droppage' | 'manual'

export interface ProductInput {
  source: ProductSource
  name: string
  description: string
  images: string[] // URLs or base64
  externalId?: string // DropKiller ID, product ID, etc.
}

export interface EbookIdea {
  id: string
  title: string
  subtitle: string
  description: string
  category: EbookCategory
  targetAudience: string
}

export type EbookCategory =
  | 'salud-bienestar'
  | 'belleza-cuidado'
  | 'tecnologia'
  | 'hogar-cocina'
  | 'moda-estilo'
  | 'universal'

export interface EbookChapter {
  number: number
  title: string
  summary: string
  imageKeyword: string // keyword para generar imagen ilustrativa
  content?: string // contenido generado (se llena en paso de generación)
  imageUrl?: string // imagen generada (se llena en paso de generación)
}

export interface EbookOutline {
  title: string
  subtitle: string
  introduction: string
  chapters: EbookChapter[]
  conclusion: string
}

export interface EbookTemplate {
  id: EbookCategory
  name: string
  description: string
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    text: string
    textLight: string
    chapterBg: string
  }
  coverStyle: 'gradient' | 'photo-overlay' | 'minimal' | 'bold'
}

export interface EbookConfig {
  product: ProductInput
  idea: EbookIdea
  template: EbookTemplate
  outline: EbookOutline
  logoUrl?: string
}

export interface GenerationStep {
  type: 'cover' | 'chapter-text' | 'chapter-image' | 'compiling' | 'uploading' | 'done' | 'error'
  chapter?: number
  totalChapters?: number
  message: string
  progress: number // 0-100
}

export interface EbookResult {
  id: string
  title: string
  pdfUrl: string
  storageUrl: string
  r2Url?: string
  coverImageUrl?: string
  chaptersCount: number
  pagesEstimate: number
}
