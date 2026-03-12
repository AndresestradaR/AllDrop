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
  Search,
  Star,
  AlertTriangle,
  ShoppingCart,
  HelpCircle,
  Shield,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ReviewData {
  title: string
  content: string
  rating: number
  verified: boolean
  helpful: number
}

interface AmazonData {
  asin: string
  marketplace: string
  total_reviews: number
  total_amazon_ratings?: number
  avg_rating: string
  rating_distribution: Record<number, number>
  reviews: ReviewData[]
}

interface AnalysisData {
  pain_points: string[]
  sales_angles: string[]
  common_questions: string[]
  objection_handlers: Array<{ objection: string; response: string }>
}

interface BotResult {
  prompt_completo: string
  welcome_message: string
  analysis: AnalysisData
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
  // Product inputs
  const [productName, setProductName] = useState('')
  const [agentName, setAgentName] = useState('')
  const [productBenefits, setProductBenefits] = useState('')
  const [pricingTiers, setPricingTiers] = useState('')
  const [tone, setTone] = useState('amigable')
  const [platform, setPlatform] = useState('whatsapp')
  const [country, setCountry] = useState('Colombia')
  const [businessName, setBusinessName] = useState('')
  const [shippingInfo, setShippingInfo] = useState('')
  const [guarantee, setGuarantee] = useState('')
  const [existingPrompt, setExistingPrompt] = useState('')

  // Amazon
  const [amazonUrl, setAmazonUrl] = useState('')
  const [amazonData, setAmazonData] = useState<AmazonData | null>(null)
  const [isScrapingAmazon, setIsScrapingAmazon] = useState(false)
  const [amazonError, setAmazonError] = useState<string | null>(null)

  // Generation
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<BotResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Collapsibles
  const [showExistingPrompt, setShowExistingPrompt] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  const handleScrapeAmazon = async () => {
    if (!amazonUrl.trim()) return
    setIsScrapingAmazon(true)
    setAmazonError(null)
    setAmazonData(null)

    try {
      const response = await fetch('/api/studio/amazon-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amazon_url: amazonUrl, max_pages: 3 }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al obtener reviews')
      setAmazonData(data)
      toast.success(`${data.total_reviews} reviews encontradas`)
    } catch (err: any) {
      setAmazonError(err.message)
    } finally {
      setIsScrapingAmazon(false)
    }
  }

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
          agent_name: agentName || undefined,
          product_benefits: productBenefits || undefined,
          pricing_tiers: pricingTiers || undefined,
          tone,
          bot_platform: platform,
          country,
          business_name: businessName || undefined,
          shipping_info: shippingInfo || undefined,
          guarantee: guarantee || undefined,
          existing_prompt: existingPrompt || undefined,
          amazon_reviews: amazonData || undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Error al generar prompt')
      setResult(data)
      toast.success('Prompt generado')
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

  const CopyBtn = ({ text, id, size = 14 }: { text: string; id: string; size?: number }) => (
    <button onClick={() => copyToClipboard(text, id)} className="p-1.5 rounded-lg hover:bg-border/50 transition-colors">
      {copiedField === id
        ? <Check style={{ width: size, height: size }} className="text-green-400" />
        : <Copy style={{ width: size, height: size }} className="text-text-muted" />}
    </button>
  )

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
              <h2 className="text-lg font-semibold text-text-primary">Prompt Generator Pro</h2>
              <p className="text-sm text-text-secondary">Genera prompts brutales para bots de ventas con reviews de Amazon</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 flex gap-6 overflow-hidden">
          {/* Input Section */}
          <div className="w-[400px] flex-shrink-0 flex flex-col gap-3 overflow-y-auto pr-2">

            {/* Amazon Reviews Section */}
            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <label className="flex items-center gap-2 text-sm font-medium text-amber-400 mb-2">
                <Search className="w-4 h-4" />
                Reviews de Amazon (opcional)
              </label>
              <div className="flex gap-2">
                <input
                  value={amazonUrl}
                  onChange={(e) => setAmazonUrl(e.target.value)}
                  placeholder="URL de Amazon o ASIN (ej: B0DCCXW835)"
                  className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
                />
                <button
                  onClick={handleScrapeAmazon}
                  disabled={isScrapingAmazon || !amazonUrl.trim()}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0',
                    isScrapingAmazon || !amazonUrl.trim()
                      ? 'bg-border text-text-muted cursor-not-allowed'
                      : 'bg-amber-500 hover:bg-amber-600 text-black'
                  )}
                >
                  {isScrapingAmazon ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
                </button>
              </div>
              {amazonError && <p className="text-xs text-red-400 mt-2">{amazonError}</p>}
              {amazonData && (
                <div className="mt-3 p-3 bg-surface rounded-lg border border-border">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-text-primary font-medium">
                      {amazonData.total_reviews} reviews
                      {amazonData.total_amazon_ratings && amazonData.total_amazon_ratings > amazonData.total_reviews && (
                        <span className="text-text-muted font-normal"> de {amazonData.total_amazon_ratings}</span>
                      )}
                    </span>
                    <span className="flex items-center gap-1 text-amber-400">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {amazonData.avg_rating}/5
                    </span>
                    <span className="text-text-muted text-xs">ASIN: {amazonData.asin}</span>
                  </div>
                  <div className="flex gap-1 mt-2">
                    {[5, 4, 3, 2, 1].map(star => {
                      const count = amazonData.rating_distribution[star] || 0
                      const pct = amazonData.total_reviews > 0 ? (count / amazonData.total_reviews) * 100 : 0
                      return (
                        <div key={star} className="flex-1 text-center">
                          <div className="h-8 bg-border/50 rounded-sm relative overflow-hidden">
                            <div
                              className={cn('absolute bottom-0 w-full rounded-sm', star >= 4 ? 'bg-green-500/60' : star === 3 ? 'bg-amber-500/60' : 'bg-red-500/60')}
                              style={{ height: `${Math.max(pct, 4)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-text-muted">{star}★</span>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-green-400 mt-2">Reviews listas para enriquecer tu prompt</p>
                </div>
              )}
            </div>

            {/* Agent Name + Product */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Nombre del agente *</label>
                <input
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Sofia, Carlos, Mariana..."
                  className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Negocio</label>
                <input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="BellezaCO, TuTienda..."
                  className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
                />
              </div>
            </div>

            {/* Product Name */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Producto *</label>
              <input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Serum Vitamina C, Zapatos Bebe, Faja Colombiana..."
                className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
              />
            </div>

            {/* Benefits */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Beneficios principales</label>
              <textarea
                value={productBenefits}
                onChange={(e) => setProductBenefits(e.target.value)}
                placeholder="Reduce arrugas, hidrata la piel, resultados en 7 dias..."
                rows={2}
                className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
              />
            </div>

            {/* Pricing Tiers */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Precios y ofertas *</label>
              <textarea
                value={pricingTiers}
                onChange={(e) => setPricingTiers(e.target.value)}
                placeholder={"1 unidad: $89.900\n2 unidades: $149.900 (ahorra $29.900)\n3 unidades: $199.900 (ahorra $69.800)"}
                rows={3}
                className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
              />
            </div>

            {/* Shipping + Guarantee */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Envio</label>
                <input
                  value={shippingInfo}
                  onChange={(e) => setShippingInfo(e.target.value)}
                  placeholder="Gratis, contraentrega, 3-5 dias"
                  className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Garantia</label>
                <input
                  value={guarantee}
                  onChange={(e) => setGuarantee(e.target.value)}
                  placeholder="30 dias, satisfaccion..."
                  className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
                />
              </div>
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
                  {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Pais</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
                >
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
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

            {/* Existing Prompt (collapsible) */}
            <div>
              <button
                onClick={() => setShowExistingPrompt(!showExistingPrompt)}
                className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {showExistingPrompt ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Ya tengo un prompt (mejorarlo)
              </button>
              {showExistingPrompt && (
                <textarea
                  value={existingPrompt}
                  onChange={(e) => setExistingPrompt(e.target.value)}
                  placeholder="Pega aqui el prompt que ya tienes en Chatea Pro o Lucid..."
                  rows={4}
                  className="mt-2 w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
                />
              )}
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
                <><Loader2 className="w-5 h-5 animate-spin" />Generando prompt...</>
              ) : (
                <><Sparkles className="w-5 h-5" />Generar Prompt Brutal</>
              )}
            </button>
          </div>

          {/* Output Section */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!result ? (
              <div className="flex-1 flex items-center justify-center bg-surface-elevated rounded-xl">
                <div className="text-center p-8">
                  <MessageSquare className="w-12 h-12 text-text-secondary mx-auto mb-3" />
                  <p className="text-text-secondary">El prompt aparecera aqui</p>
                  <p className="text-xs text-text-muted mt-1">Prompt completo + analisis + bienvenida + objeciones</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4">
                {/* Prompt Completo — THE MAIN OUTPUT */}
                <div className="p-5 bg-surface-elevated rounded-xl border border-accent/30">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-accent uppercase tracking-wider">Prompt Completo — Copiar a Chatea Pro / Lucid</span>
                    <CopyBtn text={result.prompt_completo} id="prompt" />
                  </div>
                  <pre className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap font-sans max-h-[400px] overflow-y-auto">
                    {result.prompt_completo}
                  </pre>
                </div>

                {/* Welcome Message */}
                <div className="p-4 bg-surface-elevated rounded-xl border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Mensaje de bienvenida</span>
                    <CopyBtn text={result.welcome_message} id="welcome" />
                  </div>
                  <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                    <p className="text-sm text-text-primary">{result.welcome_message}</p>
                  </div>
                </div>

                {/* Analysis Section */}
                {result.analysis && (
                  <>
                    {/* Pain Points */}
                    {result.analysis.pain_points?.length > 0 && (
                      <CollapsibleCard
                        icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
                        title="Puntos de dolor"
                        count={result.analysis.pain_points.length}
                        id="pain"
                        expanded={expandedSection}
                        onToggle={setExpandedSection}
                      >
                        <ul className="space-y-1.5">
                          {result.analysis.pain_points.map((p, i) => (
                            <li key={i} className="text-sm text-text-secondary flex gap-2">
                              <span className="text-red-400 flex-shrink-0">•</span>{p}
                            </li>
                          ))}
                        </ul>
                      </CollapsibleCard>
                    )}

                    {/* Sales Angles */}
                    {result.analysis.sales_angles?.length > 0 && (
                      <CollapsibleCard
                        icon={<ShoppingCart className="w-4 h-4 text-green-400" />}
                        title="Angulos de venta"
                        count={result.analysis.sales_angles.length}
                        id="angles"
                        expanded={expandedSection}
                        onToggle={setExpandedSection}
                      >
                        <ul className="space-y-1.5">
                          {result.analysis.sales_angles.map((a, i) => (
                            <li key={i} className="text-sm text-text-secondary flex gap-2">
                              <span className="text-green-400 flex-shrink-0">•</span>{a}
                            </li>
                          ))}
                        </ul>
                      </CollapsibleCard>
                    )}

                    {/* Common Questions */}
                    {result.analysis.common_questions?.length > 0 && (
                      <CollapsibleCard
                        icon={<HelpCircle className="w-4 h-4 text-blue-400" />}
                        title="Preguntas frecuentes"
                        count={result.analysis.common_questions.length}
                        id="questions"
                        expanded={expandedSection}
                        onToggle={setExpandedSection}
                      >
                        <ul className="space-y-1.5">
                          {result.analysis.common_questions.map((q, i) => (
                            <li key={i} className="text-sm text-text-secondary flex gap-2">
                              <span className="text-blue-400 flex-shrink-0">{i + 1}.</span>{q}
                            </li>
                          ))}
                        </ul>
                      </CollapsibleCard>
                    )}

                    {/* Objection Handlers */}
                    {result.analysis.objection_handlers?.length > 0 && (
                      <CollapsibleCard
                        icon={<Shield className="w-4 h-4 text-purple-400" />}
                        title="Manejo de objeciones"
                        count={result.analysis.objection_handlers.length}
                        id="objections"
                        expanded={expandedSection}
                        onToggle={setExpandedSection}
                      >
                        <div className="space-y-3">
                          {result.analysis.objection_handlers.map((obj, i) => (
                            <div key={i} className="p-3 border border-border rounded-lg">
                              <p className="text-sm font-medium text-red-400 mb-1">{obj.objection}</p>
                              <p className="text-sm text-text-secondary">{obj.response}</p>
                            </div>
                          ))}
                        </div>
                      </CollapsibleCard>
                    )}
                  </>
                )}

                {/* Copy All */}
                <button
                  onClick={() => {
                    const fullText = [
                      result.prompt_completo,
                      '',
                      '=== MENSAJE DE BIENVENIDA ===',
                      result.welcome_message,
                    ].join('\n')
                    copyToClipboard(fullText, 'all')
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-accent/30 text-accent hover:bg-accent/10 font-medium text-sm transition-colors"
                >
                  {copiedField === 'all' ? <><Check className="w-4 h-4" />Copiado</> : <><Copy className="w-4 h-4" />Copiar todo</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Collapsible card component
function CollapsibleCard({
  icon,
  title,
  count,
  id,
  expanded,
  onToggle,
  children,
}: {
  icon: React.ReactNode
  title: string
  count: number
  id: string
  expanded: string | null
  onToggle: (id: string | null) => void
  children: React.ReactNode
}) {
  const isOpen = expanded === id
  return (
    <div className="bg-surface-elevated rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => onToggle(isOpen ? null : id)}
        className="w-full flex items-center justify-between p-4 hover:bg-border/20 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-text-primary">{title}</span>
          <span className="text-xs text-text-muted">({count})</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}
