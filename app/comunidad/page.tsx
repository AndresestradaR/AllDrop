'use client'

import { useState } from 'react'
import { CheckCircle2, Send, AlertCircle, ArrowRight, Shield, Users, Zap } from 'lucide-react'

// CAMBIAR ESTO por el ID del video de YouTube (la parte despues de v=)
const YOUTUBE_VIDEO_ID = 'TU_VIDEO_ID_AQUI'

const PAISES = [
  'Colombia',
  'Mexico',
  'Peru',
  'Chile',
  'Ecuador',
  'Panama',
  'Costa Rica',
  'Republica Dominicana',
  'Guatemala',
  'Bolivia',
  'Otro',
]

export default function ComunidadPage() {
  const [form, setForm] = useState({
    nombre: '',
    correo: '',
    pais: '',
    comunidadActual: '',
    comunidadDestino: 'EstrategasIA',
    motivo: '',
  })
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [videoWatched, setVideoWatched] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.nombre || !form.correo || !form.pais || !form.comunidadActual || !form.motivo) {
      setError('Todos los campos son obligatorios')
      return
    }

    if (!form.correo.includes('@')) {
      setError('Ingresa un correo valido (el mismo con el que estas registrado en Dropi)')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/comunidad/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al enviar')

      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Error al enviar la solicitud')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 rounded-full bg-teal-500/10 border-2 border-teal-500 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-teal-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Solicitud Enviada
          </h1>
          <p className="text-[#999] text-lg mb-8">
            Tu correo de cambio de comunidad fue enviado automaticamente a Dropi.
          </p>

          <div className="bg-[#111] border border-[#222] rounded-2xl p-6 text-left mb-6">
            <h3 className="text-sm font-bold text-teal-400 mb-3">Siguiente paso:</h3>
            <ol className="space-y-3 text-[#ccc] text-sm">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 text-xs font-bold flex items-center justify-center">1</span>
                <span>Toma un <strong className="text-white">pantallazo</strong> de esta pantalla</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 text-xs font-bold flex items-center justify-center">2</span>
                <span>Envialo por <strong className="text-white">WhatsApp o Instagram</strong> a Andres</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 text-xs font-bold flex items-center justify-center">3</span>
                <span>Espera la confirmacion de tu acceso a la comunidad</span>
              </li>
            </ol>
          </div>

          <div className="bg-[#0d1f1a] border border-teal-500/20 rounded-xl p-4 text-sm text-teal-300/80">
            <p><strong>Correo enviado a:</strong> Leydi.bello@dropi.co y gabriela.marrero@dropi.co</p>
            <p className="mt-1"><strong>Copia a:</strong> notificaciones@estrategasia.com</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-teal-500/5 via-transparent to-transparent" />
        <div className="max-w-4xl mx-auto px-4 pt-12 pb-8 relative">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-medium mb-4">
              <Users className="w-3.5 h-3.5" />
              Comunidad EstrategasIA
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Unete a la Comunidad
            </h1>
            <p className="text-[#999] text-base sm:text-lg max-w-2xl mx-auto">
              Antes de solicitar tu cambio, mira el siguiente video donde explicamos
              las <strong className="text-white">politicas y requisitos</strong> para ser parte de nuestra comunidad.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-20">
        {/* Video Section */}
        <div className="mb-10">
          <div className="relative rounded-2xl overflow-hidden border border-[#222] bg-black">
            <div className="aspect-video">
              <iframe
                src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?rel=0`}
                title="Politicas de la Comunidad EstrategasIA"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </div>

          {!videoWatched && (
            <button
              onClick={() => setVideoWatched(true)}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#111] border border-[#333] text-[#999] hover:text-white hover:border-teal-500/40 transition-all text-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              Ya vi el video y acepto las politicas
            </button>
          )}

          {videoWatched && (
            <div className="mt-4 flex items-center gap-2 py-3 px-4 rounded-xl bg-teal-500/5 border border-teal-500/20 text-teal-400 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Politicas aceptadas — completa el formulario abajo
            </div>
          )}
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
          {[
            { icon: Zap, title: 'Herramientas IA', desc: 'Acceso a todas las herramientas de Estrategas IA' },
            { icon: Users, title: 'Comunidad Activa', desc: 'Grupo de dropshippers LATAM compartiendo estrategias' },
            { icon: Shield, title: 'Soporte Directo', desc: 'Acompanamiento y mentoria personalizada' },
          ].map((b, i) => (
            <div key={i} className="flex gap-3 p-4 rounded-xl bg-[#111] border border-[#1a1a1a]">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-teal-500/10 flex items-center justify-center">
                <b.icon className="w-4.5 h-4.5 text-teal-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{b.title}</h3>
                <p className="text-xs text-[#777] mt-0.5">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        <div className={`transition-all duration-500 ${videoWatched ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
          <div className="bg-[#111] border border-[#222] rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
                <Send className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Solicitud de Cambio
                </h2>
                <p className="text-xs text-[#777]">
                  Se enviara un correo automatico a Dropi con tu solicitud
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#999] mb-1.5">Nombre completo</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Tu nombre como aparece en Dropi"
                  className="w-full px-4 py-3 rounded-xl bg-[#0a0a0a] border border-[#222] text-white text-sm placeholder:text-[#555] focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#999] mb-1.5">
                  Correo registrado en Dropi
                  <span className="text-red-400 ml-1">*</span>
                </label>
                <input
                  type="email"
                  value={form.correo}
                  onChange={e => setForm(f => ({ ...f, correo: e.target.value }))}
                  placeholder="tucorreo@ejemplo.com"
                  className="w-full px-4 py-3 rounded-xl bg-[#0a0a0a] border border-[#222] text-white text-sm placeholder:text-[#555] focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                />
                <p className="text-[10px] text-[#555] mt-1">Debe ser el mismo correo con el que te registraste en Dropi</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#999] mb-1.5">Pais de operacion</label>
                  <select
                    value={form.pais}
                    onChange={e => setForm(f => ({ ...f, pais: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-[#0a0a0a] border border-[#222] text-white text-sm focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all appearance-none"
                  >
                    <option value="" className="bg-[#0a0a0a]">Selecciona tu pais</option>
                    {PAISES.map(p => (
                      <option key={p} value={p} className="bg-[#0a0a0a]">{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#999] mb-1.5">Comunidad actual</label>
                  <input
                    type="text"
                    value={form.comunidadActual}
                    onChange={e => setForm(f => ({ ...f, comunidadActual: e.target.value }))}
                    placeholder="Nombre de tu comunidad actual"
                    className="w-full px-4 py-3 rounded-xl bg-[#0a0a0a] border border-[#222] text-white text-sm placeholder:text-[#555] focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#999] mb-1.5">Comunidad destino</label>
                <input
                  type="text"
                  value={form.comunidadDestino}
                  readOnly
                  className="w-full px-4 py-3 rounded-xl bg-teal-500/5 border border-teal-500/20 text-teal-400 text-sm font-medium cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#999] mb-1.5">
                  Motivo del cambio
                </label>
                <textarea
                  value={form.motivo}
                  onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
                  placeholder="Explica brevemente por que deseas unirte a EstrategasIA..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-[#0a0a0a] border border-[#222] text-white text-sm placeholder:text-[#555] focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all resize-none"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 py-3 px-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-500/20"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enviando solicitud...
                  </>
                ) : (
                  <>
                    Enviar Solicitud a Dropi
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="text-center text-[10px] text-[#555]">
                Al enviar, se mandara un correo automatico a Dropi solicitando tu cambio de comunidad.
                <br />Recibiras copia en notificaciones@estrategasia.com
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
