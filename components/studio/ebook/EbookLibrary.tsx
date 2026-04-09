'use client'

import { useState, useEffect } from 'react'
import { BookOpen, Download, Trash2, Loader2, Calendar, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { useI18n } from '@/lib/i18n'

interface EbookItem {
  id: string
  product_name: string
  original_prompt: string
  enhanced_prompt: string
  generated_image_url: string
  created_at: string
}

interface EbookLibraryProps {
  onCreateNew: () => void
}

export default function EbookLibrary({ onCreateNew }: EbookLibraryProps) {
  const { t } = useI18n()
  const se = t.studio.ebook

  const [ebooks, setEbooks] = useState<EbookItem[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    loadEbooks()
  }, [])

  async function loadEbooks() {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('generations')
        .select('id, product_name, original_prompt, enhanced_prompt, generated_image_url, created_at')
        .eq('user_id', user.id)
        .like('product_name', 'Ebook:%')
        .order('created_at', { ascending: false })

      setEbooks(data || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function handleDownload(ebook: EbookItem) {
    setDownloading(ebook.id)
    try {
      const res = await fetch(`/api/studio/ebook/download?id=${ebook.id}`)
      if (!res.ok) throw new Error(se.downloadLinkError)
      const { url, title } = await res.json()

      const blobRes = await fetch(url)
      const blob = await blobRes.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${title || 'ebook'}.pdf`
      a.click()
      URL.revokeObjectURL(blobUrl)
    } catch (err: any) {
      toast.error(err.message || se.downloadError)
    } finally {
      setDownloading(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(se.deleteConfirm)) return
    try {
      const supabase = createClient()
      await supabase.from('generations').delete().eq('id', id)
      setEbooks(prev => prev.filter(e => e.id !== id))
      toast.success(se.deleted)
    } catch {
      toast.error(se.downloadError)
    }
  }

  function parseMetadata(enhanced_prompt: string): { template?: string; chapters?: number; pages?: number; coverImageUrl?: string } {
    try { return JSON.parse(enhanced_prompt) } catch { return {} }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">{se.myEbooks}</h3>
          <p className="text-sm text-zinc-400">
            {ebooks.length} ebook{ebooks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <BookOpen className="w-4 h-4" />
          {se.createNewEbook}
        </button>
      </div>

      {/* Empty state */}
      {ebooks.length === 0 && (
        <div className="text-center py-16 bg-zinc-800/50 rounded-xl border border-zinc-700">
          <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h4 className="text-white font-medium mb-2">{se.noEbooksYet}</h4>
          <p className="text-sm text-zinc-400 mb-6">{se.noEbooksDesc}</p>
          <button
            onClick={onCreateNew}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-medium"
          >
            {se.createFirstEbook}
          </button>
        </div>
      )}

      {/* Ebook grid */}
      {ebooks.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ebooks.map((ebook) => {
            const title = ebook.product_name.replace('Ebook: ', '')
            const subtitle = ebook.original_prompt || ''
            const meta = parseMetadata(ebook.enhanced_prompt)
            const date = new Date(ebook.created_at).toLocaleDateString(undefined, {
              day: 'numeric', month: 'short', year: 'numeric'
            })

            return (
              <div
                key={ebook.id}
                className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 hover:border-emerald-500/30 transition-colors group"
              >
                {/* Cover thumbnail or placeholder */}
                {meta.coverImageUrl ? (
                  <img
                    src={meta.coverImageUrl}
                    alt={title}
                    className="w-full h-32 object-cover rounded-lg mb-3"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-32 bg-gradient-to-br from-emerald-900/40 to-zinc-800 rounded-lg flex items-center justify-center mb-3">
                    <BookOpen className="w-10 h-10 text-emerald-400/50" />
                  </div>
                )}

                {/* Info */}
                <h4 className="text-white font-medium text-sm truncate mb-1" title={title}>{title}</h4>
                <p className="text-zinc-400 text-xs truncate mb-2" title={subtitle}>{subtitle}</p>

                {/* Metadata */}
                <div className="flex items-center gap-3 text-xs text-zinc-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {date}
                  </span>
                  {meta.chapters && (
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {meta.chapters} {se.chapterCount} · ~{meta.pages}p
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload(ebook)}
                    disabled={downloading === ebook.id}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors text-xs font-medium disabled:opacity-50"
                  >
                    {downloading === ebook.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    {se.download}
                  </button>
                  <button
                    onClick={() => handleDelete(ebook.id)}
                    className="p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
