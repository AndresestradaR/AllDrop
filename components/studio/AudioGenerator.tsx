'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils/cn'
import {
  AudioLines,
  ChevronDown,
  Sparkles,
  Loader2,
  Download,
  Check,
  Mic,
  Play,
  Pause,
  RotateCcw,
  Settings2,
  Zap,
  Globe,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'

type AudioProviderId = 'elevenlabs' | 'google-tts'
type AudioModelId = 'eleven_multilingual_v2' | 'eleven_flash_v2_5' | 'eleven_turbo_v2_5'

interface Voice {
  id: string
  name: string
  description?: string
  previewUrl?: string
  gender?: 'male' | 'female' | 'neutral'
  accent?: string
  category?: string
  provider: AudioProviderId
  labels?: Record<string, string>
}

interface GeneratedAudio {
  id: string
  url: string
  text: string
  voiceName: string
  model: string
  provider: string
  timestamp: Date
  duration?: number
  charactersUsed: number
}

interface VoiceSettings {
  stability: number
  similarityBoost: number
  style: number
  speed: number
}

// Provider configurations
const PROVIDERS = {
  elevenlabs: {
    name: 'ElevenLabs',
    description: 'Voces ultra realistas con IA',
    icon: '🎙️',
    color: 'from-purple-500/20 to-purple-500/5',
    borderColor: 'border-purple-500/20',
  },
  'google-tts': {
    name: 'Gemini TTS',
    description: 'Voces IA de Google (misma API key)',
    icon: '✨',
    color: 'from-blue-500/20 to-blue-500/5',
    borderColor: 'border-blue-500/20',
  },
}

// ElevenLabs model configurations
const ELEVENLABS_MODELS: Record<AudioModelId, { name: string; description: string; costLabel: string; latency: string }> = {
  'eleven_multilingual_v2': {
    name: 'Multilingual v2',
    description: 'Maxima calidad, 32 idiomas',
    costLabel: '1 credito/char',
    latency: '~500ms',
  },
  'eleven_flash_v2_5': {
    name: 'Flash v2.5',
    description: 'Ultra rapido, tiempo real',
    costLabel: '0.5 creditos/char',
    latency: '~75ms',
  },
  'eleven_turbo_v2_5': {
    name: 'Turbo v2.5',
    description: 'Balance calidad/velocidad',
    costLabel: '0.5 creditos/char',
    latency: '~200ms',
  },
}

export function AudioGenerator() {
  const { t } = useI18n()
  const sa = t.studio.aud
  // Provider selection
  const [selectedProvider, setSelectedProvider] = useState<AudioProviderId>('elevenlabs')
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false)

  // Voice selection
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null)
  const [voices, setVoices] = useState<Voice[]>([])
  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false)
  const [isLoadingVoices, setIsLoadingVoices] = useState(true)
  const [voiceSearch, setVoiceSearch] = useState('')
  const [voicesError, setVoicesError] = useState<string | null>(null)

  // Model selection (ElevenLabs only)
  const [selectedModel, setSelectedModel] = useState<AudioModelId>('eleven_multilingual_v2')
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)

  // Generation options
  const [text, setText] = useState('')
  const [settings, setSettings] = useState<VoiceSettings>({
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0,
    speed: 1,
  })
  const [showAdvanced, setShowAdvanced] = useState(false)

  // State
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedAudios, setGeneratedAudios] = useState<GeneratedAudio[]>([])
  const [error, setError] = useState<string | null>(null)

  // Audio player
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})

  // Load voices when provider changes
  useEffect(() => {
    loadVoices()
  }, [selectedProvider])

  const loadVoices = async () => {
    setIsLoadingVoices(true)
    setVoicesError(null)
    setSelectedVoice(null)
    try {
      const response = await fetch(`/api/studio/voices?provider=${selectedProvider}`)
      const data = await response.json()
      if (data.success && data.voices?.length > 0) {
        setVoices(data.voices)
        setSelectedVoice(data.voices[0])
      } else if (data.error) {
        setVoicesError(data.error)
      } else {
        setVoicesError('No se encontraron voces. Configura la API key del proveedor.')
      }
    } catch (err) {
      console.error('Error loading voices:', err)
      setVoicesError('Error al cargar voces. Verifica tu conexion.')
    } finally {
      setIsLoadingVoices(false)
    }
  }

  const handleGenerate = async () => {
    if (!text.trim() || !selectedVoice) return

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/studio/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceId: selectedVoice.id,
          modelId: selectedProvider === 'elevenlabs' ? selectedModel : undefined,
          provider: selectedProvider,
          languageCode: 'es',
          settings: {
            stability: settings.stability,
            similarityBoost: settings.similarityBoost,
            style: settings.style,
            speed: settings.speed,
          },
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al generar audio')
      }

      const newAudio: GeneratedAudio = {
        id: Date.now().toString(),
        url: data.audioUrl || `data:${data.contentType || 'audio/mpeg'};base64,${data.audioBase64}`,
        text,
        voiceName: selectedVoice.name,
        model: selectedProvider === 'elevenlabs' 
          ? ELEVENLABS_MODELS[selectedModel].name 
          : 'Gemini TTS',
        provider: selectedProvider,
        timestamp: new Date(),
        charactersUsed: data.charactersUsed || text.length,
      }

      setGeneratedAudios((prev) => [newAudio, ...prev])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const togglePlayPause = (audioId: string) => {
    const audio = audioRefs.current[audioId]
    if (!audio) return

    if (playingId === audioId) {
      audio.pause()
      setPlayingId(null)
    } else {
      Object.values(audioRefs.current).forEach((a) => a.pause())
      audio.play()
      setPlayingId(audioId)
    }
  }

  const handleAudioEnded = (audioId: string) => {
    if (playingId === audioId) {
      setPlayingId(null)
    }
  }

  const filteredVoices = voices.filter((v) =>
    v.name.toLowerCase().includes(voiceSearch.toLowerCase()) ||
    v.description?.toLowerCase().includes(voiceSearch.toLowerCase()) ||
    v.accent?.toLowerCase().includes(voiceSearch.toLowerCase())
  )

  const characterCount = text.length
  const maxCharacters = 5000

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)] min-h-[600px]">
      {/* Left Panel - Controls */}
      <div className="w-[420px] flex-shrink-0 bg-surface rounded-2xl border border-border p-5 overflow-y-auto">
        <div className="space-y-5">
          {/* Provider Selector */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {sa.provider}
            </label>
            <div className="relative">
              <button
                onClick={() => setIsProviderDropdownOpen(!isProviderDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-surface-elevated border border-border rounded-xl hover:border-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br text-xl',
                    PROVIDERS[selectedProvider].color,
                    PROVIDERS[selectedProvider].borderColor,
                    'border'
                  )}>
                    {PROVIDERS[selectedProvider].icon}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-text-primary">
                      {PROVIDERS[selectedProvider].name}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {PROVIDERS[selectedProvider].description}
                    </p>
                  </div>
                </div>
                <ChevronDown className={cn(
                  'w-5 h-5 text-text-secondary transition-transform',
                  isProviderDropdownOpen && 'rotate-180'
                )} />
              </button>

              {isProviderDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-surface-elevated border border-border rounded-xl shadow-xl z-50 p-2">
                  {(Object.entries(PROVIDERS) as [AudioProviderId, typeof PROVIDERS['elevenlabs']][]).map(
                    ([id, provider]) => (
                      <button
                        key={id}
                        onClick={() => {
                          setSelectedProvider(id)
                          setIsProviderDropdownOpen(false)
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                          selectedProvider === id
                            ? 'bg-accent/10 text-accent'
                            : 'hover:bg-border/50 text-text-primary'
                        )}
                      >
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br text-lg',
                          provider.color
                        )}>
                          {provider.icon}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium">{provider.name}</p>
                          <p className="text-xs text-text-secondary">{provider.description}</p>
                        </div>
                        {selectedProvider === id && <Check className="w-4 h-4 text-accent" />}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Model Selector (ElevenLabs only) */}
          {selectedProvider === 'elevenlabs' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                {sa.model}
              </label>
              <div className="relative">
                <button
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-surface-elevated border border-border rounded-xl hover:border-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20">
                      <AudioLines className="w-5 h-5 text-accent" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-text-primary">
                        {ELEVENLABS_MODELS[selectedModel].name}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {ELEVENLABS_MODELS[selectedModel].latency} · {ELEVENLABS_MODELS[selectedModel].costLabel}
                      </p>
                    </div>
                  </div>
                  <ChevronDown className={cn(
                    'w-5 h-5 text-text-secondary transition-transform',
                    isModelDropdownOpen && 'rotate-180'
                  )} />
                </button>

                {isModelDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-surface-elevated border border-border rounded-xl shadow-xl z-50 p-2">
                    {(Object.entries(ELEVENLABS_MODELS) as [AudioModelId, typeof ELEVENLABS_MODELS[AudioModelId]][]).map(
                      ([id, model]) => (
                        <button
                          key={id}
                          onClick={() => {
                            setSelectedModel(id)
                            setIsModelDropdownOpen(false)
                          }}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                            selectedModel === id
                              ? 'bg-accent/10 text-accent'
                              : 'hover:bg-border/50 text-text-primary'
                          )}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-accent/20 to-accent/5">
                            {id === 'eleven_flash_v2_5' ? (
                              <Zap className="w-4 h-4 text-accent" />
                            ) : (
                              <AudioLines className="w-4 h-4 text-accent" />
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-medium">{model.name}</p>
                            <p className="text-xs text-text-secondary">{model.description}</p>
                          </div>
                          {selectedModel === id && <Check className="w-4 h-4 text-accent" />}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Voice Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-text-secondary">
                {sa.voice} {selectedProvider === 'google-tts' ? 'Gemini' : 'ElevenLabs'}
              </label>
              <button
                onClick={loadVoices}
                disabled={isLoadingVoices}
                className="text-xs text-text-secondary hover:text-accent flex items-center gap-1"
              >
                <RefreshCw className={cn('w-3 h-3', isLoadingVoices && 'animate-spin')} />
                {sa.reload}
              </button>
            </div>
            <div className="relative">
              {isLoadingVoices ? (
                <div className="w-full flex items-center justify-center px-4 py-3 bg-surface-elevated border border-border rounded-xl">
                  <Loader2 className="w-5 h-5 animate-spin text-accent mr-2" />
                  <span className="text-sm text-text-secondary">{sa.loadingVoices}</span>
                </div>
              ) : voicesError ? (
                <div className="w-full px-4 py-3 bg-surface-elevated border border-error/30 rounded-xl">
                  <div className="flex items-center gap-2 text-error">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">{voicesError}</span>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setIsVoiceDropdownOpen(!isVoiceDropdownOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-surface-elevated border border-border rounded-xl hover:border-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center',
                        selectedVoice?.gender === 'female' 
                          ? 'bg-pink-500/20 border border-pink-500/30'
                          : 'bg-blue-500/20 border border-blue-500/30'
                      )}>
                        <Mic className={cn(
                          'w-5 h-5',
                          selectedVoice?.gender === 'female' ? 'text-pink-400' : 'text-blue-400'
                        )} />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-text-primary">{selectedVoice?.name || 'Selecciona voz'}</p>
                        <p className="text-xs text-text-secondary">
                          {selectedVoice?.gender === 'female' ? 'Femenina' : 'Masculina'}
                          {selectedVoice?.description && ` · ${selectedVoice.description}`}
                        </p>
                      </div>
                    </div>
                    <ChevronDown className={cn(
                      'w-5 h-5 text-text-secondary transition-transform',
                      isVoiceDropdownOpen && 'rotate-180'
                    )} />
                  </button>

                  {isVoiceDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-surface-elevated border border-border rounded-xl shadow-xl z-50 max-h-[300px] overflow-hidden flex flex-col">
                      <div className="p-2 border-b border-border">
                        <input
                          type="text"
                          placeholder={sa.searchVoice}
                          value={voiceSearch}
                          onChange={(e) => setVoiceSearch(e.target.value)}
                          className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                        />
                      </div>
                      <div className="p-2 overflow-y-auto">
                        {filteredVoices.length === 0 ? (
                          <p className="text-sm text-text-secondary text-center py-4">
                            No se encontraron voces
                          </p>
                        ) : (
                          filteredVoices.map((voice) => (
                            <button
                              key={voice.id}
                              onClick={() => {
                                setSelectedVoice(voice)
                                setIsVoiceDropdownOpen(false)
                                setVoiceSearch('')
                              }}
                              className={cn(
                                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                                selectedVoice?.id === voice.id
                                  ? 'bg-accent/10 text-accent'
                                  : 'hover:bg-border/50 text-text-primary'
                              )}
                            >
                              <div className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center',
                                voice.gender === 'female'
                                  ? 'bg-pink-500/20'
                                  : 'bg-blue-500/20'
                              )}>
                                <Mic className={cn(
                                  'w-4 h-4',
                                  voice.gender === 'female' ? 'text-pink-400' : 'text-blue-400'
                                )} />
                              </div>
                              <div className="flex-1 text-left">
                                <p className="text-sm font-medium">{voice.name}</p>
                                <p className="text-xs text-text-secondary line-clamp-1">
                                  {voice.description}
                                </p>
                              </div>
                              {selectedVoice?.id === voice.id && (
                                <Check className="w-4 h-4 text-accent" />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Language Badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-green-500/10 text-green-400 border border-green-500/20">
              <Globe className="w-3 h-3" /> Espanol
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-surface-elevated text-text-secondary border border-border">
              {PROVIDERS[selectedProvider].icon} {PROVIDERS[selectedProvider].name}
            </span>
            {selectedProvider === 'google-tts' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20">
                💰 Gratis (API key AI Studio)
              </span>
            )}
          </div>

          {/* Text Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-text-secondary">
                {sa.text}
              </label>
              <span className={cn(
                'text-xs',
                characterCount > maxCharacters ? 'text-error' : 'text-text-muted'
              )}>
                {characterCount.toLocaleString()} / {maxCharacters.toLocaleString()}
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={sa.textPh}
              rows={6}
              className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
            />
          </div>

          {/* Advanced Settings Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            {sa.advConfig}
            <ChevronDown className={cn(
              'w-4 h-4 transition-transform',
              showAdvanced && 'rotate-180'
            )} />
          </button>

          {/* Advanced Settings */}
          {showAdvanced && selectedProvider === 'elevenlabs' && (
            <div className="space-y-4 p-4 bg-surface-elevated rounded-xl border border-border">
              {/* Speed */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-text-secondary">
                    {sa.speed}
                  </label>
                  <span className="text-xs text-text-muted">
                    {settings.speed.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={settings.speed}
                  onChange={(e) => setSettings({ ...settings, speed: parseFloat(e.target.value) })}
                  className="w-full accent-accent"
                />
              </div>

              {/* Stability */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-text-secondary">
                    {sa.stability}
                  </label>
                  <span className="text-xs text-text-muted">
                    {Math.round(settings.stability * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.stability}
                  onChange={(e) => setSettings({ ...settings, stability: parseFloat(e.target.value) })}
                  className="w-full accent-accent"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  Mayor = mas consistente, Menor = mas expresivo
                </p>
              </div>

              {/* Similarity */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-text-secondary">
                    {sa.similarity}
                  </label>
                  <span className="text-xs text-text-muted">
                    {Math.round(settings.similarityBoost * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.similarityBoost}
                  onChange={(e) => setSettings({ ...settings, similarityBoost: parseFloat(e.target.value) })}
                  className="w-full accent-accent"
                />
              </div>

              <button
                onClick={() => setSettings({ stability: 0.5, similarityBoost: 0.75, style: 0.5, speed: 1 })}
                className="flex items-center gap-2 text-xs text-text-secondary hover:text-accent transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                {sa.reset}
              </button>
            </div>
          )}

          {/* Gemini info */}
          {showAdvanced && selectedProvider === 'google-tts' && (
            <div className="p-4 bg-surface-elevated rounded-xl border border-border">
              <p className="text-xs text-text-secondary">
                Gemini TTS usa la misma API key de Google AI Studio. Las voces son multilingues y se adaptan automaticamente al idioma del texto.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-xl">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !text.trim() || !selectedVoice || characterCount > maxCharacters}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all duration-200',
              isGenerating || !text.trim() || !selectedVoice || characterCount > maxCharacters
                ? 'bg-border text-text-secondary cursor-not-allowed'
                : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25 hover:shadow-accent/40'
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {sa.generating}
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                {sa.generate}
              </>
            )}
          </button>

          {/* Cost estimate */}
          {text.length > 0 && (
            <p className="text-xs text-center text-text-muted">
              {selectedProvider === 'elevenlabs' 
                ? `~${selectedModel === 'eleven_multilingual_v2' ? text.length : Math.ceil(text.length / 2)} creditos ElevenLabs`
                : 'Incluido en tu cuota de Gemini API'
              }
            </p>
          )}
        </div>
      </div>

      {/* Right Panel - Gallery */}
      <div className="flex-1 bg-surface rounded-2xl border border-border p-5 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">
            {sa.generatedAudios} ({generatedAudios.length})
          </h3>
        </div>

        {generatedAudios.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-border/50 flex items-center justify-center">
                <AudioLines className="w-8 h-8 text-text-secondary" />
              </div>
              <p className="text-text-secondary">
                {sa.emptyGallery}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3">
            {generatedAudios.map((audio) => (
              <div
                key={audio.id}
                className="p-4 bg-surface-elevated rounded-xl border border-border hover:border-accent/30 transition-colors"
              >
                <audio
                  ref={(el) => { if (el) audioRefs.current[audio.id] = el }}
                  src={audio.url}
                  onEnded={() => handleAudioEnded(audio.id)}
                  preload="metadata"
                />

                <div className="flex items-start gap-4">
                  <button
                    onClick={() => togglePlayPause(audio.id)}
                    className={cn(
                      'w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center transition-all',
                      playingId === audio.id
                        ? 'bg-accent text-background'
                        : 'bg-accent/10 text-accent hover:bg-accent/20'
                    )}
                  >
                    {playingId === audio.id ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5 ml-0.5" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary line-clamp-2 mb-1">
                      {audio.text}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <Mic className="w-3 h-3" />
                        {audio.voiceName}
                      </span>
                      <span>·</span>
                      <span>{audio.model}</span>
                      <span>·</span>
                      <span>{audio.charactersUsed} chars</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const a = document.createElement('a')
                      a.href = audio.url
                      a.download = `audio-${audio.id}.mp3`
                      a.click()
                    }}
                    className="p-2 rounded-lg hover:bg-border/50 text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-3 h-8 bg-border/30 rounded-lg flex items-center justify-center overflow-hidden">
                  <div className="flex items-end gap-0.5 h-6">
                    {Array.from({ length: 50 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'w-1 rounded-full transition-all',
                          playingId === audio.id ? 'bg-accent' : 'bg-text-muted/30'
                        )}
                        style={{
                          height: `${Math.random() * 100}%`,
                          animationDelay: `${i * 50}ms`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
