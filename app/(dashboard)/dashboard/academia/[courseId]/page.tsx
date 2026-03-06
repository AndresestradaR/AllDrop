'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { getYouTubeEmbedUrl, getYouTubeThumbnail } from '@/lib/utils/youtube'
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Play,
  List,
  X,
} from 'lucide-react'
import Link from 'next/link'

interface Lesson {
  id: string
  title: string
  description: string | null
  youtube_url: string
  youtube_video_id: string
  duration_seconds: number | null
  sort_order: number
}

interface Course {
  id: string
  title: string
  description: string | null
  category: string
  lessons: Lesson[]
}

export default function CoursePage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.courseId as string

  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeLesson, setActiveLesson] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebar, setMobileSidebar] = useState(false)

  useEffect(() => {
    fetchCourse()
  }, [courseId])

  const fetchCourse = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/academia/courses/${courseId}`)
      if (!res.ok) {
        router.push('/dashboard/academia')
        return
      }
      const data = await res.json()
      setCourse(data.course)
    } catch {
      router.push('/dashboard/academia')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    )
  }

  if (!course || course.lessons.length === 0) {
    return (
      <div className="text-center py-20">
        <BookOpen className="w-12 h-12 text-text-secondary/30 mx-auto mb-3" />
        <p className="text-text-secondary mb-4">Este curso no tiene lecciones aun</p>
        <Link
          href="/dashboard/academia"
          className="text-accent hover:text-accent-hover text-sm font-medium"
        >
          Volver a la Academia
        </Link>
      </div>
    )
  }

  const lesson = course.lessons[activeLesson]
  const hasPrev = activeLesson > 0
  const hasNext = activeLesson < course.lessons.length - 1

  return (
    <div className="-m-6">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface">
        <Link
          href="/dashboard/academia"
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Academia</span>
        </Link>
        <span className="text-border">/</span>
        <h1 className="text-sm font-semibold text-text-primary truncate">{course.title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-text-secondary hidden sm:inline">
            {activeLesson + 1} / {course.lessons.length}
          </span>
          <button
            onClick={() => setMobileSidebar(!mobileSidebar)}
            className="lg:hidden p-1.5 text-text-secondary hover:text-text-primary transition-colors"
          >
            <List className="w-5 h-5" />
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:block p-1.5 text-text-secondary hover:text-text-primary transition-colors"
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Main Content */}
        <div className={cn('flex-1 min-w-0', sidebarOpen && 'lg:mr-80')}>
          {/* Video */}
          <div className="bg-black">
            <div className="relative w-full max-w-5xl mx-auto" style={{ paddingBottom: '56.25%' }}>
              <iframe
                key={lesson.youtube_video_id}
                className="absolute inset-0 w-full h-full"
                src={`${getYouTubeEmbedUrl(lesson.youtube_video_id)}?rel=0`}
                title={lesson.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>

          {/* Lesson Info + Navigation */}
          <div className="p-4 sm:p-6 max-w-5xl mx-auto">
            {/* Prev / Next */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => hasPrev && setActiveLesson(activeLesson - 1)}
                disabled={!hasPrev}
                className={cn(
                  'flex items-center gap-1 text-sm font-medium transition-colors',
                  hasPrev ? 'text-accent hover:text-accent-hover' : 'text-text-secondary/30 cursor-not-allowed'
                )}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <button
                onClick={() => hasNext && setActiveLesson(activeLesson + 1)}
                disabled={!hasNext}
                className={cn(
                  'flex items-center gap-1 text-sm font-medium transition-colors',
                  hasNext ? 'text-accent hover:text-accent-hover' : 'text-text-secondary/30 cursor-not-allowed'
                )}
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <h2 className="text-xl font-bold text-text-primary mb-2">{lesson.title}</h2>
            {lesson.description && (
              <p className="text-sm text-text-secondary leading-relaxed">{lesson.description}</p>
            )}
          </div>
        </div>

        {/* Desktop Sidebar - Lesson List */}
        {sidebarOpen && (
          <aside className="hidden lg:block fixed right-0 top-0 h-full w-80 border-l border-border bg-surface overflow-y-auto z-20 pt-16">
            <div className="p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">
                Contenido del curso ({course.lessons.length})
              </h3>
              <div className="space-y-1">
                {course.lessons.map((l, i) => (
                  <button
                    key={l.id}
                    onClick={() => setActiveLesson(i)}
                    className={cn(
                      'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all',
                      i === activeLesson
                        ? 'bg-accent/10 border border-accent/30'
                        : 'hover:bg-border/50'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold',
                      i === activeLesson
                        ? 'bg-accent text-background'
                        : 'bg-border text-text-secondary'
                    )}>
                      {i < activeLesson ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : i === activeLesson ? (
                        <Play className="w-3.5 h-3.5 ml-0.5" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={cn(
                        'text-sm font-medium line-clamp-2',
                        i === activeLesson ? 'text-accent' : 'text-text-primary'
                      )}>
                        {l.title}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* Mobile Sidebar Overlay */}
        {mobileSidebar && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setMobileSidebar(false)}
            />
            <aside className="fixed right-0 top-0 h-full w-80 border-l border-border bg-surface overflow-y-auto z-50 lg:hidden">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-text-primary">
                  Contenido ({course.lessons.length})
                </h3>
                <button
                  onClick={() => setMobileSidebar(false)}
                  className="text-text-secondary hover:text-text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-1">
                {course.lessons.map((l, i) => (
                  <button
                    key={l.id}
                    onClick={() => { setActiveLesson(i); setMobileSidebar(false) }}
                    className={cn(
                      'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all',
                      i === activeLesson
                        ? 'bg-accent/10 border border-accent/30'
                        : 'hover:bg-border/50'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold',
                      i === activeLesson
                        ? 'bg-accent text-background'
                        : 'bg-border text-text-secondary'
                    )}>
                      {i < activeLesson ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : i === activeLesson ? (
                        <Play className="w-3.5 h-3.5 ml-0.5" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={cn(
                        'text-sm font-medium line-clamp-2',
                        i === activeLesson ? 'text-accent' : 'text-text-primary'
                      )}>
                        {l.title}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  )
}
