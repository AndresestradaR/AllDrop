'use client'

import { useState } from 'react'
import { Download, BookOpen, CheckCircle, ExternalLink, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface EbookPreviewProps {
  ebookId: string | null
  title: string
  chaptersCount: number
  pagesEstimate: number
  coverImageUrl?: string
  onNewEbook: () => void
}

export default function EbookPreview({
  ebookId,
  title,
  chaptersCount,
  pagesEstimate,
  coverImageUrl,
  onNewEbook,
}: EbookPreviewProps) {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    if (!ebookId) {
      toast.error('Error: ID del ebook no disponible')
      return
    }

    setDownloading(true)
    try {
      const res = await fetch(`/api/studio/ebook/download?id=${ebookId}`)
      if (!res.ok) throw new Error('Error al obtener enlace de descarga')

      const data = await res.json()
      if (!data.url) throw new Error('URL no disponible')

      // Download via blob for cross-origin compatibility
      const pdfRes = await fetch(data.url)
      const blob = await pdfRes.blob()
      const blobUrl = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${title.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)

      toast.success('Ebook descargado')
    } catch (err: any) {
      toast.error(err.message || 'Error al descargar')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Success header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-1">Ebook listo</h3>
        <p className="text-sm text-zinc-400">Tu ebook profesional ha sido generado y guardado</p>
      </div>

      {/* Ebook card */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-5 flex gap-5">
        {coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt={title}
            className="w-32 h-44 object-cover rounded-lg shadow-lg flex-shrink-0"
          />
        ) : (
          <div className="w-32 h-44 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-lg shadow-lg flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-10 h-10 text-white/80" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="text-lg font-bold text-white mb-2 leading-snug">{title}</h4>
          <div className="space-y-1.5">
            <p className="text-sm text-zinc-400">
              <span className="text-zinc-300 font-medium">{chaptersCount}</span> capitulos
            </p>
            <p className="text-sm text-zinc-400">
              ~<span className="text-zinc-300 font-medium">{pagesEstimate}</span> paginas
            </p>
            <p className="text-sm text-zinc-400">
              Formato: <span className="text-zinc-300 font-medium">PDF A4</span>
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-colors"
        >
          {downloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Descargar PDF
        </button>
        <button
          onClick={onNewEbook}
          className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-white text-sm transition-colors"
        >
          Crear otro
        </button>
      </div>

      <p className="text-xs text-zinc-500 text-center">
        Guardado en tu galeria. Puedes descargarlo en cualquier momento.
      </p>
    </div>
  )
}
