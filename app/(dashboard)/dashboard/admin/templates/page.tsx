'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, Loader2, X, FolderOpen, Image as ImageIcon, Trash2, Check } from 'lucide-react'
import { Button } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const ADMIN_EMAIL = 'trucosecomydrop@gmail.com'

// Map folder names to template categories
const FOLDER_TO_CATEGORY: Record<string, string> = {
  '1 hero': 'hero',
  'hero': 'hero',
  '2 ofertas': 'oferta',
  'ofertas': 'oferta',
  '3 antes y despues': 'antes-despues',
  'antes y despues': 'antes-despues',
  '4 beneficios': 'beneficios',
  'beneficios': 'beneficios',
  '5 tabla comparativa': 'tabla-comparativa',
  'tabla comparativa': 'tabla-comparativa',
  '6 prueba de autoridad': 'autoridad',
  'prueba de autoridad': 'autoridad',
  '7 testimonios': 'testimonios',
  'testimonios': 'testimonios',
  '8 como usar': 'modo-uso',
  'como usar': 'modo-uso',
  '9 logistica': 'logistica',
  'logistica': 'logistica',
  '10 preguntas frecuentes': 'faq',
  'preguntas frecuentes': 'faq',
  '11 casos de uso': 'casos-uso',
  'casos de uso': 'casos-uso',
  '12 caracteristicas': 'caracteristicas',
  'caracteristicas': 'caracteristicas',
  '13 composicion': 'ingredientes',
  'composicion': 'ingredientes',
  '14 comunidad': 'comunidad',
  'comunidad': 'comunidad',
}

interface PendingFile {
  file: File
  category: string
  folderName: string
}

interface Template {
  id: string
  name: string
  image_url: string
  category: string
  dimensions: string
  is_active: boolean
}

export default function AdminTemplatesPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, errors: 0 })
  const [uploadLog, setUploadLog] = useState<string[]>([])
  const [existingTemplates, setExistingTemplates] = useState<Template[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Auth check + load templates
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email === ADMIN_EMAIL) {
        setIsAdmin(true)
      } else {
        setIsAdmin(false)
        router.push('/dashboard')
      }
    })
    fetchTemplates()
  }, [router])

  const fetchTemplates = () => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(d => setExistingTemplates(d.templates || []))
      .catch(() => {})
  }

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    )
  }

  if (!isAdmin) return null

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const imageFiles: PendingFile[] = []
    const validExtensions = ['webp', 'png', 'jpg', 'jpeg', 'gif']

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      if (!validExtensions.includes(ext)) continue

      const pathParts = file.webkitRelativePath.split('/')
      let folderName = 'sin-categoria'
      if (pathParts.length >= 3) {
        folderName = pathParts[pathParts.length - 2].toLowerCase().trim()
      } else if (pathParts.length === 2) {
        folderName = pathParts[0].toLowerCase().trim()
      }

      const category = FOLDER_TO_CATEGORY[folderName] ||
        Object.entries(FOLDER_TO_CATEGORY).find(([key]) =>
          folderName.includes(key) || key.includes(folderName)
        )?.[1] ||
        'sin-categoria'

      imageFiles.push({
        file,
        category,
        folderName: pathParts.length >= 3 ? pathParts[pathParts.length - 2] : pathParts[0],
      })
    }

    setPendingFiles(imageFiles)
    toast.success(`${imageFiles.length} imagenes encontradas`)
  }

  const handleUploadAll = async () => {
    if (pendingFiles.length === 0) return

    setIsUploading(true)
    setProgress({ current: 0, total: pendingFiles.length, errors: 0 })
    setUploadLog([])

    const BATCH_SIZE = 5
    let uploaded = 0
    let errors = 0

    for (let i = 0; i < pendingFiles.length; i += BATCH_SIZE) {
      const batch = pendingFiles.slice(i, i + BATCH_SIZE)

      const promises = batch.map(async (pending) => {
        try {
          const formData = new FormData()
          formData.append('file', pending.file)
          formData.append('category', pending.category)
          formData.append('name', pending.file.name.replace(/\.[^/.]+$/, ''))

          const response = await fetch('/api/admin/templates/upload', {
            method: 'POST',
            body: formData,
          })

          const data = await response.json()

          if (!response.ok || !data.success) {
            throw new Error(data.error || 'Upload failed')
          }

          uploaded++
          setUploadLog(prev => [...prev, `OK ${pending.category}/${pending.file.name}`])
        } catch (error: any) {
          errors++
          setUploadLog(prev => [...prev, `FAIL ${pending.category}/${pending.file.name}: ${error.message}`])
        }

        setProgress(prev => ({
          ...prev,
          current: prev.current + 1,
          errors,
        }))
      })

      await Promise.allSettled(promises)
    }

    setIsUploading(false)
    setPendingFiles([])

    if (errors === 0) {
      toast.success(`${uploaded} plantillas subidas exitosamente!`)
    } else {
      toast.success(`${uploaded} subidas, ${errors} fallaron`)
    }

    fetchTemplates()
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return

    const confirmed = window.confirm(`Eliminar ${selectedIds.size} plantillas? Esta accion no se puede deshacer.`)
    if (!confirmed) return

    setIsDeleting(true)

    try {
      const response = await fetch('/api/admin/templates/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`${data.deleted} plantillas eliminadas`)
        setSelectedIds(new Set())
        fetchTemplates()
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch (error: any) {
      toast.error(error.message)
    }

    setIsDeleting(false)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllInCategory = (category: string) => {
    const catTemplates = existingTemplates.filter(t => t.category === category)
    const allSelected = catTemplates.every(t => selectedIds.has(t.id))

    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) {
        catTemplates.forEach(t => next.delete(t.id))
      } else {
        catTemplates.forEach(t => next.add(t.id))
      }
      return next
    })
  }

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Group pending files by category
  const groupedFiles = pendingFiles.reduce((acc, file) => {
    if (!acc[file.category]) acc[file.category] = []
    acc[file.category].push(file)
    return acc
  }, {} as Record<string, PendingFile[]>)

  // Group existing templates by category
  const groupedTemplates = existingTemplates.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {} as Record<string, Template[]>)

  // Get all categories for filter
  const allCategories = Object.keys(groupedTemplates).sort()

  // Filter templates
  const filteredGrouped = filterCategory === 'all'
    ? groupedTemplates
    : { [filterCategory]: groupedTemplates[filterCategory] || [] }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Admin: Plantillas</h1>
        <p className="text-text-secondary">
          Sube plantillas masivamente o gestiona las existentes.
          <span className="ml-2 text-accent font-medium">{existingTemplates.length} plantillas existentes</span>
        </p>
      </div>

      {/* Upload Area */}
      <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center mb-8 hover:border-accent/50 transition-colors">
        <FolderOpen className="w-12 h-12 text-accent/30 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-text-primary mb-1">Subir Plantillas</h2>
        <p className="text-sm text-text-secondary mb-4">
          Selecciona la carpeta principal con subcarpetas por categoria
        </p>
        <Button
          onClick={() => folderInputRef.current?.click()}
          className="gap-2"
          disabled={isUploading}
        >
          <Upload className="w-4 h-4" />
          Seleccionar Carpeta
        </Button>
        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore
          webkitdirectory="true"
          directory="true"
          multiple
          className="hidden"
          onChange={handleFolderSelect}
        />
      </div>

      {/* Pending upload preview */}
      {pendingFiles.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">
              {pendingFiles.length} archivos listos
            </h2>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPendingFiles([])} disabled={isUploading}>
                Limpiar
              </Button>
              <Button onClick={handleUploadAll} disabled={isUploading} className="gap-2">
                {isUploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {progress.current}/{progress.total}</>
                ) : (
                  <><Upload className="w-4 h-4" /> Subir Todo ({pendingFiles.length})</>
                )}
              </Button>
            </div>
          </div>

          {isUploading && (
            <div className="mb-4">
              <div className="w-full h-3 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
              </div>
              <div className="flex justify-between text-xs text-text-secondary mt-1">
                <span>{progress.current} de {progress.total}</span>
                {progress.errors > 0 && <span className="text-red-500">{progress.errors} errores</span>}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {Object.entries(groupedFiles).sort().map(([category, files]) => (
              <div key={category} className="border border-border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ImageIcon className="w-4 h-4 text-accent" />
                  <span className="font-medium text-text-primary capitalize">{category}</span>
                  <span className="text-xs text-text-secondary bg-border px-2 py-0.5 rounded-full">{files.length}</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                  {files.slice(0, 8).map((f, idx) => (
                    <div key={idx} className="flex-shrink-0 w-12 h-18 rounded-lg overflow-hidden border border-border bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={URL.createObjectURL(f.file)} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {files.length > 8 && (
                    <div className="flex-shrink-0 w-12 h-18 rounded-lg border border-border bg-surface flex items-center justify-center">
                      <span className="text-[10px] text-text-secondary">+{files.length - 8}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Log */}
      {uploadLog.length > 0 && (
        <div className="border border-border rounded-xl p-4 mb-8">
          <h3 className="text-sm font-semibold text-text-primary mb-2">Log de subida</h3>
          <div className="max-h-40 overflow-y-auto space-y-0.5 text-xs font-mono">
            {uploadLog.map((log, i) => (
              <div key={i} className={log.startsWith('OK') ? 'text-green-500' : 'text-red-500'}>{log}</div>
            ))}
          </div>
        </div>
      )}

      {/* ============ MANAGE EXISTING TEMPLATES ============ */}
      {existingTemplates.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">
              Plantillas Existentes
            </h2>
            <div className="flex items-center gap-3">
              {/* Category filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="text-sm px-3 py-1.5 rounded-lg border border-border bg-background text-text-primary"
              >
                <option value="all">Todas ({existingTemplates.length})</option>
                {allCategories.map(cat => (
                  <option key={cat} value={cat}>{cat} ({groupedTemplates[cat].length})</option>
                ))}
              </select>

              {/* Delete button */}
              {selectedIds.size > 0 && (
                <Button
                  variant="danger"
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="gap-2"
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Eliminar {selectedIds.size}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(filteredGrouped).sort().map(([category, templates]) => {
              if (!templates || templates.length === 0) return null
              const allCatSelected = templates.every(t => selectedIds.has(t.id))

              return (
                <div key={category} className="border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => selectAllInCategory(category)}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                          allCatSelected ? 'bg-red-500 border-red-500' : 'border-border hover:border-red-300'
                        }`}
                      >
                        {allCatSelected && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <ImageIcon className="w-4 h-4 text-accent" />
                      <span className="font-medium text-text-primary capitalize">{category}</span>
                      <span className="text-xs text-text-secondary bg-border px-2 py-0.5 rounded-full">
                        {templates.length}
                      </span>
                    </div>
                    <span className="text-xs text-text-secondary">
                      {templates.filter(t => selectedIds.has(t.id)).length} seleccionadas
                    </span>
                  </div>

                  <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
                    {templates.map((t) => {
                      const isSelected = selectedIds.has(t.id)
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggleSelect(t.id)}
                          className={`relative aspect-[9/16] rounded-lg overflow-hidden border-2 transition-all ${
                            isSelected
                              ? 'border-red-500 ring-2 ring-red-500/30 opacity-60'
                              : 'border-border hover:border-accent/50'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" loading="lazy" />
                          {isSelected && (
                            <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                              <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
