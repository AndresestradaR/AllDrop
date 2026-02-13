'use client'

import { cn } from '@/lib/utils/cn'
import { Check, Lock } from 'lucide-react'

interface Step {
  number: number
  label: string
  comingSoon?: boolean
}

const STEPS: Step[] = [
  { number: 1, label: 'Diseña' },
  { number: 2, label: 'Realismo' },
  { number: 3, label: 'Angulos' },
  { number: 4, label: 'Analisis' },
  { number: 5, label: 'Galeria', comingSoon: true },
  { number: 6, label: 'Videos', comingSoon: true },
]

interface StepperHeaderProps {
  currentStep: number
  completedSteps: number
  onStepClick?: (step: number) => void
}

export function StepperHeader({ currentStep, completedSteps, onStepClick }: StepperHeaderProps) {
  return (
    <div className="flex items-center gap-1 px-4 py-3 overflow-x-auto">
      {STEPS.map((step, idx) => {
        const isCompleted = step.number <= completedSteps
        const isCurrent = step.number === currentStep
        const isAccessible = step.number <= completedSteps + 1 && !step.comingSoon
        const isComingSoon = step.comingSoon

        return (
          <div key={step.number} className="flex items-center">
            {idx > 0 && (
              <div
                className={cn(
                  'w-6 h-0.5 mx-0.5 flex-shrink-0',
                  isCompleted ? 'bg-accent' : 'bg-border'
                )}
              />
            )}
            <button
              onClick={() => isAccessible && onStepClick?.(step.number)}
              disabled={!isAccessible}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
                isCurrent && 'bg-accent text-background shadow-lg shadow-accent/25',
                isCompleted && !isCurrent && 'bg-accent/10 text-accent hover:bg-accent/20 cursor-pointer',
                !isCompleted && !isCurrent && !isComingSoon && isAccessible && 'bg-surface-elevated text-text-secondary hover:bg-border/50 cursor-pointer',
                !isAccessible && !isComingSoon && 'bg-surface-elevated text-text-muted cursor-not-allowed',
                isComingSoon && 'bg-surface-elevated text-text-muted cursor-not-allowed opacity-50',
              )}
            >
              <span className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                isCurrent && 'bg-background/20 text-background',
                isCompleted && !isCurrent && 'bg-accent text-background',
                !isCompleted && !isCurrent && 'bg-border text-text-muted',
              )}>
                {isCompleted && !isCurrent ? (
                  <Check className="w-3 h-3" />
                ) : isComingSoon ? (
                  <Lock className="w-3 h-3" />
                ) : (
                  step.number
                )}
              </span>
              <span>{step.label}</span>
              {isComingSoon && (
                <span className="text-[9px] bg-border/80 px-1 py-0.5 rounded">Pronto</span>
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
