'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const LUCIO_URL = process.env.NEXT_PUBLIC_LUCIO_URL || ''

export default function LucioPage() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        // Each user gets an isolated session: agent:main:<userId>
        setSessionId(`agent:main:${data.user.id}`)
      }
      setLoading(false)
    })
  }, [])

  if (!LUCIO_URL) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-3">
          <span className="text-5xl">🦞</span>
          <h2 className="text-lg font-bold text-text-primary">Lucio no está disponible</h2>
          <p className="text-sm text-text-secondary">La conexión con el asistente no está configurada.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="-m-6 flex flex-col">
        <div className="px-6 py-4 border-b border-border bg-surface flex items-center gap-3">
          <span className="text-2xl">🦞</span>
          <div>
            <h1 className="text-lg font-bold text-text-primary">Lucio 🦞</h1>
            <p className="text-sm text-text-secondary">Tu asistente de dropshipping COD</p>
          </div>
        </div>
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 180px)' }}>
          <div className="flex items-center gap-3 text-text-secondary">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Conectando con Lucio...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-3">
          <span className="text-5xl">🦞</span>
          <h2 className="text-lg font-bold text-text-primary">Sesión no disponible</h2>
          <p className="text-sm text-text-secondary">No se pudo obtener tu sesión. Intenta recargar la página.</p>
        </div>
      </div>
    )
  }

  const iframeSrc = `${LUCIO_URL}/chat?session=${encodeURIComponent(sessionId)}`

  return (
    <div className="-m-6 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-surface flex items-center gap-3">
        <span className="text-2xl">🦞</span>
        <div>
          <h1 className="text-lg font-bold text-text-primary">Lucio 🦞</h1>
          <p className="text-sm text-text-secondary">Tu asistente de dropshipping COD</p>
        </div>
      </div>

      {/* Iframe webchat */}
      <iframe
        src={iframeSrc}
        className="w-full border-0"
        style={{ height: 'calc(100vh - 180px)' }}
        allow="microphone; camera"
      />
    </div>
  )
}
