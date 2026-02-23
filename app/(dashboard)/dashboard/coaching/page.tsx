'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { GraduationCap, ChevronLeft, ChevronRight, Calendar, Clock, CheckCircle, Loader2, User } from 'lucide-react'
import toast from 'react-hot-toast'

interface Mentor {
  id: string
  name: string
  email: string
  photo_url: string | null
  bio: string | null
  topics: string[]
  price_usd: number
}

interface Slot {
  id: string
  slot_date: string
  slot_hour: number
  is_booked: boolean
}

interface Booking {
  id: string
  topic: string
  slot_date: string
  slot_hour: number
  price_usd: number
  status: string
  notes: string | null
  created_at: string
  coaching_mentors: { name: string; email: string }
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
const HOURS = [14, 15, 16, 17]
const TOPICS = ['Escalamiento', 'Creación de Landings', 'Campañas Meta']

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

export default function CoachingPage() {
  const [mentors, setMentors] = useState<Mentor[]>([])
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null)
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()))
  const [slots, setSlots] = useState<Slot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [topic, setTopic] = useState('')
  const [notes, setNotes] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Fetch mentors
  useEffect(() => {
    const fetchMentors = async () => {
      try {
        const res = await fetch('/api/coaching/mentors')
        if (res.ok) {
          const data = await res.json()
          setMentors(data)
        }
      } catch (err) {
        console.error('Error fetching mentors:', err)
      }
    }
    fetchMentors()
  }, [])

  // Fetch bookings
  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch('/api/coaching/bookings')
      if (res.ok) {
        const data = await res.json()
        setBookings(data)
      }
    } catch (err) {
      console.error('Error fetching bookings:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  // Fetch slots when mentor or week changes
  useEffect(() => {
    if (!selectedMentor) return
    const fetchSlots = async () => {
      setLoadingSlots(true)
      setSelectedSlot(null)
      try {
        const ws = weekStart.toISOString().split('T')[0]
        const res = await fetch(`/api/coaching/availability?mentorId=${selectedMentor.id}&weekStart=${ws}`)
        if (res.ok) {
          const data = await res.json()
          setSlots(data)
        }
      } catch (err) {
        console.error('Error fetching slots:', err)
      } finally {
        setLoadingSlots(false)
      }
    }
    fetchSlots()
  }, [selectedMentor, weekStart])

  const weekDates = getWeekDates(weekStart)

  const getSlot = (date: string, hour: number) =>
    slots.find(s => s.slot_date === date && s.slot_hour === hour)

  const handleBook = async () => {
    if (!selectedSlot || !topic) {
      toast.error('Selecciona un horario y un tema')
      return
    }
    setBooking(true)
    try {
      const res = await fetch('/api/coaching/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availabilityId: selectedSlot.id,
          topic,
          notes: notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al reservar')
        return
      }
      toast.success('Reserva creada exitosamente')
      setSelectedSlot(null)
      setTopic('')
      setNotes('')
      // Refresh slots and bookings
      const ws = weekStart.toISOString().split('T')[0]
      const [slotsRes, bookingsRes] = await Promise.all([
        fetch(`/api/coaching/availability?mentorId=${selectedMentor!.id}&weekStart=${ws}`),
        fetch('/api/coaching/bookings'),
      ])
      if (slotsRes.ok) setSlots(await slotsRes.json())
      if (bookingsRes.ok) setBookings(await bookingsRes.json())
    } catch (err) {
      toast.error('Error de conexión')
    } finally {
      setBooking(false)
    }
  }

  const prevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }

  const nextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }

  const statusLabel: Record<string, { text: string; color: string }> = {
    pendiente: { text: 'Pendiente', color: 'text-yellow-400 bg-yellow-400/10' },
    confirmada: { text: 'Confirmada', color: 'text-emerald-400 bg-emerald-400/10' },
    completada: { text: 'Completada', color: 'text-blue-400 bg-blue-400/10' },
    cancelada: { text: 'Cancelada', color: 'text-red-400 bg-red-400/10' },
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
          <GraduationCap className="w-7 h-7 text-accent" />
          Coaching 1:1
        </h1>
        <p className="text-text-secondary mt-1">
          Reserva una sesión de mentoría personalizada de 1 hora con nuestros expertos.
        </p>
      </div>

      {/* Mentor Cards */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4">Mentores Disponibles</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {mentors.map(mentor => (
            <div
              key={mentor.id}
              onClick={() => {
                setSelectedMentor(mentor)
                setSelectedSlot(null)
              }}
              className={`p-5 rounded-xl border cursor-pointer transition-all ${
                selectedMentor?.id === mentor.id
                  ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                  : 'border-border bg-surface hover:border-border/80'
              }`}
            >
              <div className="flex items-start gap-4">
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
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-text-primary text-lg">{mentor.name}</h3>
                  {mentor.bio && (
                    <p className="text-text-secondary text-sm mt-1 line-clamp-2">{mentor.bio}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {mentor.topics.map(t => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-lg font-bold text-text-primary">
                    ${mentor.price_usd} USD <span className="text-sm font-normal text-text-secondary">/ hora</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar + Booking Form */}
      {selectedMentor && (
        <div className="space-y-6">
          {/* Weekly Calendar */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Calendar className="w-5 h-5 text-accent" />
                Horarios de {selectedMentor.name}
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={prevWeek} className="p-1.5 rounded-lg hover:bg-border/50 text-text-secondary hover:text-text-primary transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-text-secondary min-w-[140px] text-center">
                  {formatDate(weekDates[0])} — {formatDate(weekDates[4])}
                </span>
                <button onClick={nextWeek} className="p-1.5 rounded-lg hover:bg-border/50 text-text-secondary hover:text-text-primary transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <p className="text-xs text-text-secondary mb-3">
              <Clock className="w-3.5 h-3.5 inline mr-1" />
              Hora Colombia (UTC-5) — Sesiones de 1 hora
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
                          const isSelected = selectedSlot?.id === slot?.id
                          const isPast = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00-05:00`) < new Date()

                          if (!slot) {
                            return (
                              <td key={date} className="py-1 px-1 text-center">
                                <div className="h-10 rounded-lg bg-border/20" />
                              </td>
                            )
                          }

                          if (slot.is_booked || isPast) {
                            return (
                              <td key={date} className="py-1 px-1 text-center">
                                <div className="h-10 rounded-lg bg-border/30 flex items-center justify-center">
                                  <span className="text-xs text-text-secondary/50">
                                    {isPast ? '—' : 'Ocupado'}
                                  </span>
                                </div>
                              </td>
                            )
                          }

                          return (
                            <td key={date} className="py-1 px-1 text-center">
                              <button
                                onClick={() => setSelectedSlot(slot)}
                                className={`h-10 w-full rounded-lg text-xs font-medium transition-all ${
                                  isSelected
                                    ? 'bg-accent text-background ring-2 ring-accent/30'
                                    : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                }`}
                              >
                                {isSelected ? 'Seleccionado' : 'Disponible'}
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

          {/* Booking Form */}
          {selectedSlot && (
            <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
              <h2 className="text-lg font-semibold text-text-primary">Confirmar Reserva</h2>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-background rounded-lg p-3 border border-border">
                  <p className="text-xs text-text-secondary">Fecha</p>
                  <p className="text-sm font-semibold text-text-primary">{formatDate(selectedSlot.slot_date)}</p>
                </div>
                <div className="bg-background rounded-lg p-3 border border-border">
                  <p className="text-xs text-text-secondary">Hora (Colombia)</p>
                  <p className="text-sm font-semibold text-text-primary">{selectedSlot.slot_hour}:00 — {selectedSlot.slot_hour + 1}:00</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Tema de la sesión</label>
                <select
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                >
                  <option value="">Selecciona un tema...</option>
                  {TOPICS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Notas (opcional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Describe brevemente qué quieres trabajar en la sesión..."
                  rows={3}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none resize-none"
                />
              </div>

              {/* Payment Instructions */}
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
                <p className="text-sm font-medium text-amber-400 mb-1">Instrucciones de Pago</p>
                <p className="text-sm text-text-secondary">
                  Paga <span className="font-semibold text-text-primary">${selectedMentor.price_usd} USD</span> vía billetera Dropi y envía el comprobante al mentor.
                </p>
              </div>

              <button
                onClick={handleBook}
                disabled={booking || !topic}
                className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-background font-semibold py-3 rounded-lg transition-colors"
              >
                {booking ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                {booking ? 'Reservando...' : 'Confirmar Reserva'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* My Bookings */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Mis Reservas</h2>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : bookings.length === 0 ? (
          <p className="text-text-secondary text-sm py-4 text-center">
            Aún no tienes reservas de coaching.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-text-secondary font-medium">Fecha</th>
                  <th className="text-left py-2 px-2 text-text-secondary font-medium">Hora</th>
                  <th className="text-left py-2 px-2 text-text-secondary font-medium">Mentor</th>
                  <th className="text-left py-2 px-2 text-text-secondary font-medium">Tema</th>
                  <th className="text-left py-2 px-2 text-text-secondary font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => {
                  const st = statusLabel[b.status] || statusLabel.pendiente
                  return (
                    <tr key={b.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 px-2 text-text-primary">{formatDate(b.slot_date)}</td>
                      <td className="py-2.5 px-2 text-text-primary font-mono">{b.slot_hour}:00</td>
                      <td className="py-2.5 px-2 text-text-primary">{b.coaching_mentors?.name}</td>
                      <td className="py-2.5 px-2 text-text-secondary">{b.topic}</td>
                      <td className="py-2.5 px-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>
                          {st.text}
                        </span>
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
