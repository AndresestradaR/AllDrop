'use client'

const LUCIO_URL = process.env.NEXT_PUBLIC_LUCIO_URL || ''

export default function LucioPage() {
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
        src={`${LUCIO_URL}/chat?session=main`}
        className="w-full border-0"
        style={{ height: 'calc(100vh - 180px)' }}
        allow="microphone; camera"
      />
    </div>
  )
}
