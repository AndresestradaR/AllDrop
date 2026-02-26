'use client'

const LUCIO_URL = process.env.NEXT_PUBLIC_LUCIO_URL || ''
const LUCIO_TOKEN = process.env.NEXT_PUBLIC_LUCIO_TOKEN || ''

export default function LucioPage() {
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

  const iframeSrc = LUCIO_TOKEN
    ? `${LUCIO_URL}/chat?session=main&token=${LUCIO_TOKEN}`
    : `${LUCIO_URL}/chat?session=main`

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
