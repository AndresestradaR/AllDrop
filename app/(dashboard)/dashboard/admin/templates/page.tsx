'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, Loader2, X, FolderOpen, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui'
import toast from 'react-hot-toast'

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

export default function AdminTemplatesPage() {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, errors: 0 })
  const [uploadLog, setUploadLog] = useState<string[]>([])
  const [existingCount, setExistingCount] = useState<number | null>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(d => setExistingCount(d.templates?.length || 0))
      .catch(() => {})
  }, [])

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const imageFiles: PendingFile[] = []
    const validExtensions = ['webp', 'png', 'jpg', 'jpeg', 'gif']

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      if (!validExtensions.includes(ext)) continue

      // Get the subfolder name from webkitRelativePath
      // Format: "PLANTILLAS.../1 hero/filename.webp"
      const pathParts = file.webkitRelativePath.split('/')
      let folderName = 'sin-categoria'
      if (pathParts.length >= 3) {
        folderName = pathParts[pathParts.length - 2].toLowerCase().trim()
      } else if (pathParts.length === 2) {
        folderName = pathParts[0].toLowerCase().trim()
      }

      // Map folder to category
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

    // Refresh count
    fetch('/api/templates').then(r => r.json()).then(d => setExistingCount(d.templates?.length || 0)).catch(() => {})
  }

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Group by category for display
  const groupedFiles = pendingFiles.reduce((acc, file) => {
    if (!acc[file.category]) acc[file.category] = []
    acc[file.category].push(file)
    return acc
  }, {} as Record<string, PendingFile[]>)

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Admin: Plantillas</h1>
        <p className="text-text-secondary">
          Sube plantillas masivamente desde carpetas organizadas por categoria.
          {existingCount !== null && (
            <span className="ml-2 text-accent font-medium">{existingCount} plantillas existentes</span>
          )}
        </p>
      </div>

      {/* Upload Area */}
      <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center mb-8 hover:border-accent/50 transition-colors">
        <FolderOpen className="w-16 h-16 text-accent/30 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-text-primary mb-2">Seleccionar Carpeta de Plantillas</h2>
        <p className="text-sm text-text-secondary mb-4">
          Selecciona la carpeta principal que contiene las subcarpetas por categoria (1 hero, 2 ofertas, etc.)
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
          // @ts-ignore - webkitdirectory is not in React types
          webkitdirectory="true"
          directory="true"
          multiple
          className="hidden"
          onChange={handleFolderSelect}
        />
      </div>

      {/* Preview grouped by category */}
      {pendingFiles.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">
              {pendingFiles.length} archivos listos para subir
            </h2>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setPendingFiles([])}
                disabled={isUploading}
              >
                Limpiar
              </Button>
              <Button
                onClick={handleUploadAll}
                disabled={isUploading}
                className="gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Subiendo {progress.current}/{progress.total}
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Subir Todo ({pendingFiles.length})
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          {isUploading && (
            <div className="mb-4">
              <div className="w-full h-3 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-text-secondary mt-1">
                <span>{progress.current} de {progress.total}</span>
                {progress.errors > 0 && <span className="text-red-500">{progress.errors} errores</span>}
              </div>
            </div>
          )}

          {/* Categories */}
          <div className="space-y-4">
            {Object.entries(groupedFiles).sort().map(([category, files]) => (
              <div key={category} className="border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-accent" />
                    <span className="font-medium text-text-primary capitalize">{category}</span>
                    <span className="text-xs text-text-secondary bg-border px-2 py-0.5 rounded-full">
                      {files.length} archivos
                    </span>
                  </div>
                  <span className="text-xs text-text-secondary">
                    Carpeta: {files[0]?.folderName}
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {files.slice(0, 10).map((f, idx) => (
                    <div key={idx} className="flex-shrink-0 w-16 h-24 rounded-lg overflow-hidden border border-border bg-surface relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={URL.createObjectURL(f.file)}
                        alt={f.file.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removeFile(pendingFiles.indexOf(f))}
                        className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                  {files.length > 10 && (
                    <div className="flex-shrink-0 w-16 h-24 rounded-lg border border-border bg-surface flex items-center justify-center">
                      <span className="text-xs text-text-secondary">+{files.length - 10}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {groupedFiles['sin-categoria'] && (
              <p className="text-sm text-amber-500">
                {groupedFiles['sin-categoria'].length} archivos sin categoria detectada. Verifica los nombres de carpeta.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Upload Log */}
      {uploadLog.length > 0 && (
        <div className="border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-2">Log de subida</h3>
          <div className="max-h-60 overflow-y-auto space-y-0.5 text-xs font-mono">
            {uploadLog.map((log, i) => (
              <div key={i} className={log.startsWith('OK') ? 'text-green-500' : 'text-red-500'}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
