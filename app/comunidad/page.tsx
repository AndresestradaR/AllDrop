'use client'

import { useState, useRef } from 'react'
import { CheckCircle2, Copy, Mail, AlertCircle, Shield, Users, Zap, X, MessageCircle } from 'lucide-react'

const YOUTUBE_VIDEO_ID = 'nEHrlt4qZig'

const WHATSAPP_LINK = 'https://wa.link/foyivm'

const PAISES = [
  'Colombia', 'Mexico', 'Peru', 'Chile', 'Ecuador', 'Panama',
  'Costa Rica', 'Republica Dominicana', 'Guatemala', 'Bolivia', 'Otro',
]

type Step = 'video' | 'form' | 'template'

export default function ComunidadPage() {
  const [step, setStep] = useState<Step>('video')
  const [form, setForm] = useState({
    nombre: '',
    correo: '',
    pais: '',
    comunidadActual: '',
    comunidadDestino: 'EstrategasIA',
    motivo: '',
  })
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const templateRef = useRef<HTMLDivElement>(null)

  const handleAccept = () => setStep('form')

  const handleReject = () => {
    window.location.href = 'https://estrategasia.com'
  }

  const handleGenerateTemplate = (e: React.FormEvent) => {
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

    setStep('template')
    setTimeout(() => templateRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const templateText = `NOMBRE: ${form.nombre}
CORREO USUARIO: ${form.correo}
PAIS DE OPERACION: ${form.pais}
COMUNIDAD A LA QUE PERTENECE: ${form.comunidadActual}
COMUNIDAD A LA QUE DESEA PERTENECER: ${form.comunidadDestino}
MOTIVO: ${form.motivo}`

  const mailtoLink = `mailto:Leydi.bello@dropi.co,gabriela.marrero@dropi.co?cc=notificaciones@estrategasia.com&subject=${encodeURIComponent('ENVIO DE CORREO CAMBIO DE COMUNIDAD')}&body=${encodeURIComponent(templateText)}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(templateText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = templateText
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const whatsappUrl = WHATSAPP_LINK

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-teal-500/5 via-transparent to-transparent" />
        <div className="max-w-4xl mx-auto px-4 pt-12 pb-6 relative">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-medium mb-4">
              <Users className="w-3.5 h-3.5" />
              Comunidad EstrategasIA
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Unete a la Comunidad
            </h1>
            <p className="text-[#999] text-base sm:text-lg max-w-2xl mx-auto">
              Mira el siguiente video donde explicamos las{' '}
              <strong className="text-white">politicas y requisitos</strong> para ser parte de nuestra comunidad.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-20">
        {/* Video */}
        <div className="mb-8">
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
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {[
            { icon: Zap, title: 'Herramientas IA', desc: 'Acceso a todas las herramientas de Estrategas IA' },
            { icon: Users, title: 'Comunidad Activa', desc: 'Grupo de dropshippers LATAM compartiendo estrategias' },
            { icon: Shield, title: 'Soporte Directo', desc: 'Acompanamiento y mentoria personalizada' },
          ].map((b, i) => (
            <div key={i} className="flex gap-3 p-4 rounded-xl bg-[#111] border border-[#1a1a1a]">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-teal-500/10 flex items-center justify-center">
                <b.icon className="w-4 h-4 text-teal-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{b.title}</h3>
                <p className="text-xs text-[#777] mt-0.5">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* STEP: Accept/Reject buttons */}
        {step === 'video' && (
          <div className="flex flex-col items-center gap-4">
            <style jsx>{`
              @keyframes pulseGlow {
                0%, 100% { box-shadow: 0 0 20px rgba(20, 184, 166, 0.3), 0 0 60px rgba(20, 184, 166, 0.1); transform: scale(1); }
                50% { box-shadow: 0 0 30px rgba(20, 184, 166, 0.5), 0 0 80px rgba(20, 184, 166, 0.2); transform: scale(1.02); }
              }
            `}</style>
            <button
              onClick={handleAccept}
              style={{ animation: 'pulseGlow 2s ease-in-out infinite' }}
              className="w-full max-w-xl py-5 px-6 rounded-2xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-bold text-base sm:text-lg transition-all flex items-center justify-center gap-3"
            >
              <CheckCircle2 className="w-6 h-6" />
              Acepto las politicas y quiero ser parte de la comunidad
            </button>
            <button
              onClick={handleReject}
              className="flex items-center gap-2 py-3 px-6 rounded-xl text-[#666] hover:text-[#999] text-sm transition-colors"
            >
              <X className="w-4 h-4" />
              No gracias, no me interesa
            </button>
          </div>
        )}

        {/* STEP: Form */}
        {step === 'form' && (
          <div className="bg-[#111] border border-[#222] rounded-2xl p-6 sm:p-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-2 py-3 px-4 rounded-xl bg-teal-500/5 border border-teal-500/20 text-teal-400 text-sm mb-6">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Politicas aceptadas — completa tus datos para generar la plantilla
            </div>

            <form onSubmit={handleGenerateTemplate} className="space-y-4">
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
                <label className="block text-xs font-medium text-[#999] mb-1.5">Motivo del cambio</label>
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
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-bold text-sm transition-all shadow-lg shadow-teal-500/20"
              >
                Generar Plantilla del Correo
              </button>
            </form>
          </div>
        )}

        {/* STEP: Template */}
        {step === 'template' && (
          <div ref={templateRef} className="space-y-6 animate-in fade-in duration-500">
            {/* Big warning */}
            <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-amber-400" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-amber-400 mb-3" style={{ fontFamily: 'Outfit, sans-serif' }}>
                IMPORTANTE
              </h2>
              <p className="text-amber-200/80 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
                Debes enviar este correo <strong className="text-white">DESDE el correo con el que te registraste en Dropi</strong>.
                <br />Si lo envias desde otro correo, Dropi no procesara tu solicitud.
              </p>
            </div>

            {/* Recipients */}
            <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
              <h3 className="text-xs font-bold text-[#999] uppercase tracking-wider mb-3">Enviar a estos correos:</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 py-2 px-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
                  <Mail className="w-4 h-4 text-teal-400 flex-shrink-0" />
                  <span className="text-white text-sm font-medium">Leydi.bello@dropi.co</span>
                </div>
                <div className="flex items-center gap-3 py-2 px-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
                  <Mail className="w-4 h-4 text-teal-400 flex-shrink-0" />
                  <span className="text-white text-sm font-medium">gabriela.marrero@dropi.co</span>
                </div>
                <div className="flex items-center gap-3 py-2 px-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
                  <Mail className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="text-[#999] text-sm">CC: notificaciones@estrategasia.com</span>
                </div>
              </div>
              <p className="text-xs text-[#555] mt-3">
                Asunto: <strong className="text-[#999]">ENVIO DE CORREO CAMBIO DE COMUNIDAD</strong>
              </p>
            </div>

            {/* Template */}
            <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-[#999] uppercase tracking-wider">Tu plantilla lista:</h3>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    copied
                      ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                      : 'bg-[#222] text-[#999] hover:text-white border border-[#333] hover:border-[#444]'
                  }`}
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 font-mono text-sm text-[#ccc] whitespace-pre-wrap leading-relaxed">
                {templateText}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              <a
                href={mailtoLink}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-bold text-sm transition-all shadow-lg shadow-teal-500/20"
              >
                <Mail className="w-5 h-5" />
                Abrir mi correo con la plantilla lista
              </a>

              <div className="relative flex items-center justify-center my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#222]" />
                </div>
                <span className="relative bg-[#0a0a0a] px-4 text-xs text-[#555]">Cuando ya hayas enviado el correo</span>
              </div>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold text-sm transition-all"
              >
                <MessageCircle className="w-5 h-5" />
                Ya envie el correo — Escribir a Andres por WhatsApp
              </a>

              <p className="text-center text-[10px] text-[#555] mt-2">
                Envia pantallazo del correo enviado para confirmar tu solicitud
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
