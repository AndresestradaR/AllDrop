'use client'

import { BookOpen, Loader2, CheckCircle, AlertCircle, ImageIcon, FileText, Upload } from 'lucide-react'
import type { GenerationStep } from '@/lib/ebook/types'

interface GenerationProgressProps {
  steps: GenerationStep[]
  currentStep: GenerationStep | null
}

const stepIcons: Record<string, React.ElementType> = {
  cover: ImageIcon,
  'chapter-text': FileText,
  'chapter-image': ImageIcon,
  compiling: BookOpen,
  uploading: Upload,
  done: CheckCircle,
  error: AlertCircle,
}

export default function GenerationProgress({ steps, currentStep }: GenerationProgressProps) {
  const progress = currentStep?.progress || 0
  const isDone = currentStep?.type === 'done'
  const isError = currentStep?.type === 'error'

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-1">
          {isDone
            ? 'Ebook generado'
            : isError
              ? 'Error en la generacion'
              : 'Generando tu ebook...'}
        </h3>
        <p className="text-sm text-zinc-400">
          {isDone
            ? 'Tu ebook profesional esta listo para descargar'
            : isError
              ? currentStep?.message
              : 'Esto puede tardar 2-4 minutos'}
        </p>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isError ? 'bg-red-500' : isDone ? 'bg-emerald-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500 mt-1 text-right">{progress}%</p>
      </div>

      {/* Steps log */}
      <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-4 max-h-[300px] overflow-y-auto">
        <div className="space-y-2">
          {steps.map((step, i) => {
            const Icon = stepIcons[step.type] || FileText
            const isCurrent = i === steps.length - 1 && !isDone && !isError
            return (
              <div
                key={i}
                className={`flex items-center gap-3 py-1.5 ${
                  isCurrent ? 'text-white' : 'text-zinc-500'
                }`}
              >
                {isCurrent ? (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin flex-shrink-0" />
                ) : step.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-emerald-500/60 flex-shrink-0" />
                )}
                <span className="text-sm">{step.message}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Animated icon */}
      {!isDone && !isError && (
        <div className="flex justify-center">
          <div className="relative">
            <BookOpen className="w-16 h-16 text-emerald-500/30" />
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin absolute top-4 left-4" />
          </div>
        </div>
      )}
    </div>
  )
}
