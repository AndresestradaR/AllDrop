'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Loader2,
  Clock,
  Video,
  UserCircle,
  Share2,
  ChevronDown,
  ChevronUp,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Settings,
  Zap,
  RefreshCw,
  AlertCircle,
  Package,
  Wand2,
} from 'lucide-react'
import toast from 'react-hot-toast'

// =============================================
// TYPES
// =============================================
interface Influencer {
  id: string
  name: string
  image_url?: string
  realistic_image_url?: string
  prompt_descriptor?: string
}

interface PubAccount {
  id: string
  name: string
  provider: string
  picture?: string
}

interface AutomationFlow {
  id: string
  name: string
  influencer_id: string
  influencer?: Influencer
  video_preset: 'producto' | 'rapido' | 'premium'
  product_name: string
  product_image_url?: string
  product_benefits: string
  system_prompt: string
  scenarios: string[]
  voice_style: 'paisa' | 'latina' | 'rola' | 'costena' | 'personalizada'
  voice_custom_instruction: string
  schedule_times: string[]
  account_ids: string[]
  mode: 'auto' | 'semi'
  is_active: boolean
  last_run_at?: string
  next_run_at?: string
  created_at: string
}

interface AutomationRun {
  id: string
  flow_id: string
  scenario_used: string
  prompt_generated: string
  video_task_id?: string
  video_url?: string
  video_model?: string
  caption: string
  status: string
  error_message?: string
  started_at: string
  completed_at?: string
  published_at?: string
  created_at: string
}

const PRESET_CONFIG = {
  producto: { emoji: '🎯', label: 'Producto', model: 'Sora 2', color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  rapido: { emoji: '⚡', label: 'Rapido', model: 'Veo 3 Fast', color: 'text-blue-400', bg: 'bg-blue-500/15' },
  premium: { emoji: '💎', label: 'Premium', model: 'Kling 3.0', color: 'text-purple-400', bg: 'bg-purple-500/15' },
}

const VOICE_OPTIONS = [
  { id: 'paisa', label: '🇨🇴 Paisa (Medellin)', short: 'Paisa' },
  { id: 'latina', label: '🌎 Latina neutral', short: 'Latina' },
  { id: 'rola', label: '🏙️ Rola (Bogota)', short: 'Rola' },
  { id: 'costena', label: '🏖️ Costena (Caribe)', short: 'Costena' },
  { id: 'personalizada', label: '✏️ Personalizada', short: 'Custom' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pendiente', color: 'text-text-muted', icon: Clock },
  generating_prompt: { label: 'Generando prompt', color: 'text-blue-400', icon: Wand2 },
  generating_video: { label: 'Generando video', color: 'text-amber-400', icon: Loader2 },
  video_ready: { label: 'Video listo', color: 'text-green-400', icon: Video },
  awaiting_approval: { label: 'Esperando aprobacion', color: 'text-orange-400', icon: Eye },
  publishing: { label: 'Publicando', color: 'text-blue-400', icon: Share2 },
  published: { label: 'Publicado', color: 'text-green-400', icon: Check },
  failed: { label: 'Error', color: 'text-red-400', icon: AlertCircle },
  rejected: { label: 'Rechazado', color: 'text-text-muted', icon: ThumbsDown },
}

const DEFAULT_SYSTEM_PROMPT = 'Eres un director creativo de contenido UGC para redes sociales en Colombia. Genera ideas de escenas cortas para videos de producto, variando escenarios, acciones y emociones. Siempre en español con tono natural latino.'

const DEFAULT_SCENARIOS = [
  'Mostrando el producto en la cocina de su casa, hablando casual a camara',
  'En un cafe, sacando el producto del bolso y recomendandolo a una amiga',
  'Frente al espejo del bano, haciendo su rutina y usando el producto',
  'En el parque, sentada en una banca, contando su experiencia con el producto',
  'En la oficina, en su escritorio, mostrando el producto a camara',
]

// =============================================
// MAIN COMPONENT
// =============================================
interface AutoPublisherToolProps {
  onBack: () => void
}

export function AutoPublisherTool({ onBack }: AutoPublisherToolProps) {
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'runs'>('list')
  const [flows, setFlows] = useState<AutomationFlow[]>([])
  const [runs, setRuns] = useState<AutomationRun[]>([])
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [pubAccounts, setPubAccounts] = useState<PubAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingFlow, setEditingFlow] = useState<AutomationFlow | null>(null)
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null)

  // =============================================
  // DATA LOADING
  // =============================================
  const loadFlows = useCallback(async () => {
    try {
      const res = await fetch('/api/studio/automations')
      const data = await res.json()
      if (data.flows) setFlows(data.flows)
    } catch (err) {
      console.error('Error loading flows:', err)
    }
  }, [])

  const loadInfluencers = useCallback(async () => {
    try {
      const res = await fetch('/api/studio/influencer')
      const data = await res.json()
      if (data.influencers) setInfluencers(data.influencers)
    } catch (err) {
      console.error('Error loading influencers:', err)
    }
  }, [])

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/publer/accounts')
      const data = await res.json()
      if (data.accounts) {
        const active = data.accounts.filter((a: any) => !a.locked && a.permissions?.can_access !== false)
        setPubAccounts(active)
      }
    } catch (err) {
      console.error('Error loading accounts:', err)
    }
  }, [])

  const loadRuns = useCallback(async (flowId?: string) => {
    try {
      const url = flowId
        ? `/api/studio/automations/runs?flowId=${flowId}&limit=30`
        : '/api/studio/automations/runs?status=awaiting_approval,video_ready,generating_video&limit=20'
      const res = await fetch(url)
      const data = await res.json()
      if (data.runs) setRuns(data.runs)
    } catch (err) {
      console.error('Error loading runs:', err)
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      await Promise.all([loadFlows(), loadInfluencers(), loadAccounts()])
      await loadRuns()
      setIsLoading(false)
    }
    load()
  }, [loadFlows, loadInfluencers, loadAccounts, loadRuns])

  // =============================================
  // ACTIONS
  // =============================================
  const handleToggleActive = async (flow: AutomationFlow) => {
    try {
      const res = await fetch('/api/studio/automations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: flow.id, is_active: !flow.is_active }),
      })
      if (res.ok) {
        setFlows(prev => prev.map(f =>
          f.id === flow.id ? { ...f, is_active: !f.is_active } : f
        ))
        toast.success(flow.is_active ? 'Automatizacion pausada' : 'Automatizacion activada')
      }
    } catch {
      toast.error('Error al cambiar estado')
    }
  }

  const handleDeleteFlow = async (flowId: string) => {
    if (!confirm('¿Eliminar esta automatizacion?')) return
    try {
      const res = await fetch(`/api/studio/automations?id=${flowId}`, { method: 'DELETE' })
      if (res.ok) {
        setFlows(prev => prev.filter(f => f.id !== flowId))
        toast.success('Automatizacion eliminada')
      }
    } catch {
      toast.error('Error al eliminar')
    }
  }

  const handleExecuteNow = async (flowId: string) => {
    try {
      toast.loading('Ejecutando flujo...', { id: 'execute-now' })
      const res = await fetch('/api/studio/automations/execute-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Video en generación...', { id: 'execute-now' })
        await loadRuns()
        // Start client-side polling for video completion
        if (data.taskId && data.runId) {
          pollVideoCompletion(data.taskId, data.runId)
        }
      } else {
        toast.error(data.error || 'Error al ejecutar', { id: 'execute-now' })
      }
    } catch {
      toast.error('Error al ejecutar', { id: 'execute-now' })
    }
  }

  const pollVideoCompletion = async (taskId: string, runId: string) => {
    const maxAttempts = 60 // 5 minutes at 5s intervals
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000))
      try {
        const res = await fetch(`/api/studio/video-status?taskId=${taskId}`)
        if (!res.ok) continue
        const data = await res.json()

        if (data.status === 'completed' && data.videoUrl) {
          // Video ready! Update the run
          await fetch('/api/studio/automations/runs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              run_id: runId,
              action: 'complete',
              video_url: data.videoUrl,
            }),
          })
          toast.success('Video generado! Revisa las ejecuciones.', { id: 'video-poll' })
          await loadRuns()
          return
        }

        if (data.status === 'failed') {
          toast.error(`Video falló: ${data.error || 'Error desconocido'}`, { id: 'video-poll' })
          await loadRuns()
          return
        }

        // Still processing — update toast every 15s
        if (i > 0 && i % 3 === 0) {
          toast.loading(`Generando video... ${i * 5}s`, { id: 'video-poll' })
        }
      } catch {
        // Ignore transient polling errors
      }
    }
    toast('Video aún en proceso. El cron lo revisará.', { id: 'video-poll', icon: '⏳' })
  }

  const handleApproveRun = async (runId: string, caption?: string) => {
    try {
      const res = await fetch('/api/studio/automations/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_id: runId, action: 'approve', caption }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Publicado exitosamente')
        await loadRuns()
      } else {
        toast.error(data.error || 'Error')
      }
    } catch {
      toast.error('Error al aprobar')
    }
  }

  const handleRejectRun = async (runId: string) => {
    try {
      await fetch('/api/studio/automations/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_id: runId, action: 'reject' }),
      })
      toast.success('Rechazado')
      await loadRuns()
    } catch {
      toast.error('Error al rechazar')
    }
  }

  // =============================================
  // RENDER
  // =============================================
  if (view === 'create' || view === 'edit') {
    return (
      <FlowEditor
        flow={editingFlow}
        influencers={influencers}
        pubAccounts={pubAccounts}
        onSave={async () => {
          await loadFlows()
          setView('list')
          setEditingFlow(null)
        }}
        onCancel={() => { setView('list'); setEditingFlow(null) }}
      />
    )
  }

  if (view === 'runs' && selectedFlowId) {
    const flow = flows.find(f => f.id === selectedFlowId)
    return (
      <RunsView
        flow={flow || null}
        runs={runs}
        onBack={() => { setView('list'); setSelectedFlowId(null) }}
        onApprove={handleApproveRun}
        onReject={handleRejectRun}
        onRefresh={() => loadRuns(selectedFlowId)}
      />
    )
  }

  // Pending approvals
  const pendingRuns = runs.filter(r => ['awaiting_approval', 'video_ready'].includes(r.status))

  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <div className="bg-surface rounded-2xl border border-border h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-border/50 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-text-secondary" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-orange-500 to-red-500">
                <span className="text-xl">🚀</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Auto Publicar</h2>
                <p className="text-sm text-text-secondary">
                  {flows.length} flujo{flows.length !== 1 ? 's' : ''} · {flows.filter(f => f.is_active).length} activo{flows.filter(f => f.is_active).length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => { setEditingFlow(null); setView('create') }}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-background rounded-xl text-sm font-semibold transition-all shadow-lg shadow-accent/25"
          >
            <Plus className="w-4 h-4" />
            Nuevo flujo
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pending Approvals */}
              {pendingRuns.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5" />
                    Esperando aprobacion ({pendingRuns.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingRuns.map(run => (
                      <PendingRunCard
                        key={run.id}
                        run={run}
                        flow={flows.find(f => f.id === run.flow_id)}
                        onApprove={handleApproveRun}
                        onReject={handleRejectRun}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Flows List */}
              <div>
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
                  Automatizaciones
                </h3>

                {flows.length === 0 ? (
                  <div className="text-center py-12">
                    <Zap className="w-12 h-12 text-text-muted mx-auto mb-3" />
                    <p className="text-text-secondary font-medium mb-1">No hay automatizaciones</p>
                    <p className="text-sm text-text-muted mb-4">Crea tu primer flujo para publicar videos automaticamente</p>
                    <button
                      onClick={() => { setEditingFlow(null); setView('create') }}
                      className="px-4 py-2 bg-accent/10 text-accent rounded-xl text-sm font-medium hover:bg-accent/20 transition-colors"
                    >
                      Crear automatizacion
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {flows.map(flow => (
                      <FlowCard
                        key={flow.id}
                        flow={flow}
                        onToggle={() => handleToggleActive(flow)}
                        onEdit={() => { setEditingFlow(flow); setView('edit') }}
                        onDelete={() => handleDeleteFlow(flow.id)}
                        onExecuteNow={() => handleExecuteNow(flow.id)}
                        onViewRuns={() => {
                          setSelectedFlowId(flow.id)
                          loadRuns(flow.id)
                          setView('runs')
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================
// FLOW CARD
// =============================================
function FlowCard({
  flow,
  onToggle,
  onEdit,
  onDelete,
  onExecuteNow,
  onViewRuns,
}: {
  flow: AutomationFlow
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onExecuteNow: () => void
  onViewRuns: () => void
}) {
  const preset = PRESET_CONFIG[flow.video_preset]
  const voice = VOICE_OPTIONS.find(v => v.id === flow.voice_style)
  const influencer = flow.influencer

  return (
    <div className={cn(
      'p-4 rounded-xl border transition-all',
      flow.is_active
        ? 'bg-accent/5 border-accent/20'
        : 'bg-surface-elevated border-border'
    )}>
      <div className="flex items-start gap-3">
        {/* Influencer avatar */}
        <div className="flex-shrink-0">
          {influencer?.realistic_image_url || influencer?.image_url ? (
            <img
              src={influencer.realistic_image_url || influencer.image_url}
              alt={influencer.name}
              className="w-12 h-12 rounded-lg object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-border/50 flex items-center justify-center">
              <UserCircle className="w-6 h-6 text-text-muted" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-text-primary truncate">{flow.name}</h4>
            {flow.is_active && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-green-500/15 text-green-400 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                Activo
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
            <span className="flex items-center gap-1">
              <UserCircle className="w-3 h-3" />
              {influencer?.name || 'Sin influencer'}
            </span>
            <span>·</span>
            <span className={cn('flex items-center gap-1', preset.color)}>
              {preset.emoji} {preset.label}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3" />
              {flow.product_name}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {(flow.schedule_times || []).map(t => {
                const [h] = t.split(':')
                const hour = parseInt(h)
                return hour >= 12 ? `${hour === 12 ? 12 : hour - 12}pm` : `${hour === 0 ? 12 : hour}am`
              }).join(', ')}
            </span>
            <span>·</span>
            <span>{voice?.short || flow.voice_style}</span>
            <span>·</span>
            <span>{flow.mode === 'auto' ? '🤖 Auto' : '👀 Semi'}</span>
            <span>·</span>
            <span>{flow.scenarios?.length || 0} escenarios</span>
          </div>

          {flow.last_run_at && (
            <p className="text-[10px] text-text-muted mt-1">
              Ultima ejecucion: {new Date(flow.last_run_at).toLocaleString('es-CO')}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onExecuteNow}
            className="p-2 hover:bg-accent/10 rounded-lg transition-colors text-accent"
            title="Ejecutar ahora"
          >
            <Zap className="w-4 h-4" />
          </button>
          <button
            onClick={onViewRuns}
            className="p-2 hover:bg-border/50 rounded-lg transition-colors text-text-muted hover:text-text-primary"
            title="Ver historial"
          >
            <Clock className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            className="p-2 hover:bg-border/50 rounded-lg transition-colors text-text-muted hover:text-text-primary"
            title="Editar"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-text-muted hover:text-red-400"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Toggle */}
          <button
            onClick={onToggle}
            className={cn(
              'relative w-10 h-6 rounded-full transition-colors ml-1',
              flow.is_active ? 'bg-accent' : 'bg-border'
            )}
          >
            <span className={cn(
              'absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow',
              flow.is_active && 'translate-x-4'
            )} />
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================
// PENDING RUN CARD
// =============================================
function PendingRunCard({
  run,
  flow,
  onApprove,
  onReject,
}: {
  run: AutomationRun
  flow?: AutomationFlow | null
  onApprove: (runId: string, caption?: string) => void
  onReject: (runId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [caption, setCaption] = useState(run.caption || '')

  return (
    <div className="p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
      <div className="flex items-center gap-3">
        {run.video_url && (
          <video
            src={run.video_url}
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
            muted
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">
            {flow?.name || 'Automatizacion'}
          </p>
          <p className="text-[11px] text-text-muted truncate">{run.scenario_used}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 hover:bg-border/50 rounded-lg text-text-muted"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onReject(run.id)}
            className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
          >
            <ThumbsDown className="w-4 h-4" />
          </button>
          <button
            onClick={() => onApprove(run.id, caption)}
            className="p-2 bg-green-500/10 hover:bg-green-500/20 rounded-lg text-green-400 transition-colors"
          >
            <ThumbsUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          {run.video_url && (
            <video src={run.video_url} controls className="w-full rounded-lg max-h-[300px]" />
          )}
          <div>
            <label className="block text-[10px] font-semibold text-text-muted uppercase mb-1">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
          <p className="text-[10px] text-text-muted">
            Escenario: {run.scenario_used} · Modelo: {run.video_model}
          </p>
        </div>
      )}
    </div>
  )
}

// =============================================
// RUNS VIEW
// =============================================
function RunsView({
  flow,
  runs,
  onBack,
  onApprove,
  onReject,
  onRefresh,
}: {
  flow: AutomationFlow | null
  runs: AutomationRun[]
  onBack: () => void
  onApprove: (runId: string, caption?: string) => void
  onReject: (runId: string) => void
  onRefresh: () => void
}) {
  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <div className="bg-surface rounded-2xl border border-border h-full flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-border/50 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-text-secondary" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                {flow?.name || 'Historial'}
              </h2>
              <p className="text-sm text-text-secondary">{runs.length} ejecuciones</p>
            </div>
          </div>
          <button onClick={onRefresh} className="p-2 hover:bg-border/50 rounded-lg text-text-muted">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {runs.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary">No hay ejecuciones aun</p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.map(run => {
                const statusConf = STATUS_CONFIG[run.status] || STATUS_CONFIG.pending
                const StatusIcon = statusConf.icon

                return (
                  <div key={run.id} className="p-3 bg-surface-elevated rounded-xl border border-border">
                    <div className="flex items-center gap-3">
                      {run.video_url ? (
                        <video src={run.video_url} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" muted />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-border/50 flex items-center justify-center flex-shrink-0">
                          <Video className="w-5 h-5 text-text-muted" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">{run.scenario_used}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn('flex items-center gap-1 text-[11px]', statusConf.color)}>
                            <StatusIcon className={cn('w-3 h-3', run.status === 'generating_video' && 'animate-spin')} />
                            {statusConf.label}
                          </span>
                          <span className="text-[10px] text-text-muted">
                            {new Date(run.created_at).toLocaleString('es-CO')}
                          </span>
                        </div>
                        {run.error_message && (
                          <p className="text-[10px] text-red-400 mt-0.5 truncate">{run.error_message}</p>
                        )}
                      </div>

                      {['awaiting_approval', 'video_ready'].includes(run.status) && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => onReject(run.id)}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onApprove(run.id)}
                            className="p-1.5 bg-green-500/10 hover:bg-green-500/20 rounded-lg text-green-400"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================
// FLOW EDITOR (Create/Edit)
// =============================================
function FlowEditor({
  flow,
  influencers,
  pubAccounts,
  onSave,
  onCancel,
}: {
  flow: AutomationFlow | null
  influencers: Influencer[]
  pubAccounts: PubAccount[]
  onSave: () => void
  onCancel: () => void
}) {
  const isEditing = !!flow

  const [name, setName] = useState(flow?.name || '')
  const [influencerId, setInfluencerId] = useState(flow?.influencer_id || '')
  const [videoPreset, setVideoPreset] = useState<'producto' | 'rapido' | 'premium'>(flow?.video_preset || 'rapido')
  const [productName, setProductName] = useState(flow?.product_name || '')
  const [productImageUrl, setProductImageUrl] = useState(flow?.product_image_url || '')
  const [productBenefits, setProductBenefits] = useState(flow?.product_benefits || '')
  const [systemPrompt, setSystemPrompt] = useState(flow?.system_prompt || DEFAULT_SYSTEM_PROMPT)
  const [scenarios, setScenarios] = useState<string[]>(flow?.scenarios || DEFAULT_SCENARIOS)
  const [newScenario, setNewScenario] = useState('')
  const [voiceStyle, setVoiceStyle] = useState(flow?.voice_style || 'paisa')
  const [voiceCustom, setVoiceCustom] = useState(flow?.voice_custom_instruction || '')
  const [scheduleTimes, setScheduleTimes] = useState<string[]>(flow?.schedule_times || ['08:00', '20:00'])
  const [newTime, setNewTime] = useState('12:00')
  const [accountIds, setAccountIds] = useState<string[]>(flow?.account_ids || [])
  const [mode, setMode] = useState<'auto' | 'semi'>(flow?.mode || 'semi')
  const [isSaving, setIsSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleSave = async () => {
    if (!influencerId || !productName.trim()) {
      toast.error('Selecciona un influencer y escribe el nombre del producto')
      return
    }

    setIsSaving(true)
    try {
      const body: any = {
        name: name.trim() || `Auto - ${productName}`,
        influencer_id: influencerId,
        video_preset: videoPreset,
        product_name: productName.trim(),
        product_image_url: productImageUrl || null,
        product_benefits: productBenefits.trim(),
        system_prompt: systemPrompt.trim(),
        scenarios: scenarios.filter(s => s.trim()),
        voice_style: voiceStyle,
        voice_custom_instruction: voiceCustom.trim(),
        schedule_times: scheduleTimes,
        account_ids: accountIds,
        mode,
      }

      if (isEditing) {
        body.id = flow!.id
      }

      const res = await fetch('/api/studio/automations', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        toast.success(isEditing ? 'Flujo actualizado' : 'Flujo creado')
        onSave()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al guardar')
      }
    } catch {
      toast.error('Error al guardar')
    } finally {
      setIsSaving(false)
    }
  }

  const addScenario = () => {
    if (newScenario.trim()) {
      setScenarios(prev => [...prev, newScenario.trim()])
      setNewScenario('')
    }
  }

  const removeScenario = (index: number) => {
    setScenarios(prev => prev.filter((_, i) => i !== index))
  }

  const toggleAccount = (id: string) => {
    setAccountIds(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    )
  }

  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      <div className="bg-surface rounded-2xl border border-border h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <button onClick={onCancel} className="p-2 hover:bg-border/50 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-text-secondary" />
            </button>
            <h2 className="text-lg font-semibold text-text-primary">
              {isEditing ? 'Editar automatizacion' : 'Nueva automatizacion'}
            </h2>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-5">

            {/* Nombre */}
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                Nombre del flujo
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Ritual de Belleza - Serum"
                className="w-full px-4 py-2.5 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>

            {/* Influencer */}
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                Influencer *
              </label>
              {influencers.length === 0 ? (
                <p className="text-sm text-text-muted">No tienes influencers. Crea uno primero en "Mi Influencer".</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {influencers.map(inf => (
                    <button
                      key={inf.id}
                      onClick={() => setInfluencerId(inf.id)}
                      className={cn(
                        'p-2 rounded-xl border text-center transition-all',
                        influencerId === inf.id
                          ? 'border-accent bg-accent/10'
                          : 'border-border bg-surface-elevated hover:border-accent/30'
                      )}
                    >
                      {(inf.realistic_image_url || inf.image_url) ? (
                        <img src={inf.realistic_image_url || inf.image_url} alt={inf.name} className="w-12 h-12 mx-auto rounded-lg object-cover mb-1" />
                      ) : (
                        <div className="w-12 h-12 mx-auto rounded-lg bg-border/50 flex items-center justify-center mb-1">
                          <UserCircle className="w-6 h-6 text-text-muted" />
                        </div>
                      )}
                      <p className="text-[11px] font-medium text-text-primary truncate">{inf.name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Preset de video */}
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                Tipo de video
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(PRESET_CONFIG) as [string, typeof PRESET_CONFIG['producto']][]).map(([id, config]) => (
                  <button
                    key={id}
                    onClick={() => setVideoPreset(id as any)}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all',
                      videoPreset === id
                        ? `${config.bg} border-2 border-current ${config.color}`
                        : 'bg-surface-elevated border-border hover:border-text-muted'
                    )}
                  >
                    <div className="text-lg mb-0.5">{config.emoji}</div>
                    <p className="text-xs font-semibold">{config.label}</p>
                    <p className="text-[10px] text-text-muted">{config.model}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Producto */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                  Producto *
                </label>
                <input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Serum Vitamina C"
                  className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                  URL imagen producto
                </label>
                <input
                  value={productImageUrl}
                  onChange={(e) => setProductImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                Beneficios del producto
              </label>
              <input
                value={productBenefits}
                onChange={(e) => setProductBenefits(e.target.value)}
                placeholder="Reduce arrugas, hidrata profundamente, ingredientes naturales..."
                className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>

            {/* Voz */}
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                Acento / Voz
              </label>
              <div className="flex flex-wrap gap-1.5">
                {VOICE_OPTIONS.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setVoiceStyle(v.id as any)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                      voiceStyle === v.id
                        ? 'bg-accent/15 border-accent text-accent'
                        : 'bg-surface-elevated border-border text-text-secondary hover:border-text-muted'
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              {voiceStyle === 'personalizada' && (
                <textarea
                  value={voiceCustom}
                  onChange={(e) => setVoiceCustom(e.target.value)}
                  placeholder="Describe el estilo de voz que quieres..."
                  rows={2}
                  className="w-full mt-2 px-3 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              )}
            </div>

            {/* Escenarios */}
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                Escenarios ({scenarios.length})
              </label>
              <p className="text-[10px] text-text-muted mb-2">
                Se elige uno aleatorio en cada ejecucion
              </p>
              <div className="space-y-1.5 mb-2 max-h-40 overflow-y-auto">
                {scenarios.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-surface-elevated rounded-lg">
                    <p className="flex-1 text-xs text-text-primary">{s}</p>
                    <button
                      onClick={() => removeScenario(i)}
                      className="p-1 hover:bg-red-500/10 rounded text-text-muted hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newScenario}
                  onChange={(e) => setNewScenario(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addScenario()}
                  placeholder="Nuevo escenario..."
                  className="flex-1 px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <button
                  onClick={addScenario}
                  disabled={!newScenario.trim()}
                  className="px-3 py-2 bg-accent/10 text-accent rounded-lg text-sm font-medium hover:bg-accent/20 disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Horarios de publicacion */}
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                Horarios de publicacion (hora Colombia)
              </label>
              <p className="text-[10px] text-text-muted mb-2">
                Se publica automaticamente a las horas seleccionadas
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {scheduleTimes
                  .sort((a, b) => a.localeCompare(b))
                  .map(time => {
                    const [h, m] = time.split(':')
                    const hour = parseInt(h)
                    const label = `${hour > 12 ? hour - 12 : hour === 0 ? 12 : hour}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
                    return (
                      <span
                        key={time}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/15 border border-accent text-accent"
                      >
                        <Clock className="w-3 h-3" />
                        {label}
                        <button
                          onClick={() => setScheduleTimes(prev => prev.filter(t => t !== time))}
                          className="hover:text-red-400 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )
                  })}
              </div>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <button
                  onClick={() => {
                    if (newTime && !scheduleTimes.includes(newTime)) {
                      setScheduleTimes(prev => [...prev, newTime])
                    }
                  }}
                  disabled={!newTime || scheduleTimes.includes(newTime)}
                  className="px-3 py-2 bg-accent/10 text-accent rounded-lg text-sm font-medium hover:bg-accent/20 disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modo */}
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                Modo
              </label>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setMode('semi')}
                  className={cn(
                    'flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    mode === 'semi'
                      ? 'bg-accent/15 border-accent text-accent'
                      : 'bg-surface-elevated border-border text-text-secondary'
                  )}
                >
                  👀 Semi-auto
                </button>
                <button
                  onClick={() => setMode('auto')}
                  className={cn(
                    'flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    mode === 'auto'
                      ? 'bg-accent/15 border-accent text-accent'
                      : 'bg-surface-elevated border-border text-text-secondary'
                  )}
                >
                  🤖 Automatico
                </button>
              </div>
            </div>

            {/* Cuentas destino */}
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                Cuentas destino
              </label>
              {pubAccounts.length === 0 ? (
                <p className="text-xs text-text-muted">No hay cuentas de Publer conectadas. Configuralas en Settings.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {pubAccounts.map(acc => {
                    const isSelected = accountIds.includes(acc.id)
                    return (
                      <button
                        key={acc.id}
                        onClick={() => toggleAccount(acc.id)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all',
                          isSelected
                            ? 'bg-accent/15 border-accent text-accent'
                            : 'bg-surface-elevated border-border text-text-secondary hover:border-text-muted'
                        )}
                      >
                        {acc.picture ? (
                          <img src={acc.picture} alt="" className="w-5 h-5 rounded object-cover" />
                        ) : (
                          <Share2 className="w-3.5 h-3.5" />
                        )}
                        {acc.name}
                        {isSelected && <Check className="w-3 h-3" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Advanced: System prompt */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Configuracion avanzada
                {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showAdvanced && (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5">
                    System Prompt (IA para generar prompts de video)
                  </label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-xl text-sm text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 border border-border rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-elevated transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !influencerId || !productName.trim()}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all',
              isSaving || !influencerId || !productName.trim()
                ? 'bg-border text-text-secondary cursor-not-allowed'
                : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25'
            )}
          >
            {isSaving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
            ) : (
              <><Check className="w-4 h-4" /> {isEditing ? 'Guardar cambios' : 'Crear flujo'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
