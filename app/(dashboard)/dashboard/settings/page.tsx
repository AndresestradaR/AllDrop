'use client'

import { useState, useEffect } from 'react'
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'
import { Key, ExternalLink, Check, Loader2, Sparkles, Zap, Image as ImageIcon, PlayCircle, Globe, Mic, Cloud, Share2, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

const ADMIN_EMAIL = 'trucosecomydrop@gmail.com'

export const dynamic = 'force-dynamic'

interface ApiKeyState {
  value: string
  hasKey: boolean
  isSaving: boolean
}

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showKeys, setShowKeys] = useState(false)

  // API Keys state
  const [googleKey, setGoogleKey] = useState<ApiKeyState>({ value: '', hasKey: false, isSaving: false })
  const [openaiKey, setOpenaiKey] = useState<ApiKeyState>({ value: '', hasKey: false, isSaving: false })
  const [kieKey, setKieKey] = useState<ApiKeyState>({ value: '', hasKey: false, isSaving: false })
  const [bflKey, setBflKey] = useState<ApiKeyState>({ value: '', hasKey: false, isSaving: false })
  const [falKey, setFalKey] = useState<ApiKeyState>({ value: '', hasKey: false, isSaving: false })
  const [wavespeedKey, setWavespeedKey] = useState<ApiKeyState>({ value: '', hasKey: false, isSaving: false })
  const [elevenlabsKey, setElevenlabsKey] = useState<ApiKeyState>({ value: '', hasKey: false, isSaving: false })
  const [apifyKey, setApifyKey] = useState<ApiKeyState>({ value: '', hasKey: false, isSaving: false })
  const [browserlessKey, setBrowserlessKey] = useState<ApiKeyState>({ value: '', hasKey: false, isSaving: false })

  // Cloudflare R2 state
  const [r2AccountId, setR2AccountId] = useState('')
  const [r2AccessKeyId, setR2AccessKeyId] = useState('')
  const [r2SecretAccessKey, setR2SecretAccessKey] = useState('')
  const [r2BucketName, setR2BucketName] = useState('')
  const [r2PublicUrl, setR2PublicUrl] = useState('')
  const [hasR2, setHasR2] = useState(false)
  const [isSavingR2, setIsSavingR2] = useState(false)
  const [isTestingR2, setIsTestingR2] = useState(false)

  // Publer state
  const [publerApiKey, setPublerApiKey] = useState<ApiKeyState>({ value: '', hasKey: false, isSaving: false })
  const [publerWorkspaceId, setPublerWorkspaceId] = useState('')
  const [isSavingPubler, setIsSavingPubler] = useState(false)
  const [isTestingPubler, setIsTestingPubler] = useState(false)
  const [hasPubler, setHasPubler] = useState(false)

  // Meta Ads state
  const [metaAccessToken, setMetaAccessToken] = useState<ApiKeyState>({ value: '', hasKey: false, isSaving: false })
  const [anthropicApiKey, setAnthropicApiKey] = useState<ApiKeyState>({ value: '', hasKey: false, isSaving: false })
  const [isSavingMeta, setIsSavingMeta] = useState(false)
  const [hasMetaAds, setHasMetaAds] = useState(false)

  useEffect(() => {
    fetchKeys()
    createClient().auth.getUser().then(({ data }) => {
      if (data.user?.email === ADMIN_EMAIL) setIsAdmin(true)
    })
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
      if (data.hasFalApiKey) {
        setFalKey(prev => ({ ...prev, hasKey: true, value: data.maskedFalApiKey || '' }))
      }
      if (data.hasWavespeedApiKey) {
        setWavespeedKey(prev => ({ ...prev, hasKey: true, value: data.maskedWavespeedApiKey || '' }))
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
      // Cloudflare R2
      if (data.hasR2) {
        setHasR2(true)
        setR2AccountId(data.r2AccountId || '')
        setR2BucketName(data.r2BucketName || '')
        setR2PublicUrl(data.r2PublicUrl || '')
      }
      if (data.hasR2AccessKeyId) {
        setR2AccessKeyId(data.maskedR2AccessKeyId || '')
      }
      if (data.hasR2SecretAccessKey) {
        setR2SecretAccessKey(data.maskedR2SecretAccessKey || '')
      }
      // Publer
      if (data.hasPubler) {
        setHasPubler(true)
        setPublerApiKey(prev => ({ ...prev, hasKey: true, value: data.maskedPublerApiKey || '' }))
        setPublerWorkspaceId(data.publerWorkspaceId || '')
      }
      // Meta Ads
      if (data.hasMetaAccessToken) {
        setMetaAccessToken(prev => ({ ...prev, hasKey: true, value: data.maskedMetaAccessToken || '' }))
      }
      if (data.hasAnthropicApiKey) {
        setAnthropicApiKey(prev => ({ ...prev, hasKey: true, value: data.maskedAnthropicApiKey || '' }))
      }
      setHasMetaAds(!!data.hasMetaAccessToken && !!data.hasAnthropicApiKey)
    } catch (error) {
      console.error('Error fetching keys:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveKey = async (keyType: 'google' | 'openai' | 'kie' | 'bfl' | 'fal' | 'wavespeed' | 'elevenlabs' | 'apify' | 'browserless') => {
    const keyMap = {
      google: { state: googleKey, setter: setGoogleKey, field: 'googleApiKey' },
      openai: { state: openaiKey, setter: setOpenaiKey, field: 'openaiApiKey' },
      kie: { state: kieKey, setter: setKieKey, field: 'kieApiKey' },
      bfl: { state: bflKey, setter: setBflKey, field: 'bflApiKey' },
      fal: { state: falKey, setter: setFalKey, field: 'falApiKey' },
      wavespeed: { state: wavespeedKey, setter: setWavespeedKey, field: 'wavespeedApiKey' },
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

  const handleSaveR2 = async () => {
    // Validate required fields (skip if masked)
    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName) {
      toast.error('Completa al menos Account ID, Access Key ID, Secret Access Key y Bucket Name')
      return
    }
    // Don't save if all look masked
    const hasMaskedOnly = [r2AccessKeyId, r2SecretAccessKey].every(v => v.includes('•'))
    if (hasMaskedOnly && hasR2) {
      toast.error('Ingresa nuevas credenciales para actualizar')
      return
    }

    setIsSavingR2(true)
    try {
      const payload: Record<string, string> = {}
      if (!r2AccountId.includes('•')) payload.cfAccountId = r2AccountId
      if (!r2AccessKeyId.includes('•')) payload.cfAccessKeyId = r2AccessKeyId
      if (!r2SecretAccessKey.includes('•')) payload.cfSecretAccessKey = r2SecretAccessKey
      if (!r2BucketName.includes('•')) payload.cfBucketName = r2BucketName
      if (r2PublicUrl && !r2PublicUrl.includes('•')) payload.cfPublicUrl = r2PublicUrl

      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al guardar')
      toast.success('Credenciales R2 guardadas correctamente')
      fetchKeys()
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar')
    } finally {
      setIsSavingR2(false)
    }
  }

  const handleSavePubler = async () => {
    const hasNewKey = publerApiKey.value && !publerApiKey.value.includes('•')
    const hasNewWorkspace = publerWorkspaceId && !publerWorkspaceId.includes('•')

    if (!hasPubler && (!hasNewKey || !hasNewWorkspace)) {
      toast.error('Completa la API Key y el Workspace ID de Publer')
      return
    }

    setIsSavingPubler(true)
    try {
      const body: Record<string, string> = {}
      if (hasNewKey) body.publerApiKey = publerApiKey.value
      body.publerWorkspaceId = publerWorkspaceId

      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al guardar')

      toast.success('Credenciales de Publer guardadas')
      fetchKeys()
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar')
    } finally {
      setIsSavingPubler(false)
    }
  }

  const handleSaveMetaAds = async () => {
    const hasNewToken = metaAccessToken.value && !metaAccessToken.value.includes('•')
    const hasNewAnthropicKey = anthropicApiKey.value && !anthropicApiKey.value.includes('•')

    if (!hasNewToken && !hasNewAnthropicKey) {
      toast.error('Ingresa al menos un campo nuevo')
      return
    }

    setIsSavingMeta(true)
    try {
      const body: Record<string, string> = {}
      if (hasNewToken) body.metaAccessToken = metaAccessToken.value
      if (hasNewAnthropicKey) body.anthropicApiKey = anthropicApiKey.value

      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al guardar')

      toast.success('Credenciales de Meta Ads IA guardadas')
      fetchKeys()
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar')
    } finally {
      setIsSavingMeta(false)
    }
  }

  const handleTestPubler = async () => {
    setIsTestingPubler(true)
    try {
      const response = await fetch('/api/publer/accounts')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al conectar')
      const count = data.accounts?.length || 0
      toast.success(`Publer conectado. ${count} cuenta${count !== 1 ? 's' : ''} encontrada${count !== 1 ? 's' : ''}`)
    } catch (error: any) {
      toast.error(error.message || 'Error al conectar con Publer')
    } finally {
      setIsTestingPubler(false)
    }
  }

  const handleTestR2 = async () => {
    setIsTestingR2(true)
    try {
      const response = await fetch('/api/studio/r2/test', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al conectar')
      toast.success(`Conexion exitosa — ${data.objectCount} objetos encontrados`)
    } catch (error: any) {
      toast.error(error.message || 'Error al conectar con R2')
    } finally {
      setIsTestingR2(false)
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

      {/* Video Tutorial Embebido */}
      <div className="mb-6">
        <h3 className="font-semibold text-text-primary mb-2 flex items-center gap-2">
          <PlayCircle className="w-5 h-5 text-accent" />
          Tutorial: Cómo obtener tus API Keys
        </h3>
        <div className="rounded-xl overflow-hidden border border-accent/30">
          <iframe
            src="https://www.youtube.com/embed/ahwMh6GpuAg?rel=0"
            title="Tutorial API Keys"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full aspect-video bg-black"
          />
        </div>
      </div>

      {/* Toggle show/hide API keys */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowKeys(!showKeys)}
          className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary transition-colors px-3 py-1.5 rounded-lg border border-border hover:border-accent/50"
        >
          {showKeys ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showKeys ? 'Ocultar API Keys' : 'Mostrar API Keys'}
        </button>
      </div>

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
              type={showKeys ? "text" : "password"}
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
              type={showKeys ? "text" : "password"}
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
              type={showKeys ? "text" : "password"}
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

      {/* fal.ai API Key */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
              <Zap className="w-4 h-4" />
            </div>
            fal.ai (Backup de imagenes)
            {falKey.hasKey && (
              <span className="flex items-center gap-1 text-xs text-success ml-auto">
                <Check className="w-3 h-3" />
                Configurada
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Para: Backup automatico si KIE falla — Seedream 5, FLUX Pro, Gemini Flash
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type={showKeys ? "text" : "password"}
              placeholder="fal_..."
              value={falKey.value}
              onChange={(e) => setFalKey(prev => ({ ...prev, value: e.target.value }))}
              className="flex-1"
            />
            <Button
              onClick={() => handleSaveKey('fal')}
              isLoading={falKey.isSaving}
            >
              Guardar
            </Button>
          </div>
          <a
            href="https://fal.ai/dashboard/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            Obtener API Key <ExternalLink className="w-3 h-3" />
          </a>
        </CardContent>
      </Card>

      {/* WaveSpeed API Key */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 text-white">
              <Zap className="w-4 h-4" />
            </div>
            WaveSpeed AI (Backup de video e imagen)
            {wavespeedKey.hasKey && (
              <span className="flex items-center gap-1 text-xs text-success ml-auto">
                <Check className="w-3 h-3" />
                Configurada
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Para: Backup automatico si KIE falla — Veo 3.1, Kling 3, Sora 2, Seedance, FLUX
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type={showKeys ? "text" : "password"}
              placeholder="Tu WaveSpeed API Key"
              value={wavespeedKey.value}
              onChange={(e) => setWavespeedKey(prev => ({ ...prev, value: e.target.value }))}
              className="flex-1"
            />
            <Button
              onClick={() => handleSaveKey('wavespeed')}
              isLoading={wavespeedKey.isSaving}
            >
              Guardar
            </Button>
          </div>
          <a
            href="https://wavespeed.ai/dashboard"
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
              type={showKeys ? "text" : "password"}
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

      {/* Browserless API Key — admin only */}
      {isAdmin && (
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
                type={showKeys ? "text" : "password"}
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
      )}

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
              type={showKeys ? "text" : "password"}
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

      {/* Section: Almacenamiento en la Nube */}
      <div className="mt-8 mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Cloud className="w-5 h-5 text-accent" />
          Almacenamiento en la Nube
        </h2>
      </div>

      {/* Cloudflare R2 */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-white">
              <Cloud className="w-4 h-4" />
            </div>
            Cloudflare R2 (Storage)
            {hasR2 && (
              <span className="flex items-center gap-1 text-xs text-success ml-auto">
                <Check className="w-3 h-3" />
                Configurado
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Almacena imagenes y videos generados en tu propio bucket R2
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Account ID</label>
            <Input
              placeholder="Tu Cloudflare Account ID"
              value={r2AccountId}
              onChange={(e) => setR2AccountId(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Access Key ID</label>
            <Input
              type={showKeys ? "text" : "password"}
              placeholder="R2 Access Key ID"
              value={r2AccessKeyId}
              onChange={(e) => setR2AccessKeyId(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Secret Access Key</label>
            <Input
              type={showKeys ? "text" : "password"}
              placeholder="R2 Secret Access Key"
              value={r2SecretAccessKey}
              onChange={(e) => setR2SecretAccessKey(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Bucket Name</label>
            <Input
              placeholder="mi-bucket"
              value={r2BucketName}
              onChange={(e) => setR2BucketName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Public URL (opcional)</label>
            <Input
              placeholder="https://cdn.midominio.com"
              value={r2PublicUrl}
              onChange={(e) => setR2PublicUrl(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleSaveR2}
              isLoading={isSavingR2}
              className="flex-1"
            >
              Guardar Credenciales
            </Button>
            {hasR2 && (
              <Button
                onClick={handleTestR2}
                isLoading={isTestingR2}
                variant="secondary"
              >
                Probar Conexion
              </Button>
            )}
          </div>
          <a
            href="https://dash.cloudflare.com/?to=/:account/r2/api-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            Crear API Token en Cloudflare <ExternalLink className="w-3 h-3" />
          </a>
        </CardContent>
      </Card>

      {/* Section: Publicación en Redes Sociales */}
      <div className="mt-8 mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Share2 className="w-5 h-5 text-accent" />
          Publicación en Redes Sociales
        </h2>
      </div>

      {/* Publer */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500 text-white">
              <Share2 className="w-4 h-4" />
            </div>
            Publer (Social Media)
            {hasPubler && (
              <span className="flex items-center gap-1 text-xs text-success ml-auto">
                <Check className="w-3 h-3" />
                Configurado
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Publica imágenes y videos directamente a Facebook, Instagram, TikTok, YouTube y más
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* API Key */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">API Key *</label>
            <Input
              type={showKeys ? "text" : "password"}
              placeholder="Tu Publer API Key"
              value={publerApiKey.value}
              onChange={(e) => setPublerApiKey(prev => ({ ...prev, value: e.target.value }))}
            />
          </div>
          {/* Workspace ID */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Workspace ID *</label>
            <Input
              type="text"
              placeholder="5f8d7a62c9e77e001f36e3a1"
              value={publerWorkspaceId}
              onChange={(e) => setPublerWorkspaceId(e.target.value)}
            />
            <p className="text-xs text-text-muted mt-1">
              Encuéntralo en Publer → Settings → Access & Login → API Keys
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSavePubler} isLoading={isSavingPubler} className="flex-1">
              Guardar Publer
            </Button>
            {hasPubler && (
              <Button onClick={handleTestPubler} isLoading={isTestingPubler} variant="secondary">
                Probar Conexión
              </Button>
            )}
          </div>

          <a
            href="https://app.publer.com/settings"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
          >
            Configurar Publer API Key <ExternalLink className="w-3 h-3" />
          </a>
        </CardContent>
      </Card>

      {/* Meta Ads IA */}
      <div className="mt-8 mb-4">
        <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent" />
          Meta Ads IA
        </h2>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            Meta Ads + Claude IA
            {hasMetaAds && (
              <span className="flex items-center gap-1 text-xs text-success ml-auto">
                <Check className="w-3 h-3" />
                Configurado
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Gestiona tus campañas de Meta Ads con inteligencia artificial conversacional
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Meta Access Token *</label>
            <Input
              type={showKeys ? "text" : "password"}
              placeholder="Tu token de acceso de Meta"
              value={metaAccessToken.value}
              onChange={(e) => setMetaAccessToken(prev => ({ ...prev, value: e.target.value }))}
            />
            <p className="text-xs text-text-muted mt-1">
              Genéralo en developers.facebook.com → Tu App → Graph API Explorer
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Anthropic API Key (Claude) *</label>
            <Input
              type={showKeys ? "text" : "password"}
              placeholder="sk-ant-..."
              value={anthropicApiKey.value}
              onChange={(e) => setAnthropicApiKey(prev => ({ ...prev, value: e.target.value }))}
            />
            <p className="text-xs text-text-muted mt-1">
              Consíguela en console.anthropic.com → API Keys
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSaveMetaAds} isLoading={isSavingMeta} className="flex-1">
              Guardar Meta Ads IA
            </Button>
          </div>
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
              <span className="text-teal-500">•</span>
              <span><strong>WaveSpeed</strong> - Backup de video e imagen si KIE falla</span>
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
              <span className="text-orange-500">•</span>
              <span><strong>Cloudflare R2</strong> - Almacena imagenes y videos en tu propio bucket</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-500">•</span>
              <span><strong>Publer</strong> - Publica en 13 redes sociales directamente</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-500">•</span>
              <span><strong>Meta Ads IA</strong> - Gestiona campañas de Meta Ads con Claude IA</span>
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
