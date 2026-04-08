'use client'

import Link from 'next/link'
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { Images, Store, ArrowRight, Droplets } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

interface Generation {
  id: string
  product_name: string
  generated_image_url: string | null
  status: string
}

interface DashboardHomeProps {
  displayName: string
  plan: string
  drops: number
  generations: Generation[]
}

export default function DashboardHome({ displayName, plan, drops, generations }: DashboardHomeProps) {
  const { t } = useI18n()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {t.home.hello}{displayName ? `, ${displayName}` : ''}! 👋
          </h1>
          <p className="text-text-secondary mt-1">
            {t.home.welcomePanel}
          </p>
        </div>
      </div>

      {/* Drops balance card */}
      <div className="grid sm:grid-cols-1 gap-4 max-w-sm">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <Droplets className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-text-secondary capitalize">{plan} Plan</p>
                <p className="text-2xl font-bold text-text-primary">{drops.toLocaleString()} <span className="text-base font-normal text-text-secondary">Drops</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AllDrop Shop Card */}
      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10">
            <Store className="h-6 w-6 text-violet-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-text-primary">{t.home.shopTitle}</h3>
            <p className="text-sm text-text-secondary">{t.home.shopDesc}</p>
          </div>
          <Link
            href="/constructor/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="secondary">
              {t.home.goToShop}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Recent generations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t.home.recentGenerations}</CardTitle>
          <Link href="/dashboard/gallery" className="text-sm text-accent hover:text-accent-hover">
            {t.home.viewAll}
          </Link>
        </CardHeader>
        <CardContent>
          {generations && generations.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {generations.map((gen) => {
                const isVideo = gen.product_name?.startsWith('Video:')
                return (
                  <div key={gen.id} className="group relative aspect-[9/16] bg-border rounded-lg overflow-hidden">
                    {gen.generated_image_url ? (
                      isVideo ? (
                        <video
                          src={gen.generated_image_url}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={gen.generated_image_url}
                          alt={gen.product_name}
                          className="w-full h-full object-cover"
                        />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-text-secondary text-xs">
                          {gen.status === 'processing' ? t.home.processing : t.home.error}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-white text-sm font-medium truncate">{gen.product_name}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Images className="w-12 h-12 text-text-secondary mx-auto mb-4" />
              <p className="text-text-secondary">{t.home.noGenerations}</p>
              <Link href="/dashboard/generate">
                <Button variant="secondary" className="mt-4">
                  {t.home.createFirstImage}
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
