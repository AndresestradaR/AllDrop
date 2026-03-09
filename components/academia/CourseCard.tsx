'use client'

import Link from 'next/link'
import { BookOpen, Clock } from 'lucide-react'
import { getYouTubeThumbnail } from '@/lib/utils/youtube'

interface CourseCardProps {
  id: string
  title: string
  description?: string | null
  thumbnail_url?: string | null
  category: string
  lessons_count: number
  is_published?: boolean
  isAdmin?: boolean
}

const categoryLabels: Record<string, string> = {
  general: 'General',
  dropshipping: 'Dropshipping',
  marketing: 'Marketing',
  ecommerce: 'E-commerce',
  ads: 'Publicidad',
  copywriting: 'Copywriting',
  design: 'Diseño',
  mindset: 'Mentalidad',
}

export function CourseCard({
  id,
  title,
  description,
  thumbnail_url,
  category,
  lessons_count,
  is_published,
  isAdmin,
}: CourseCardProps) {
  const thumb = thumbnail_url || '/placeholder-course.jpg'

  return (
    <Link
      href={`/dashboard/academia/${id}`}
      className="group block rounded-xl border border-border bg-surface overflow-hidden transition-all duration-200 hover:border-accent/50 hover:shadow-lg hover:-translate-y-1"
    >
      <div className="relative aspect-video bg-background overflow-hidden">
        <img
          src={thumb}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/default/hqdefault.jpg`
          }}
        />
        {isAdmin && !is_published && (
          <div className="absolute top-2 right-2 bg-amber-500/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            Borrador
          </div>
        )}
        <div className="absolute top-2 left-2 bg-surface/80 backdrop-blur-sm text-text-secondary text-[10px] font-medium px-2 py-0.5 rounded-full">
          {categoryLabels[category] || category}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-text-primary line-clamp-2 mb-1 group-hover:text-accent transition-colors">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-text-secondary line-clamp-2 mb-3">{description}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-text-secondary">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            {lessons_count} {lessons_count === 1 ? 'leccion' : 'lecciones'}
          </span>
        </div>
      </div>
    </Link>
  )
}
