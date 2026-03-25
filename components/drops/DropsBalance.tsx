'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

interface DropsBalanceProps {
  drops: number
  className?: string
}

export default function DropsBalance({ drops, className }: DropsBalanceProps) {
  const router = useRouter()
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

      // Counting animation
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
    <button
      onClick={() => router.push('/dashboard/pricing')}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all',
        'bg-gradient-to-r from-blue-500/10 via-cyan-500/5 to-transparent',
        'border border-blue-500/20 hover:border-blue-400/40',
        'hover:from-blue-500/15 hover:via-cyan-500/10',
        isAnimating && 'border-blue-400/60 from-blue-500/20 via-cyan-500/15',
        className
      )}
    >
      {/* Star icon — BIG */}
      <div className={cn(
        'relative w-14 h-14 flex-shrink-0',
        isAnimating && 'animate-drops-pulse'
      )}>
        <img
          src="/images/drops.png"
          alt="Drops"
          className={cn(
            'w-full h-full object-contain drop-shadow-[0_0_6px_rgba(96,165,250,0.4)]',
            isAnimating && 'drop-shadow-[0_0_12px_rgba(96,165,250,0.8)]'
          )}
        />
        {/* Particles on recharge */}
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

      {/* Balance */}
      <div className="flex flex-col items-start min-w-0">
        <span className={cn(
          'text-2xl font-bold tabular-nums transition-colors leading-tight',
          isAnimating ? 'text-blue-400' : 'text-text-primary'
        )}>
          {displayDrops.toLocaleString()}
        </span>
        <span className="text-xs text-text-secondary/70 leading-none">
          Drops
        </span>
      </div>

      {/* Arrow hint */}
      <svg className="w-4 h-4 ml-auto text-text-secondary/40 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}
