'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  ArrowLeft,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface FaqItem {
  question: string
  answer: string
}

interface ObjectionHandler {
  objection: string
  response: string
}

interface BotResult {
  system_prompt: string
  welcome_message: string
  faq_responses: FaqItem[]
  closing_script: string
  objection_handlers: ObjectionHandler[]
}

const TONES = [
  { id: 'amigable', label: 'Amigable' },
  { id: 'profesional', label: 'Profesional' },
  { id: 'casual', label: 'Casual' },
  { id: 'persuasivo', label: 'Persuasivo' },
]

const PLATFORMS = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'instagram', label: 'Instagram DM' },
  { id: 'messenger', label: 'Messenger' },
  { id: 'web', label: 'Chat Web' },
]

const COUNTRIES = [
  'Colombia', 'Mexico', 'Guatemala', 'Peru', 'Chile',
  'Ecuador', 'Paraguay', 'Panama', 'Costa Rica', 'Argentina',
]

export function PromptBotGenerator({ onBack }: { onBack: () => void }) {
  const [productName, setProductName] = useState('')
  const [productBenefits, setProductBenefits] = useState('')
  const [productPrice, setProductPrice] = useState('')
  const [currency, setCurrency] = useState('COP')
  const [commonObjections, setCommonObjections] = useState('')
  const [tone, setTone] = useState('amigable')
  const [platform, setPlatform] = useState('whatsapp')
  const [country, setCountry] = useState('Colombia')
  const [businessName, setBusinessName] = useState('')
  const [shippingInfo, setShippingInfo] = useState('')

  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<BotResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [expandedObjection, setExpandedObjection] = useState<number | null>(null)

  const handleGenerate = async () => {
    if (!productName.trim()) return

    setIsGenerating(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/studio/prompt-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: productName,
          product_benefits: productBenefits || undefined,
          product_price: productPrice || undefined,
          currency,
          common_objections: commonObjections || undefined,
          tone,
          bot_platform: platform,
          country,
          business_name: businessName || undefined,
          shipping_info: shippingInfo || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al generar prompt')
      }

      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async (text: string, fieldId: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(fieldId)
    toast.success('Copiado')
    setTimeout(() => setCopiedField(null), 2000)
  }

  const copyAll = async () => {
    if (!result) return
    const text = [
      '=== SYSTEM PROMPT ===',
      result.system_prompt,
      '',
      '=== MENSAJE DE BIENVENIDA ===',
      result.welcome_message,
      '',
      '=== FAQ ===',
      ...result.faq_responses.map(f => `P: ${f.question}\nR: ${f.answer}`),
      '',
      '=== SCRIPT DE CIERRE ===',
      result.closing_script,
      '',
      '=== MANEJO DE OBJECIONES ===',
      ...result.objection_handlers.map(o => `Objecion: ${o.objection}\nRespuesta: ${o.response}`),
    ].join('\n')
    await copyToClipboard(text, 'all')
  }

  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <div className="bg-surface rounded-2xl border border-border h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-border">
          <button onClick={onBack} className="p-2 hover:bg-border/50 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-green-500 to-emerald-500">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Prompt Generator Bots</h2>
              <p className="text-sm text-text-secondary">Genera system prompts para bots de ventas</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 flex gap-6 overflow-hidden">
          {/* Input Section */}
          <div className="w-[380px] flex-shrink-0 flex flex-col gap-3 overflow-y-auto pr-2">
            {/* Product Name */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Producto *</label>
              <input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ej: Serum Vitamina C"
                className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
              />
            </div>

            {/* Business Name */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Nombre del negocio</label>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ej: BellezaCO"
                className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
              />
            </div>

            {/* Benefits */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Beneficios principales</label>
              <textarea
                value={productBenefits}
                onChange={(e) => setProductBenefits(e.target.value)}
                placeholder="Reduce arrugas, hidrata, ilumina la piel..."
                rows={2}
                className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
              />
            </div>

            {/* Price + Currency */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Precio</label>
                <input
                  value={productPrice}
                  onChange={(e) => setProductPrice(e.target.value)}
                  placeholder="89900"
                  className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
                />
              </div>
              <div className="w-24">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Moneda</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
                >
                  {['COP', 'MXN', 'USD', 'GTQ', 'PEN', 'CLP'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Shipping Info */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Info de envio</label>
              <input
                value={shippingInfo}
                onChange={(e) => setShippingInfo(e.target.value)}
                placeholder="Ej: Envio gratis, contraentrega, 3-5 dias"
                className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
              />
            </div>

            {/* Platform + Country */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Plataforma</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Pais</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tone */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Tono</label>
              <div className="flex gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    className={cn(
                      'flex-1 px-3 py-2 rounded-xl border text-xs font-medium transition-all',
                      tone === t.id
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-surface-elevated text-text-secondary hover:border-accent/50'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Objections */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Objeciones comunes</label>
              <textarea
                value={commonObjections}
                onChange={(e) => setCommonObjections(e.target.value)}
                placeholder="Ej: Es muy caro, no confio en compras online, no me va a funcionar..."
                rows={2}
                className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-error/10 border border-error/20 rounded-xl">
                <p className="text-sm text-error">{error}</p>
              </div>
            )}

            {/* Generate */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !productName.trim()}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all',
                isGenerating || !productName.trim()
                  ? 'bg-border text-text-secondary cursor-not-allowed'
                  : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25'
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generar Prompt Bot
                </>
              )}
            </button>
          </div>

          {/* Output Section */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!result ? (
              <div className="flex-1 flex items-center justify-center bg-surface-elevated rounded-xl">
                <div className="text-center p-8">
                  <MessageSquare className="w-12 h-12 text-text-secondary mx-auto mb-3" />
                  <p className="text-text-secondary">El prompt del bot aparecera aqui</p>
                  <p className="text-xs text-text-muted mt-1">System prompt + mensajes + FAQ + objeciones</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4">
                {/* System Prompt */}
                <div className="p-5 bg-surface-elevated rounded-xl border border-border">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider">System Prompt</span>
                    <button
                      onClick={() => copyToClipboard(result.system_prompt, 'system')}
                      className="p-1.5 rounded-lg hover:bg-border/50 transition-colors"
                    >
                      {copiedField === 'system' ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-text-muted" />
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{result.system_prompt}</p>
                </div>

                {/* Welcome Message */}
                <div className="p-4 bg-surface-elevated rounded-xl border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Mensaje de bienvenida</span>
                    <button
                      onClick={() => copyToClipboard(result.welcome_message, 'welcome')}
                      className="p-1.5 rounded-lg hover:bg-border/50 transition-colors"
                    >
                      {copiedField === 'welcome' ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-text-muted" />
                      )}
                    </button>
                  </div>
                  <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                    <p className="text-sm text-text-primary">{result.welcome_message}</p>
                  </div>
                </div>

                {/* FAQ */}
                {result.faq_responses && result.faq_responses.length > 0 && (
                  <div className="p-4 bg-surface-elevated rounded-xl border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                        FAQ ({result.faq_responses.length})
                      </span>
                      <button
                        onClick={() => copyToClipboard(
                          result.faq_responses.map(f => `P: ${f.question}\nR: ${f.answer}`).join('\n\n'),
                          'faq'
                        )}
                        className="p-1.5 rounded-lg hover:bg-border/50 transition-colors"
                      >
                        {copiedField === 'faq' ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-text-muted" />
                        )}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {result.faq_responses.map((faq, i) => (
                        <div key={i} className="border border-border rounded-lg overflow-hidden">
                          <button
                            onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                            className="w-full flex items-center justify-between p-3 hover:bg-border/30 transition-colors text-left"
                          >
                            <span className="text-sm font-medium text-text-primary">{faq.question}</span>
                            {expandedFaq === i ? (
                              <ChevronUp className="w-4 h-4 text-text-muted flex-shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
                            )}
                          </button>
                          {expandedFaq === i && (
                            <div className="px-3 pb-3">
                              <p className="text-sm text-text-secondary">{faq.answer}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Closing Script */}
                <div className="p-4 bg-surface-elevated rounded-xl border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Script de cierre</span>
                    <button
                      onClick={() => copyToClipboard(result.closing_script, 'closing')}
                      className="p-1.5 rounded-lg hover:bg-border/50 transition-colors"
                    >
                      {copiedField === 'closing' ? (
                        <Check className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-text-muted" />
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-text-primary leading-relaxed">{result.closing_script}</p>
                </div>

                {/* Objection Handlers */}
                {result.objection_handlers && result.objection_handlers.length > 0 && (
                  <div className="p-4 bg-surface-elevated rounded-xl border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                        Manejo de objeciones ({result.objection_handlers.length})
                      </span>
                      <button
                        onClick={() => copyToClipboard(
                          result.objection_handlers.map(o => `Objecion: ${o.objection}\nRespuesta: ${o.response}`).join('\n\n'),
                          'objections'
                        )}
                        className="p-1.5 rounded-lg hover:bg-border/50 transition-colors"
                      >
                        {copiedField === 'objections' ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-text-muted" />
                        )}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {result.objection_handlers.map((obj, i) => (
                        <div key={i} className="border border-border rounded-lg overflow-hidden">
                          <button
                            onClick={() => setExpandedObjection(expandedObjection === i ? null : i)}
                            className="w-full flex items-center justify-between p-3 hover:bg-border/30 transition-colors text-left"
                          >
                            <span className="text-sm font-medium text-red-400">{obj.objection}</span>
                            {expandedObjection === i ? (
                              <ChevronUp className="w-4 h-4 text-text-muted flex-shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
                            )}
                          </button>
                          {expandedObjection === i && (
                            <div className="px-3 pb-3">
                              <p className="text-sm text-text-secondary">{obj.response}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Copy All */}
                <button
                  onClick={copyAll}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-accent/30 text-accent hover:bg-accent/10 font-medium text-sm transition-colors"
                >
                  {copiedField === 'all' ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar todo
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
