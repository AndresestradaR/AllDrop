'use client'

import { MessageCircle } from 'lucide-react'

const YOUTUBE_VIDEO_ID = 'd_uArV_oV5I'
const WHATSAPP_LINK = 'https://wa.link/v2098q'

export default function ChateaProPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-4xl font-bold mb-2">
          Servicio de Configuración <span className="text-teal-400">Chatea Pro</span>
        </h1>
        <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto">
          Mi equipo te configura todo Chatea Pro para que solo te preocupes por vender
        </p>
      </div>

      {/* Video */}
      <div className="w-full max-w-3xl aspect-video rounded-xl overflow-hidden border border-gray-800 mb-8">
        <iframe
          src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}`}
          title="Servicio Chatea Pro"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>

      {/* Precio */}
      <div className="text-center mb-8">
        <div className="inline-block bg-gradient-to-r from-teal-500/10 to-teal-400/5 border border-teal-500/30 rounded-2xl px-8 py-6">
          <p className="text-gray-400 text-sm mb-1">Precio del servicio</p>
          <p className="text-4xl sm:text-5xl font-bold text-teal-400">$700.000 <span className="text-lg text-gray-400">COP</span></p>
          <p className="text-gray-500 text-sm mt-1">~$165 USD</p>
        </div>
      </div>

      {/* Botón WhatsApp */}
      <a
        href={WHATSAPP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-lg px-8 py-4 rounded-xl transition-all hover:scale-105 shadow-lg shadow-[#25D366]/20"
      >
        <MessageCircle className="w-6 h-6" />
        Contratar el servicio
      </a>

      <p className="text-gray-600 text-xs mt-4">Te responderemos lo antes posible</p>
    </div>
  )
}
