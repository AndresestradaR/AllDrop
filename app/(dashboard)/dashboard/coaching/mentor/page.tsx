'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  GraduationCap, ChevronLeft, ChevronRight, Calendar, Clock, Loader2,
  Plus, Trash2, DollarSign, Users, CalendarCheck
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Slot {
  id: string
  slot_date: string
  slot_hour: number
  is_booked: boolean
}

interface Booking {
  id: string
  user_id: string
  client_email: string
  topic: string
  slot_date: string
  slot_hour: number
  price_usd: number
  status: string
  notes: string | null
  created_at: string
  mentor_share: number
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
const HOURS = [14, 15, 16, 17]

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function getWeekDates(monday: Date): string[] {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

export default function MentorPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()))
  const [slots, setSlots] = useState<Slot[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Check if user is a mentor
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const email = data.user?.email
      if (!email) {
        router.push('/dashboard')
        return
      }
      supabase
        .from('coaching_mentors')
        .select('id')
        .eq('email', email)
        .eq('is_active', true)
        .maybeSingle()
        .then(({ data: mentor }) => {
          if (!mentor) {
            router.push('/dashboard')
            return
          }
          setAuthorized(true)
          setLoading(false)
        })
    })
  }, [router])

  // Fetch slots
  const fetchSlots = useCallback(async () => {
    setLoadingSlots(true)
    try {
      const ws = weekStart.toISOString().split('T')[0]
      const res = await fetch(`/api/coaching/mentor/availability?weekStart=${ws}`)
      if (res.ok) setSlots(await res.json())
    } catch (err) {
      console.error('Error fetching mentor slots:', err)
    } finally {
      setLoadingSlots(false)
    }
  }, [weekStart])

  useEffect(() => {
    if (authorized) fetchSlots()
  }, [authorized, fetchSlots])

  // Fetch bookings
  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch('/api/coaching/mentor/bookings')
      if (res.ok) setBookings(await res.json())
    } catch (err) {
      console.error('Error fetching mentor bookings:', err)
    }
  }, [])

  useEffect(() => {
    if (authorized) fetchBookings()
  }, [authorized, fetchBookings])

  const weekDates = getWeekDates(weekStart)

  const getSlot = (date: string, hour: number) =>
    slots.find(s => s.slot_date === date && s.slot_hour === hour)

  // Generate week slots (Mon-Fri, 14-17h)
  const handleGenerateWeek = async () => {
    setGenerating(true)
    const newSlots: { slot_date: string; slot_hour: number }[] = []
    for (const date of weekDates) {
      for (const hour of HOURS) {
        if (!getSlot(date, hour)) {
          newSlots.push({ slot_date: date, slot_hour: hour })
        }
      }
    }

    if (newSlots.length === 0) {
      toast('Todos los slots de esta semana ya existen', { icon: '📅' })
      setGenerating(false)
      return
    }

    try {
      const res = await fetch('/api/coaching/mentor/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: newSlots }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`${data.created || newSlots.length} slots creados`)
        fetchSlots()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al generar slots')
      }
    } catch (err) {
      toast.error('Error de conexión')
    } finally {
      setGenerating(false)
    }
  }

  // Delete a single slot
  const handleDeleteSlot = async (slotId: string) => {
    try {
      const res = await fetch(`/api/coaching/mentor/availability?slotId=${slotId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Slot eliminado')
        fetchSlots()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al eliminar')
      }
    } catch (err) {
      toast.error('Error de conexión')
    }
  }

  // Add single slot
  const handleAddSlot = async (date: string, hour: number) => {
    try {
      const res = await fetch('/api/coaching/mentor/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: [{ slot_date: date, slot_hour: hour }] }),
      })
      if (res.ok) {
        toast.success('Slot agregado')
        fetchSlots()
      }
    } catch (err) {
      toast.error('Error de conexión')
    }
  }

  // Stats
  const totalSessions = bookings.length
  const pendingSessions = bookings.filter(b => b.status === 'pendiente').length
  const mentorShare = bookings.length > 0 ? bookings[0].mentor_share : 30
  const earnings = bookings.filter(b => b.status !== 'cancelada').length * mentorShare

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
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
          <GraduationCap className="w-7 h-7 text-accent" />
          Panel de Mentor
        </h1>
        <p className="text-text-secondary mt-1">
          Gestiona tus horarios disponibles y revisa tus sesiones de coaching.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-text-secondary">Total Sesiones</p>
              <p className="text-xl font-bold text-text-primary">{totalSessions}</p>
            </div>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400/10 rounded-lg flex items-center justify-center">
              <CalendarCheck className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-xs text-text-secondary">Pendientes</p>
              <p className="text-xl font-bold text-text-primary">{pendingSessions}</p>
            </div>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-text-secondary">Ganancias</p>
              <p className="text-xl font-bold text-text-primary">${earnings} USD</p>
            </div>
          </div>
        </div>
      </div>

      {/* Availability Calendar */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent" />
            Gestión de Horarios
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d })} className="p-1.5 rounded-lg hover:bg-border/50 text-text-secondary hover:text-text-primary transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-text-secondary min-w-[140px] text-center">
                {formatDate(weekDates[0])} — {formatDate(weekDates[4])}
              </span>
              <button onClick={() => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d })} className="p-1.5 rounded-lg hover:bg-border/50 text-text-secondary hover:text-text-primary transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={handleGenerateWeek}
              disabled={generating}
              className="flex items-center gap-2 bg-accent hover:bg-accent/90 disabled:opacity-50 text-background text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Generar Semana
            </button>
          </div>
        </div>

        <p className="text-xs text-text-secondary mb-3">
          <Clock className="w-3.5 h-3.5 inline mr-1" />
          Hora Colombia (UTC-5) — Click para agregar o quitar slots
        </p>

        {loadingSlots ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-xs text-text-secondary font-medium py-2 px-2 text-left w-16">Hora</th>
                  {weekDates.map((date, i) => (
                    <th key={date} className="text-xs text-text-secondary font-medium py-2 px-1 text-center">
                      <div>{DAYS[i]}</div>
                      <div className="text-text-primary font-semibold">{date.split('-')[2]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map(hour => (
                  <tr key={hour}>
                    <td className="text-sm text-text-secondary py-1 px-2 font-mono">{hour}:00</td>
                    {weekDates.map(date => {
                      const slot = getSlot(date, hour)

                      if (!slot) {
                        return (
                          <td key={date} className="py-1 px-1 text-center">
                            <button
                              onClick={() => handleAddSlot(date, hour)}
                              className="h-10 w-full rounded-lg border border-dashed border-border/50 hover:border-accent/50 hover:bg-accent/5 text-text-secondary/30 hover:text-accent transition-all flex items-center justify-center"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </td>
                        )
                      }

                      if (slot.is_booked) {
                        return (
                          <td key={date} className="py-1 px-1 text-center">
                            <div className="h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                              <span className="text-xs text-amber-400 font-medium">Reservado</span>
                            </div>
                          </td>
                        )
                      }

                      return (
                        <td key={date} className="py-1 px-1 text-center">
                          <button
                            onClick={() => handleDeleteSlot(slot.id)}
                            className="h-10 w-full rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400 transition-all flex items-center justify-center gap-1 group"
                          >
                            <span className="text-xs font-medium group-hover:hidden">Disponible</span>
                            <Trash2 className="w-3.5 h-3.5 hidden group-hover:block" />
                            <span className="text-xs font-medium hidden group-hover:block">Quitar</span>
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bookings Table */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Reservas</h2>

        {bookings.length === 0 ? (
          <p className="text-text-secondary text-sm py-4 text-center">
            Aún no tienes reservas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-text-secondary font-medium">Fecha</th>
                  <th className="text-left py-2 px-2 text-text-secondary font-medium">Hora</th>
                  <th className="text-left py-2 px-2 text-text-secondary font-medium">Cliente</th>
                  <th className="text-left py-2 px-2 text-text-secondary font-medium">Tema</th>
                  <th className="text-left py-2 px-2 text-text-secondary font-medium">Estado</th>
                  <th className="text-right py-2 px-2 text-text-secondary font-medium">Tu Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => {
                  const st = statusLabel[b.status] || statusLabel.pendiente
                  return (
                    <tr key={b.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 px-2 text-text-primary">{formatDate(b.slot_date)}</td>
                      <td className="py-2.5 px-2 text-text-primary font-mono">{b.slot_hour}:00</td>
                      <td className="py-2.5 px-2 text-text-secondary">{b.client_email}</td>
                      <td className="py-2.5 px-2 text-text-secondary">{b.topic}</td>
                      <td className="py-2.5 px-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>
                          {st.text}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right text-emerald-400 font-semibold">
                        {b.status === 'cancelada' ? '—' : `$${b.mentor_share}`}
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
