'use client'

import { PlayCircle } from 'lucide-react'

export default function TutorialPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Tutorial</h1>
        <p className="text-text-secondary mt-1">
          Aprende a usar todas las herramientas de Estrategas IA
        </p>
      </div>

      {/* Main Video */}
      <div className="rounded-xl overflow-hidden border border-border bg-surface">
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src="https://www.youtube.com/embed/mXNlHaL7_lc"
            title="Tutorial Estrategas IA"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>

      <div className="mt-6 p-4 rounded-xl border border-border bg-surface">
        <div className="flex items-start gap-3">
          <PlayCircle className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-text-primary mb-1">Como usar la herramienta</h3>
            <p className="text-sm text-text-secondary">
              En este video te explicamos paso a paso como crear tus landings, banners y contenido de ventas con inteligencia artificial. Mira el tutorial completo para sacarle el maximo provecho a todas las funcionalidades.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
