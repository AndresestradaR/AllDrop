import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { ImagePlus, Clock, Images, Store, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('credits_used, credits_limit, plan, full_name')
    .eq('id', user?.id)
    .single()

  // Get recent generations
  const { data: generations } = await supabase
    .from('generations')
    .select('*')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false })
    .limit(4)

  // Derive display name: full_name first word, or email username, or empty
  const displayName = profile?.full_name
    ? profile.full_name.split(' ')[0]
    : user?.email
      ? user.email.split('@')[0]
      : ''

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            ¡Hola{displayName ? `, ${displayName}` : ''}! 👋
          </h1>
          <p className="text-text-secondary mt-1">
            Bienvenido a tu panel de generación de imágenes
          </p>
        </div>
        <Link href="/dashboard/generate">
          <Button>
            <ImagePlus className="w-4 h-4 mr-2" />
            Nueva Generación
          </Button>
        </Link>
      </div>

      {/* Plan card */}
      <div className="grid sm:grid-cols-1 gap-4 max-w-sm">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-text-secondary">Plan Actual</p>
                <p className="text-2xl font-bold text-text-primary capitalize">{profile?.plan || 'Free'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DropPage Card */}
      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/10">
            <Store className="h-6 w-6 text-teal-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-text-primary">DropPage</h3>
            <p className="text-sm text-text-secondary">Crea tu tienda online en minutos</p>
          </div>
          <Link
            href="https://estrategasia.com/constructor/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="secondary">
              Ir al constructor
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Recent generations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Generaciones Recientes</CardTitle>
          <Link href="/dashboard/gallery" className="text-sm text-accent hover:text-accent-hover">
            Ver todas
          </Link>
        </CardHeader>
        <CardContent>
          {generations && generations.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {generations.map((gen) => (
                <div key={gen.id} className="group relative aspect-[9/16] bg-border rounded-lg overflow-hidden">
                  {gen.generated_image_url ? (
                    <img 
                      src={gen.generated_image_url} 
                      alt={gen.product_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-text-secondary text-xs">
                        {gen.status === 'processing' ? 'Procesando...' : 'Error'}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-sm font-medium truncate">{gen.product_name}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Images className="w-12 h-12 text-text-secondary mx-auto mb-4" />
              <p className="text-text-secondary">No tienes generaciones aún</p>
              <Link href="/dashboard/generate">
                <Button variant="secondary" className="mt-4">
                  Crear primera imagen
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}