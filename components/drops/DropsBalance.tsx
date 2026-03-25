'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

interface DropsBalanceProps {
  drops: number
  className?: string
  compact?: boolean
}

export default function DropsBalance({ drops, className, compact }: DropsBalanceProps) {
  const router = useRouter()
  const [displayDrops, setDisplayDrops] = useState(drops)
  const [isAnimating, setIsAnimating] = useState(false)
  const prevDrops = useRef(drops)

  useEffect(() => {
    if (drops !== prevDrops.current) {
      const isAdding = drops > prevDrops.current
      if (isAdding) {
        setIsAnimating(true)
        setTimeout(() => setIsAnimating(false), 1500)
      }

      // Counting animation
      const diff = drops - prevDrops.current
      const steps = 30
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
      }, 30)

      prevDrops.current = drops
      return () => clearInterval(interval)
    }
  }, [drops])

  return (
    <button
      onClick={() => router.push('/dashboard/pricing')}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-border/50 group relative',
        isAnimating && 'ring-2 ring-blue-400/50',
        className
      )}
    >
      {/* Star icon with animation */}
      <div className={cn(
        'relative w-6 h-6 flex-shrink-0 transition-transform',
        isAnimating && 'animate-drops-pulse'
      )}>
        <img
          src="/images/drops.png"
          alt="Drops"
          className="w-full h-full object-contain"
        />
        {/* Particle effects when animating */}
        {isAnimating && (
          <>
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full animate-drops-particle-1" />
            <span className="absolute -top-2 left-1 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-drops-particle-2" />
            <span className="absolute top-0 -left-1 w-1.5 h-1.5 bg-blue-300 rounded-full animate-drops-particle-3" />
            <span className="absolute -bottom-1 right-0 w-2 h-2 bg-cyan-300 rounded-full animate-drops-particle-4" />
          </>
        )}
      </div>

      {/* Balance */}
      <div className="flex flex-col items-start">
        <span className={cn(
          'text-sm font-bold text-text-primary tabular-nums transition-colors',
          isAnimating && 'text-blue-400'
        )}>
          {displayDrops.toLocaleString()}
        </span>
        {!compact && (
          <span className="text-[10px] text-text-secondary leading-none">Drops</span>
        )}
      </div>

      {/* "Get Drops" if 0 */}
      {drops === 0 && !compact && (
        <span className="ml-auto text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
          Get
        </span>
      )}
    </button>
  )
}
