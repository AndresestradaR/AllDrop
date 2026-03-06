'use client'

import { useState } from 'react'
import { X, Plus, Trash2, GripVertical, ArrowUp, ArrowDown, Save, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { extractYouTubeId, getYouTubeThumbnail } from '@/lib/utils/youtube'
import toast from 'react-hot-toast'

interface Lesson {
  id?: string
  title: string
  description?: string
  youtube_url: string
  youtube_video_id?: string
  sort_order: number
}

interface Course {
  id?: string
  title: string
  description?: string
  thumbnail_url?: string
  category: string
  is_published: boolean
  lessons?: Lesson[]
}

interface CourseEditorProps {
  course?: Course & { id: string; lessons: Lesson[] }
  onClose: () => void
  onSaved: () => void
}

const categories = [
  { value: 'general', label: 'General' },
  { value: 'dropshipping', label: 'Dropshipping' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'ads', label: 'Publicidad' },
  { value: 'copywriting', label: 'Copywriting' },
  { value: 'design', label: 'Diseño' },
  { value: 'mindset', label: 'Mentalidad' },
]

export function CourseEditor({ course, onClose, onSaved }: CourseEditorProps) {
  const [title, setTitle] = useState(course?.title || '')
  const [description, setDescription] = useState(course?.description || '')
  const [category, setCategory] = useState(course?.category || 'general')
  const [isPublished, setIsPublished] = useState(course?.is_published || false)
  const [lessons, setLessons] = useState<Lesson[]>(
    course?.lessons?.map((l, i) => ({ ...l, sort_order: l.sort_order ?? i })) || []
  )
  const [saving, setSaving] = useState(false)

  const addLesson = () => {
    setLessons(prev => [
      ...prev,
      { title: '', youtube_url: '', sort_order: prev.length }
    ])
  }

  const updateLesson = (index: number, field: keyof Lesson, value: string | number) => {
    setLessons(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l))
  }

  const removeLesson = (index: number) => {
    setLessons(prev => prev.filter((_, i) => i !== index).map((l, i) => ({ ...l, sort_order: i })))
  }

  const moveLesson = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= lessons.length) return
    const newLessons = [...lessons]
    ;[newLessons[index], newLessons[newIndex]] = [newLessons[newIndex], newLessons[index]]
    setLessons(newLessons.map((l, i) => ({ ...l, sort_order: i })))
  }

  // Auto-generate thumbnail from first lesson
  const autoThumbnail = (() => {
    for (const l of lessons) {
      const vid = extractYouTubeId(l.youtube_url)
      if (vid) return getYouTubeThumbnail(vid)
    }
    return null
  })()

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('El titulo es requerido')
      return
    }

    // Validate lessons
    for (let i = 0; i < lessons.length; i++) {
      if (!lessons[i].title.trim()) {
        toast.error(`La leccion ${i + 1} necesita un titulo`)
        return
      }
      if (!lessons[i].youtube_url.trim()) {
        toast.error(`La leccion ${i + 1} necesita una URL de YouTube`)
        return
      }
      if (!extractYouTubeId(lessons[i].youtube_url)) {
        toast.error(`La leccion ${i + 1} tiene una URL de YouTube invalida`)
        return
      }
    }

    setSaving(true)
    try {
      const thumbnailUrl = autoThumbnail || null

      if (course?.id) {
        // Update existing course
        const res = await fetch(`/api/academia/courses/${course.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            thumbnail_url: thumbnailUrl,
            category,
            is_published: isPublished,
          }),
        })
        if (!res.ok) throw new Error('Error al actualizar curso')

        // Delete removed lessons
        const existingIds = new Set(lessons.filter(l => l.id).map(l => l.id))
        for (const oldLesson of (course.lessons || [])) {
          if (oldLesson.id && !existingIds.has(oldLesson.id)) {
            await fetch(`/api/academia/lessons?id=${oldLesson.id}`, { method: 'DELETE' })
          }
        }

        // Update/create lessons
        for (const lesson of lessons) {
          if (lesson.id) {
            await fetch('/api/academia/lessons', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: lesson.id,
                title: lesson.title.trim(),
                description: lesson.description?.trim() || null,
                youtube_url: lesson.youtube_url.trim(),
                sort_order: lesson.sort_order,
              }),
            })
          } else {
            await fetch('/api/academia/lessons', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                course_id: course.id,
                title: lesson.title.trim(),
                description: lesson.description?.trim() || null,
                youtube_url: lesson.youtube_url.trim(),
                sort_order: lesson.sort_order,
              }),
            })
          }
        }

        toast.success('Curso actualizado')
      } else {
        // Create new course
        const res = await fetch('/api/academia/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            thumbnail_url: thumbnailUrl,
            category,
          }),
        })
        if (!res.ok) throw new Error('Error al crear curso')

        const { course: newCourse } = await res.json()

        // Create lessons
        for (const lesson of lessons) {
          await fetch('/api/academia/lessons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              course_id: newCourse.id,
              title: lesson.title.trim(),
              description: lesson.description?.trim() || null,
              youtube_url: lesson.youtube_url.trim(),
              sort_order: lesson.sort_order,
            }),
          })
        }

        toast.success('Curso creado')
      }

      onSaved()
    } catch (err) {
      console.error('Save error:', err)
      toast.error('Error al guardar el curso')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="relative w-full max-w-3xl bg-surface border border-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">
            {course?.id ? 'Editar Curso' : 'Nuevo Curso'}
          </h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Course Details */}
          <div className="space-y-4">
            <Input
              label="Titulo del curso"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Curso de Dropshipping desde Cero"
            />
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Descripcion
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe de que trata el curso..."
                rows={3}
                className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-secondary/50 focus:ring-2 focus:ring-accent focus:border-transparent resize-none text-sm"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-accent focus:border-transparent text-sm"
                >
                  {categories.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setIsPublished(!isPublished)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isPublished
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-surface border border-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {isPublished ? 'Publicado' : 'Borrador'}
                </button>
              </div>
            </div>
          </div>

          {/* Lessons */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary">
                Lecciones ({lessons.length})
              </h3>
              <Button size="sm" variant="secondary" onClick={addLesson}>
                <Plus className="w-4 h-4 mr-1" />
                Agregar Leccion
              </Button>
            </div>

            {lessons.length === 0 && (
              <div className="text-center py-8 text-text-secondary text-sm border border-dashed border-border rounded-lg">
                Aun no hay lecciones. Agrega la primera.
              </div>
            )}

            <div className="space-y-3">
              {lessons.map((lesson, index) => {
                const videoId = extractYouTubeId(lesson.youtube_url)
                return (
                  <div
                    key={index}
                    className="border border-border rounded-lg p-4 bg-background/50"
                  >
                    <div className="flex items-start gap-3">
                      {/* Thumbnail preview */}
                      <div className="w-24 h-16 rounded-lg overflow-hidden bg-surface flex-shrink-0 border border-border">
                        {videoId ? (
                          <img
                            src={getYouTubeThumbnail(videoId)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-secondary/30 text-xs">
                            Vista previa
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-text-secondary/70 w-4">
                            {index + 1}.
                          </span>
                          <input
                            value={lesson.title}
                            onChange={(e) => updateLesson(index, 'title', e.target.value)}
                            placeholder="Titulo de la leccion"
                            className="flex-1 px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-secondary/50 focus:ring-2 focus:ring-accent focus:border-transparent"
                          />
                        </div>
                        <input
                          value={lesson.youtube_url}
                          onChange={(e) => updateLesson(index, 'youtube_url', e.target.value)}
                          placeholder="URL de YouTube (ej: https://youtube.com/watch?v=...)"
                          className="w-full px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-secondary/50 focus:ring-2 focus:ring-accent focus:border-transparent"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveLesson(index, 'up')}
                          disabled={index === 0}
                          className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveLesson(index, 'down')}
                          disabled={index === lessons.length - 1}
                          className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeLesson(index)}
                          className="p-1 text-text-secondary hover:text-error transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} isLoading={saving}>
            <Save className="w-4 h-4 mr-1" />
            {course?.id ? 'Guardar Cambios' : 'Crear Curso'}
          </Button>
        </div>
      </div>
    </div>
  )
}
