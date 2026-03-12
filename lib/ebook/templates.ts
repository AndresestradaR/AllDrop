import type { EbookTemplate, EbookCategory } from './types'

// ============================================
// 6 PLANTILLAS TEMÁTICAS PROFESIONALES
// ============================================

export const EBOOK_TEMPLATES: Record<EbookCategory, EbookTemplate> = {
  'salud-bienestar': {
    id: 'salud-bienestar',
    name: 'Salud & Bienestar',
    description: 'Suplementos, postura, fitness, vida saludable',
    colors: {
      primary: '#2D8F6F',
      secondary: '#A8E6CF',
      accent: '#1B5E4B',
      background: '#F0FAF5',
      text: '#1A3C34',
      textLight: '#5A7D73',
      chapterBg: '#E8F5EE',
    },
    coverStyle: 'gradient',
  },
  'belleza-cuidado': {
    id: 'belleza-cuidado',
    name: 'Belleza & Cuidado',
    description: 'Skincare, cabello, maquillaje, cuidado personal',
    colors: {
      primary: '#C2527A',
      secondary: '#F5D0DB',
      accent: '#8B1A4A',
      background: '#FFF5F8',
      text: '#3D1525',
      textLight: '#8A6070',
      chapterBg: '#FDE8EF',
    },
    coverStyle: 'photo-overlay',
  },
  'tecnologia': {
    id: 'tecnologia',
    name: 'Tecnología',
    description: 'Gadgets, electrónicos, accesorios tech',
    colors: {
      primary: '#3B82F6',
      secondary: '#93C5FD',
      accent: '#1E40AF',
      background: '#F0F4FF',
      text: '#1E293B',
      textLight: '#64748B',
      chapterBg: '#E0EAFF',
    },
    coverStyle: 'bold',
  },
  'hogar-cocina': {
    id: 'hogar-cocina',
    name: 'Hogar & Cocina',
    description: 'Limpieza, cocina, organización, decoración',
    colors: {
      primary: '#D97706',
      secondary: '#FDE68A',
      accent: '#92400E',
      background: '#FFFBEB',
      text: '#422006',
      textLight: '#78716C',
      chapterBg: '#FEF3C7',
    },
    coverStyle: 'gradient',
  },
  'moda-estilo': {
    id: 'moda-estilo',
    name: 'Moda & Estilo',
    description: 'Ropa, accesorios, calzado, joyería',
    colors: {
      primary: '#18181B',
      secondary: '#D4D4D8',
      accent: '#A855F7',
      background: '#FAFAFA',
      text: '#18181B',
      textLight: '#71717A',
      chapterBg: '#F4F4F5',
    },
    coverStyle: 'minimal',
  },
  'universal': {
    id: 'universal',
    name: 'Universal',
    description: 'Cualquier tipo de producto',
    colors: {
      primary: '#6366F1',
      secondary: '#C7D2FE',
      accent: '#4338CA',
      background: '#F8F9FF',
      text: '#1E1B4B',
      textLight: '#6B7280',
      chapterBg: '#EEF2FF',
    },
    coverStyle: 'gradient',
  },
}

export const TEMPLATE_LIST = Object.values(EBOOK_TEMPLATES)

export function getTemplate(category: EbookCategory): EbookTemplate {
  return EBOOK_TEMPLATES[category] || EBOOK_TEMPLATES['universal']
}

export function suggestTemplate(productCategory: string): EbookCategory {
  const lower = productCategory.toLowerCase()

  if (/salud|suplement|vitamin|postura|fitness|deport|gym|ejercicio|medic|dolor/.test(lower))
    return 'salud-bienestar'
  if (/belleza|skin|cabello|pelo|cream|cuid|maquillaj|facial|serum|acne/.test(lower))
    return 'belleza-cuidado'
  if (/tech|electr|gadget|cargador|audifono|celular|comput|smart|led|usb|robot/.test(lower))
    return 'tecnologia'
  if (/hogar|cocina|limpi|organiz|decor|jardin|herramient|casa|bano|cama/.test(lower))
    return 'hogar-cocina'
  if (/moda|ropa|zapato|calzado|accesorio|joyer|bolso|reloj|gafa|lente|faja/.test(lower))
    return 'moda-estilo'

  return 'universal'
}
