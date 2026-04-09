'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import { CourseCard } from '@/components/academia/CourseCard'
import { CommunityVideoCard } from '@/components/academia/CommunityVideoCard'
import { CourseEditor } from '@/components/academia/CourseEditor'
import { Button } from '@/components/ui/Button'
import {
  BookOpen,
  Users,
  Plus,
  Search,
  Loader2,
  Youtube,
  X,
} from 'lucide-react'
import { extractYouTubeId } from '@/lib/utils/youtube'
import toast from 'react-hot-toast'
import { isAdmin as isAdminEmail } from '@/lib/admin'

type Tab = 'cursos' | 'comunidad'

interface Course {
  id: string
  title: string
  description: string | null
  thumbnail_url: string | null
  category: string
  is_published: boolean
  lessons_count: number
  sort_order: number
  created_at: string
}

interface CommunityVideo {
  id: string
  user_id: string
  title: string
  description: string | null
  youtube_url: string
  youtube_video_id: string
  user_name: string | null
  created_at: string
}

export default function AcademiaPage() {
  const [tab, setTab] = useState<Tab>('cursos')
  const [courses, setCourses] = useState<Course[]>([])
  const [communityVideos, setCommunityVideos] = useState<CommunityVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showEditor, setShowEditor] = useState(false)
  const [editingCourse, setEditingCourse] = useState<any>(null)
  const [showShareModal, setShowShareModal] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email || null
      setIsAdmin(isAdminEmail(email))
      setUserId(data.user?.id || null)
    })
  }, [])

  useEffect(() => {
    if (tab === 'cursos') fetchCourses()
    else fetchCommunityVideos()
  }, [tab])

  const fetchCourses = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/academia/courses')
      const data = await res.json()
      setCourses(data.courses || [])
    } catch {
      toast.error('Error al cargar cursos')
    } finally {
      setLoading(false)
    }
  }

  const fetchCommunityVideos = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/academia/community')
      const data = await res.json()
      setCommunityVideos(data.videos || [])
    } catch {
      toast.error('Error al cargar videos')
    } finally {
      setLoading(false)
    }
  }

  const handleEditCourse = async (courseId: string) => {
    try {
      const res = await fetch(`/api/academia/courses/${courseId}`)
      const data = await res.json()
      setEditingCourse(data.course)
      setShowEditor(true)
    } catch {
      toast.error('Error al cargar curso')
    }
  }

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Estas seguro de eliminar este curso y todas sus lecciones?')) return
    try {
      await fetch(`/api/academia/courses/${courseId}`, { method: 'DELETE' })
      toast.success('Curso eliminado')
      fetchCourses()
    } catch {
      toast.error('Error al eliminar curso')
    }
  }

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('Eliminar este video?')) return
    try {
      await fetch(`/api/academia/community?id=${videoId}`, { method: 'DELETE' })
      toast.success('Video eliminado')
      fetchCommunityVideos()
    } catch {
      toast.error('Error al eliminar video')
    }
  }

  // Filtering
  const filteredCourses = courses.filter(c => {
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase())
    const matchCategory = categoryFilter === 'all' || c.category === categoryFilter
    return matchSearch && matchCategory
  })

  const filteredVideos = communityVideos.filter(v =>
    !search || v.title.toLowerCase().includes(search.toLowerCase())
  )

  const uniqueCategories = Array.from(new Set(courses.map(c => c.category)))

  const tabs = [
    { id: 'cursos' as Tab, label: 'Cursos', icon: BookOpen },
    { id: 'comunidad' as Tab, label: 'Comunidad', icon: Users },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Academia</h1>
        <p className="text-text-secondary mt-1">
          Aprende con cursos y videos compartidos por la comunidad
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-1 p-1 bg-surface rounded-xl border border-border">
          {tabs.map(t => {
            const Icon = t.icon
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setSearch('') }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-accent text-background shadow-lg shadow-accent/25'
                    : 'text-text-secondary hover:text-text-primary hover:bg-border/50'
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          {tab === 'comunidad' && (
            <Button size="sm" onClick={() => setShowShareModal(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Compartir Video
            </Button>
          )}
          {tab === 'cursos' && isAdmin && (
            <Button size="sm" onClick={() => { setEditingCourse(null); setShowEditor(true) }}>
              <Plus className="w-4 h-4 mr-1" />
              Crear Curso
            </Button>
          )}
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'cursos' ? 'Buscar cursos...' : 'Buscar videos...'}
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-secondary/50 focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </div>
        {tab === 'cursos' && uniqueCategories.length > 1 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:ring-2 focus:ring-accent focus:border-transparent"
          >
            <option value="all">Todas las categorias</option>
            {uniqueCategories.map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : tab === 'cursos' ? (
        filteredCourses.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-text-secondary/30 mx-auto mb-3" />
            <p className="text-text-secondary">
              {search ? 'No se encontraron cursos' : 'Aun no hay cursos disponibles'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCourses.map(course => (
              <div key={course.id} className="relative group/admin">
                <CourseCard
                  id={course.id}
                  title={course.title}
                  description={course.description}
                  thumbnail_url={course.thumbnail_url}
                  category={course.category}
                  lessons_count={course.lessons_count}
                  is_published={course.is_published}
                  isAdmin={isAdmin}
                />
                {isAdmin && (
                  <div className="absolute top-2 right-2 z-10 hidden group-hover/admin:flex gap-1">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditCourse(course.id) }}
                      className="px-2 py-1 bg-accent text-background text-[10px] font-medium rounded-md shadow-lg hover:bg-accent-hover transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteCourse(course.id) }}
                      className="px-2 py-1 bg-error text-white text-[10px] font-medium rounded-md shadow-lg hover:bg-error/80 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        filteredVideos.length === 0 ? (
          <div className="text-center py-16">
            <Youtube className="w-12 h-12 text-text-secondary/30 mx-auto mb-3" />
            <p className="text-text-secondary">
              {search ? 'No se encontraron videos' : 'Aun no hay videos compartidos'}
            </p>
            <Button size="sm" className="mt-4" onClick={() => setShowShareModal(true)}>
              Se el primero en compartir
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVideos.map(video => (
              <CommunityVideoCard
                key={video.id}
                id={video.id}
                title={video.title}
                description={video.description}
                youtube_video_id={video.youtube_video_id}
                user_name={video.user_name}
                created_at={video.created_at}
                canDelete={isAdmin || video.user_id === userId}
                onDelete={handleDeleteVideo}
              />
            ))}
          </div>
        )
      )}

      {/* Course Editor Modal */}
      {showEditor && (
        <CourseEditor
          course={editingCourse}
          onClose={() => { setShowEditor(false); setEditingCourse(null) }}
          onSaved={() => { setShowEditor(false); setEditingCourse(null); fetchCourses() }}
        />
      )}

      {/* Share Video Modal */}
      {showShareModal && (
        <ShareVideoModal
          onClose={() => setShowShareModal(false)}
          onShared={() => { setShowShareModal(false); fetchCommunityVideos() }}
        />
      )}
    </div>
  )
}

// --- Share Video Modal ---
function ShareVideoModal({ onClose, onShared }: { onClose: () => void; onShared: () => void }) {
  const [title, setTitle] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [description, setDescription] = useState('')
  const [userName, setUserName] = useState('')
  const [saving, setSaving] = useState(false)

  const videoId = extractYouTubeId(youtubeUrl)

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('El titulo es requerido')
      return
    }
    if (!youtubeUrl.trim() || !videoId) {
      toast.error('Pega una URL valida de YouTube')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/academia/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          youtube_url: youtubeUrl.trim(),
          user_name: userName.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al compartir')
      }
      toast.success('Video compartido!')
      onShared()
    } catch (err: any) {
      toast.error(err.message || 'Error al compartir video')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Compartir Video</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* YouTube URL with preview */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              URL de YouTube
            </label>
            <input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-secondary/50 focus:ring-2 focus:ring-accent focus:border-transparent"
            />
            {videoId && (
              <div className="mt-2 rounded-lg overflow-hidden border border-border">
                <img
                  src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                  alt="Preview"
                  className="w-full aspect-video object-cover"
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Titulo
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titulo del video"
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-secondary/50 focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Descripcion (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe brevemente el video..."
              rows={2}
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-secondary/50 focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Tu nombre (opcional)
            </label>
            <input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Tu nombre o alias"
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-secondary/50 focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={saving}>
            <Youtube className="w-4 h-4 mr-1" />
            Compartir
          </Button>
        </div>
      </div>
    </div>
  )
}
