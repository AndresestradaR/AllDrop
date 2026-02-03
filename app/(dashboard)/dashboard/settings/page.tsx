'use client'

import { useState, useEffect } from 'react'
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'
import { Key, ExternalLink, Check, Loader2, Sparkles, Zap, Image as ImageIcon, Cpu, PlayCircle, X, Globe, Mic } from 'lucide-react'
import toast from 'react-hot-toast'

export const dynamic = 'force-dynamic'

interface ApiKeyState {
  value: string
  hasKey: boolean
  isSaving: boolean
}

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [showVideo, setShowVideo] = useState(false)

  // API Keys state
  const [googleKey, setGoogleKey] = useState<ApiKeyState>({ value: '', hasKey: false, isSaving: false })
  const [openaiKey, setOpenaiKey] = useState<ApiKeyState>({ value: '', hasKey: false, isSaving: false })
  const [kieKey, setKieKey] = useState<ApiKeyState>({ value: '', hasKey: false, isSaving: false })
  const [bflKey, setBflKey] = useState<ApiKeyState>({ value: '', hasKey: false, isSaving: false })
  const [elevenlabsKey, setElevenlabsKey] = useState<ApiKeyState>({ value: '', hasKey: false, isSaving: false })
  const [apifyKey, setApifyKey] = useState<ApiKeyState>({ value: '', hasKey: false, isSaving: false })
  const [browserlessKey, setBrowserlessKey] = useState<ApiKeyState>({ value: '', hasKey: false, isSaving: false })

  useEffect(() => {
    fetchKeys()
  }, [])

  const fetchKeys = async () => {
    try {
      const response = await fetch('/api/keys')
      const data = await response.json()

      if (data.hasGoogleApiKey) {
        setGoogleKey(prev => ({ ...prev, hasKey: true, value: data.maskedGoogleApiKey || '' }))
      }
      if (data.hasOpenaiApiKey) {
        setOpenaiKey(prev => ({ ...prev, hasKey: true, value: data.maskedOpenaiApiKey || '' }))
      }
      if (data.hasKieApiKey) {
        setKieKey(prev => ({ ...prev, hasKey: true, value: data.maskedKieApiKey || '' }))
      }
      if (data.hasBflApiKey) {
        setBflKey(prev => ({ ...prev, hasKey: true, value: data.maskedBflApiKey || '' }))
      }
      if (data.hasElevenlabsApiKey) {
        setElevenlabsKey(prev => ({ ...prev, hasKey: true, value: data.maskedElevenlabsApiKey || '' }))
      }
      if (data.hasApifyApiKey) {
        setApifyKey(prev => ({ ...prev, hasKey: true, value: data.maskedApifyApiKey || '' }))
      }
      if (data.hasBrowserlessApiKey) {
        setBrowserlessKey(prev => ({ ...prev, hasKey: true, value: data.maskedBrowserlessApiKey || '' }))
      }
    } catch (error) {
      console.error('Error fetching keys:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveKey = async (keyType: 'google' | 'openai' | 'kie' | 'bfl' | 'elevenlabs' | 'apify' | 'browserless') => {
    const keyMap = {
      google: { state: googleKey, setter: setGoogleKey, field: 'googleApiKey' },
      openai: { state: openaiKey, setter: setOpenaiKey, field: 'openaiApiKey' },
      kie: { state: kieKey, setter: setKieKey, field: 'kieApiKey' },
      bfl: { state: bflKey, setter: setBflKey, field: 'bflApiKey' },
      elevenlabs: { state: elevenlabsKey, setter: setElevenlabsKey, field: 'elevenlabsApiKey' },
      apify: { state: apifyKey, setter: setApifyKey, field: 'apifyApiKey' },
      browserless: { state: browserlessKey, setter: setBrowserlessKey, field: 'browserlessApiKey' },
    }

    const { state, setter, field } = keyMap[keyType]

    // Only send key if it doesn't look like a masked value
    if (!state.value || state.value.includes('•')) {
      toast.error('Ingresa una API key válida')
      return
    }

    setter(prev => ({ ...prev, isSaving: true }))

    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: state.value }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al guardar')
      }

      toast.success('API key guardada correctamente')
      fetchKeys() // Refresh the masked keys
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar')
    } finally {
      setter(prev => ({ ...prev, isSaving: false }))
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Configuración</h1>
        <p className="text-text-secondary mt-1">
          Configura tus API keys para los diferentes modelos de IA
        </p>
      </div>

      {/* Video Tutorial Banner */}
      <Card className="mb-6 overflow-hidden border-accent/30 bg-gradient-to-r from-accent/10 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-accent/20">
                <PlayCircle className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">¿No sabes cómo obtener las API Keys?</h3>
                <p className="text-sm text-text-secondary">Mira este tutorial de 4 minutos</p>
              </div>
            </div>
            <Button
              onClick={() => setShowVideo(true)}
              size="sm"
              className="shrink-0"
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              Ver Tutorial
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Video Modal */}
      {showVideo && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowVideo(false)}
        >
          <div 
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowVideo(false)}
              className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <div className="rounded-xl overflow-hidden shadow-2xl">
              <video
                src="https://papfcbiswvdgalfteujm.supabase.co/storage/v1/object/public/Videos/Tutorial%20Apis%20keys%202.mp4"
                controls
                autoPlay
                className="w-full aspect-video bg-black"
              >
                Tu navegador no soporta videos HTML5.
              </video>
            </div>
            <p className="text-center text-white/50 text-sm mt-4">
              Click afuera o presiona la X para cerrar
            </p>
          </div>
        </div>
      )}

      {/* Section: Generación de Imágenes */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-accent" />
          Generación de Imágenes
        </h2>
      </div>

      {/* Google/Gemini API Key */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            Google AI (Gemini)
            {googleKey.hasKey && (
              <span className="flex items-center gap-1 text-xs text-success ml-auto">
                <Check className="w-3 h-3" />
                Configurada
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Para: Gemini 2.5 Flash Image (~$0.02/img) - Mejor para texto en imágenes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="AIzaSy..."
              value={googleKey.value}
              onChange={(e) => setGoogleKey(prev => ({ ...prev, value: e.target.value }))}
              className="flex-1"
            />
            <Button
              onClick={() => handleSaveKey('google')}
              isLoading={googleKey.isSaving}
            >
              Guardar
            </Button>
          </div>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            Obtener API Key <ExternalLink className="w-3 h-3" />
          </a>
        </CardContent>
      </Card>

      {/* OpenAI API Key */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 text-white">
              <Zap className="w-4 h-4" />
            </div>
            OpenAI (GPT Image)
            {openaiKey.hasKey && (
              <span className="flex items-center gap-1 text-xs text-success ml-auto">
                <Check className="w-3 h-3" />
                Configurada
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Para: GPT Image 1 (~$0.04/img) - Alta calidad fotorealista
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="sk-..."
              value={openaiKey.value}
              onChange={(e) => setOpenaiKey(prev => ({ ...prev, value: e.target.value }))}
              className="flex-1"
            />
            <Button
              onClick={() => handleSaveKey('openai')}
              isLoading={openaiKey.isSaving}
            >
              Guardar
            </Button>
          </div>
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            Obtener API Key <ExternalLink className="w-3 h-3" />
          </a>
        </CardContent>
      </Card>

      {/* KIE.ai API Key */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white">
              <ImageIcon className="w-4 h-4" />
            </div>
            KIE.ai (Seedream)
            {kieKey.hasKey && (
              <span className="flex items-center gap-1 text-xs text-success ml-auto">
                <Check className="w-3 h-3" />
                Configurada
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Para: Seedream 4.5 (~$0.032/img) - Excelente para edición de imágenes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="kie_..."
              value={kieKey.value}
              onChange={(e) => setKieKey(prev => ({ ...prev, value: e.target.value }))}
              className="flex-1"
            />
            <Button
              onClick={() => handleSaveKey('kie')}
              isLoading={kieKey.isSaving}
            >
              Guardar
            </Button>
          </div>
          <a
            href="https://kie.ai/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            Obtener API Key <ExternalLink className="w-3 h-3" />
          </a>
        </CardContent>
      </Card>

      {/* BFL API Key */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 text-white">
              <Cpu className="w-4 h-4" />
            </div>
            Black Forest Labs (FLUX)
            {bflKey.hasKey && (
              <span className="flex items-center gap-1 text-xs text-success ml-auto">
                <Check className="w-3 h-3" />
                Configurada
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Para: FLUX Pro 1.1 (~$0.04/img) - Generación ultra rápida
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="bfl_..."
              value={bflKey.value}
              onChange={(e) => setBflKey(prev => ({ ...prev, value: e.target.value }))}
              className="flex-1"
            />
            <Button
              onClick={() => handleSaveKey('bfl')}
              isLoading={bflKey.isSaving}
            >
              Guardar
            </Button>
          </div>
          <a
            href="https://api.bfl.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            Obtener API Key <ExternalLink className="w-3 h-3" />
          </a>
        </CardContent>
      </Card>

      {/* Section: Herramientas Adicionales */}
      <div className="mt-8 mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-accent" />
          Herramientas Adicionales
        </h2>
      </div>

      {/* Apify API Key */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 text-white">
              <Globe className="w-4 h-4" />
            </div>
            Apify (Meta Ads Search)
            {apifyKey.hasKey && (
              <span className="flex items-center gap-1 text-xs text-success ml-auto">
                <Check className="w-3 h-3" />
                Configurada
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Para: Buscar anuncios de competidores en Facebook/Instagram
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="apify_api_..."
              value={apifyKey.value}
              onChange={(e) => setApifyKey(prev => ({ ...prev, value: e.target.value }))}
              className="flex-1"
            />
            <Button
              onClick={() => handleSaveKey('apify')}
              isLoading={apifyKey.isSaving}
            >
              Guardar
            </Button>
          </div>
          <a
            href="https://console.apify.com/account/integrations"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            Obtener API Key <ExternalLink className="w-3 h-3" />
          </a>
        </CardContent>
      </Card>

      {/* Browserless API Key */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
              <Globe className="w-4 h-4" />
            </div>
            Browserless (Web Scraping)
            {browserlessKey.hasKey && (
              <span className="flex items-center gap-1 text-xs text-success ml-auto">
                <Check className="w-3 h-3" />
                Configurada
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Para: Extraer precios de landing pages (~$0.01/pagina)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="..."
              value={browserlessKey.value}
              onChange={(e) => setBrowserlessKey(prev => ({ ...prev, value: e.target.value }))}
              className="flex-1"
            />
            <Button
              onClick={() => handleSaveKey('browserless')}
              isLoading={browserlessKey.isSaving}
            >
              Guardar
            </Button>
          </div>
          <a
            href="https://www.browserless.io/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            Obtener API Key <ExternalLink className="w-3 h-3" />
          </a>
        </CardContent>
      </Card>

      {/* ElevenLabs API Key */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 text-white">
              <Mic className="w-4 h-4" />
            </div>
            ElevenLabs (Text-to-Speech)
            {elevenlabsKey.hasKey && (
              <span className="flex items-center gap-1 text-xs text-success ml-auto">
                <Check className="w-3 h-3" />
                Configurada
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Para: Generación de voz - Crea audios para videos y ads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="sk_..."
              value={elevenlabsKey.value}
              onChange={(e) => setElevenlabsKey(prev => ({ ...prev, value: e.target.value }))}
              className="flex-1"
            />
            <Button
              onClick={() => handleSaveKey('elevenlabs')}
              isLoading={elevenlabsKey.isSaving}
            >
              Guardar
            </Button>
          </div>
          <a
            href="https://elevenlabs.io/app/settings/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            Obtener API Key <ExternalLink className="w-3 h-3" />
          </a>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="mt-6" variant="glass">
        <CardContent className="pt-6">
          <h3 className="font-medium text-text-primary mb-2">¿Por qué múltiples modelos?</h3>
          <p className="text-sm text-text-secondary mb-4">
            Cada modelo tiene fortalezas diferentes. Puedes elegir el mejor para cada caso:
          </p>
          <ul className="text-sm text-text-secondary space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-blue-500">•</span>
              <span><strong>Gemini</strong> - Mejor para banners con texto legible</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">•</span>
              <span><strong>GPT Image</strong> - Calidad fotorealista superior</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500">•</span>
              <span><strong>Seedream</strong> - Ideal para editar y combinar imágenes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pink-500">•</span>
              <span><strong>FLUX</strong> - Generacion rapida con buenos resultados</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-violet-500">•</span>
              <span><strong>ElevenLabs</strong> - Voces ultra realistas para tus videos</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-500">•</span>
              <span><strong>Apify</strong> - Busca anuncios de competidores en Meta Ads</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-500">•</span>
              <span><strong>Browserless</strong> - Extrae precios de landing pages</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* BYOK Info */}
      <Card className="mt-4" variant="glass">
        <CardContent className="pt-6">
          <h3 className="font-medium text-text-primary mb-2">Modelo BYOK</h3>
          <p className="text-sm text-text-secondary">
            Solo necesitas configurar las API keys de los modelos que quieras usar.
            Pagas directamente a cada proveedor, sin intermediarios ni markup.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
