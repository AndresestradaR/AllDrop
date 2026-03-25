'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils/cn'

interface DropsBalanceProps {
  drops: number
  className?: string
}

export default function DropsBalance({ drops, className }: DropsBalanceProps) {
  const router = useRouter()
  const { t } = useI18n()
  const [displayDrops, setDisplayDrops] = useState(drops)
  const [isAnimating, setIsAnimating] = useState(false)
  const prevDrops = useRef(drops)

  useEffect(() => {
    if (drops !== prevDrops.current) {
      const isAdding = drops > prevDrops.current
      if (isAdding) {
        setIsAnimating(true)
        setTimeout(() => setIsAnimating(false), 2000)
      }

      const diff = drops - prevDrops.current
      const steps = 40
      const stepSize = diff / steps
      let current = prevDrops.current
      let step = 0

      const interval = setInterval(() => {
        step++
        current += stepSize
        if (step >= steps) {
          current = drops
          clearInterval(interval)
        }
        setDisplayDrops(Math.round(current))
      }, 25)

      prevDrops.current = drops
      return () => clearInterval(interval)
    }
  }, [drops])

  return (
    <div className={cn('space-y-2', className)}>
      {/* Star + Balance row */}
      <div className="flex items-center gap-3 px-1">
        {/* Star icon — BIG */}
        <div className={cn(
          'relative w-14 h-14 flex-shrink-0',
          isAnimating && 'animate-drops-pulse'
        )}>
          <img
            src="/images/drops.png"
            alt="Drops"
            className={cn(
              'w-full h-full object-contain drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]',
              isAnimating && 'drop-shadow-[0_0_16px_rgba(96,165,250,0.9)]'
            )}
          />
          {isAnimating && (
            <>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-400 rounded-full animate-drops-particle-1" />
              <span className="absolute -top-2 left-2 w-2 h-2 bg-cyan-400 rounded-full animate-drops-particle-2" />
              <span className="absolute top-1 -left-2 w-2 h-2 bg-blue-300 rounded-full animate-drops-particle-3" />
              <span className="absolute -bottom-1 right-1 w-2.5 h-2.5 bg-cyan-300 rounded-full animate-drops-particle-4" />
              <span className="absolute top-[-6px] left-4 w-1.5 h-1.5 bg-white rounded-full animate-drops-particle-1" />
            </>
          )}
        </div>

        {/* Number + label */}
        <div className="flex flex-col">
          <span className={cn(
            'text-2xl font-bold tabular-nums transition-colors leading-tight',
            isAnimating ? 'text-blue-400' : 'text-text-primary'
          )}>
            {displayDrops.toLocaleString()}
          </span>
          <span className="text-xs text-text-secondary/70">Drops</span>
        </div>
      </div>

      {/* Get Drops button */}
      <button
        onClick={() => router.push('/dashboard/pricing')}
        className="w-full py-2 rounded-xl text-sm font-semibold transition-all bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-400 hover:to-cyan-400 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
      >
        {t.pricing?.getDrops || 'Get your Drops'}
      </button>
    </div>
  )
}
