'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  GraduationCap, Loader2, Upload, User, DollarSign, Users, TrendingUp,
  Check, X, Camera
} from 'lucide-react'
import toast from 'react-hot-toast'

const ADMIN_EMAIL = 'trucosecomydrop@gmail.com'

interface Mentor {
  id: string
  email: string
  name: string
  photo_url: string | null
  bio: string | null
  topics: string[]
  price_usd: number
  mentor_share_usd: number
  platform_share_usd: number
  is_active: boolean
}

interface AdminBooking {
  id: string
  user_id: string
  mentor_id: string
  topic: string
  slot_date: string
  slot_hour: number
  price_usd: number
  status: string
  notes: string | null
  created_at: string
  coaching_mentors: { name: string; email: string } | null
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export default function AdminCoachingPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mentors, setMentors] = useState<Mentor[]>([])
  const [bookings, setBookings] = useState<AdminBooking[]>([])
  const [uploading, setUploading] = useState<string | null>(null)
  const [userEmails, setUserEmails] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoMentorId, setPhotoMentorId] = useState<string | null>(null)

  // Auth check
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email !== ADMIN_EMAIL) {
        router.push('/dashboard')
        return
      }
      setAuthorized(true)
      setLoading(false)
    })
  }, [router])

  // Fetch mentors (using service client via dedicated fetch — we need ALL mentors including inactive)
  const fetchMentors = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('coaching_mentors')
      .select('*')
      .order('created_at', { ascending: true })
    if (!error && data) setMentors(data)
  }, [])

  // Fetch all bookings (admin sees all via API)
  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch('/api/coaching/bookings')
      if (res.ok) {
        const data = await res.json()
        setBookings(data)

        // Collect unique user_ids to resolve emails
        const userIds = Array.from(new Set(data.map((b: AdminBooking) => b.user_id))) as string[]
        const supabase = createClient()
        const emailMap: Record<string, string> = {}

        // We can't access auth.admin from client, so we'll show user_id shortened
        // The bookings API already enriches with mentor name
        for (const uid of userIds) {
          emailMap[uid] = uid.substring(0, 8) + '...'
        }
        setUserEmails(emailMap)
      }
    } catch (err) {
      console.error('Error fetching admin bookings:', err)
    }
  }, [])

  useEffect(() => {
    if (authorized) {
      fetchMentors()
      fetchBookings()
    }
  }, [authorized, fetchMentors, fetchBookings])

  // Toggle mentor active/inactive
  const toggleMentorActive = async (mentorId: string, currentActive: boolean) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('coaching_mentors')
      .update({ is_active: !currentActive })
      .eq('id', mentorId)

    if (error) {
      toast.error('Error al actualizar mentor')
      return
    }
    toast.success(currentActive ? 'Mentor desactivado' : 'Mentor activado')
    fetchMentors()
  }

  // Upload photo
  const handlePhotoClick = (mentorId: string) => {
    setPhotoMentorId(mentorId)
    fileInputRef.current?.click()
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !photoMentorId) return

    setUploading(photoMentorId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mentorId', photoMentorId)

      const res = await fetch('/api/coaching/mentor/photo', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        toast.success('Foto actualizada')
        fetchMentors()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al subir foto')
      }
    } catch (err) {
      toast.error('Error de conexión')
    } finally {
      setUploading(null)
      setPhotoMentorId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Stats
  const totalBookings = bookings.length
  const activeBookings = bookings.filter(b => b.status !== 'cancelada').length
  const totalRevenue = bookings
    .filter(b => b.status !== 'cancelada')
    .reduce((sum, b) => sum + Number(b.price_usd), 0)
  const platformRevenue = bookings
    .filter(b => b.status !== 'cancelada')
    .length * 10 // $10 platform share per session

  const statusLabel: Record<string, { text: string; color: string }> = {
    pendiente: { text: 'Pendiente', color: 'text-yellow-400 bg-yellow-400/10' },
    confirmada: { text: 'Confirmada', color: 'text-emerald-400 bg-emerald-400/10' },
    completada: { text: 'Completada', color: 'text-blue-400 bg-blue-400/10' },
    cancelada: { text: 'Cancelada', color: 'text-red-400 bg-red-400/10' },
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    )
  }

  if (!authorized) return null

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoUpload}
        className="hidden"
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
          <GraduationCap className="w-7 h-7 text-accent" />
          Admin Coaching
        </h1>
        <p className="text-text-secondary mt-1">
          Gestiona mentores y visualiza todas las reservas con desglose de ingresos.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-text-secondary">Total Reservas</p>
              <p className="text-xl font-bold text-text-primary">{totalBookings}</p>
            </div>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-text-secondary">Activas</p>
              <p className="text-xl font-bold text-text-primary">{activeBookings}</p>
            </div>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-text-secondary">Ingresos Totales</p>
              <p className="text-xl font-bold text-text-primary">${totalRevenue}</p>
            </div>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-text-secondary">Plataforma</p>
              <p className="text-xl font-bold text-text-primary">${platformRevenue}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mentors Management */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Mentores</h2>

        <div className="space-y-4">
          {mentors.map(mentor => (
            <div
              key={mentor.id}
              className={`p-4 rounded-lg border transition-colors ${
                mentor.is_active ? 'border-border bg-background' : 'border-border/50 bg-background/50 opacity-60'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Photo with upload overlay */}
                <div className="relative group">
                  {mentor.photo_url ? (
                    <img
                      src={mentor.photo_url}
                      alt={mentor.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-border"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center border-2 border-border">
                      <User className="w-8 h-8 text-accent" />
                    </div>
                  )}
                  <button
                    onClick={() => handlePhotoClick(mentor.id)}
                    disabled={uploading === mentor.id}
                    className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    {uploading === mentor.id ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-text-primary">{mentor.name}</h3>
                    {!mentor.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-400/10 text-red-400 font-medium">Inactivo</span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary">{mentor.email}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {mentor.topics.map(t => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-text-secondary">
                    <span>Precio: <span className="text-text-primary font-semibold">${mentor.price_usd}</span></span>
                    <span>Mentor: <span className="text-emerald-400 font-semibold">${mentor.mentor_share_usd}</span></span>
                    <span>Plataforma: <span className="text-purple-400 font-semibold">${mentor.platform_share_usd}</span></span>
                  </div>
                </div>

                {/* Toggle active */}
                <button
                  onClick={() => toggleMentorActive(mentor.id, mentor.is_active)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    mentor.is_active
                      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  }`}
                >
                  {mentor.is_active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All Bookings */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Todas las Reservas</h2>

        {bookings.length === 0 ? (
          <p className="text-text-secondary text-sm py-4 text-center">
            No hay reservas aún.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-text-secondary font-medium">Fecha</th>
                  <th className="text-left py-2 px-2 text-text-secondary font-medium">Hora</th>
                  <th className="text-left py-2 px-2 text-text-secondary font-medium">Mentor</th>
                  <th className="text-left py-2 px-2 text-text-secondary font-medium">Cliente</th>
                  <th className="text-left py-2 px-2 text-text-secondary font-medium">Tema</th>
                  <th className="text-left py-2 px-2 text-text-secondary font-medium">Estado</th>
                  <th className="text-right py-2 px-2 text-text-secondary font-medium">Total</th>
                  <th className="text-right py-2 px-2 text-text-secondary font-medium">Mentor</th>
                  <th className="text-right py-2 px-2 text-text-secondary font-medium">Plataforma</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => {
                  const st = statusLabel[b.status] || statusLabel.pendiente
                  const isCancelled = b.status === 'cancelada'
                  // Find mentor to get share info
                  const mentor = mentors.find(m => m.id === b.mentor_id)
                  const mentorShareUsd = mentor?.mentor_share_usd || 30
                  const platformShareUsd = mentor?.platform_share_usd || 10

                  return (
                    <tr key={b.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 px-2 text-text-primary">{formatDate(b.slot_date)}</td>
                      <td className="py-2.5 px-2 text-text-primary font-mono">{b.slot_hour}:00</td>
                      <td className="py-2.5 px-2 text-text-primary">{b.coaching_mentors?.name || '—'}</td>
                      <td className="py-2.5 px-2 text-text-secondary">{userEmails[b.user_id] || b.user_id.substring(0, 8)}</td>
                      <td className="py-2.5 px-2 text-text-secondary">{b.topic}</td>
                      <td className="py-2.5 px-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>
                          {st.text}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right text-text-primary font-semibold">
                        {isCancelled ? '—' : `$${b.price_usd}`}
                      </td>
                      <td className="py-2.5 px-2 text-right text-emerald-400 font-semibold">
                        {isCancelled ? '—' : `$${mentorShareUsd}`}
                      </td>
                      <td className="py-2.5 px-2 text-right text-purple-400 font-semibold">
                        {isCancelled ? '—' : `$${platformShareUsd}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
