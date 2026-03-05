'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Trash2, Loader2, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'

interface AngleData {
  id: string
  name: string
  hook: string
  description: string
  avatarSuggestion: string
  tone: string
  salesAngle: string
}

interface AngleGroup {
  productName: string
  angles: AngleData[]
  createdAt: string
}

interface SavedAnglesPanelProps {
  onSelectAngle?: (angle: AngleData) => void
  selectable?: boolean
  selectedAngleId?: string | null
}

const TONE_COLORS: Record<string, string> = {
  'Emocional': 'bg-pink-500/20 text-pink-400',
  'Racional': 'bg-blue-500/20 text-blue-400',
  'Urgencia': 'bg-red-500/20 text-red-400',
  'Aspiracional': 'bg-purple-500/20 text-purple-400',
  'Social Proof': 'bg-amber-500/20 text-amber-400',
  'Educativo': 'bg-cyan-500/20 text-cyan-400',
  'Cientifico': 'bg-sky-500/20 text-sky-400',
  'Urgente': 'bg-red-500/20 text-red-400',
  'energetic': 'bg-orange-500/20 text-orange-400',
  'professional': 'bg-slate-500/20 text-slate-400',
  'friendly': 'bg-green-500/20 text-green-400',
}

export function SavedAnglesPanel({ onSelectAngle, selectable = false, selectedAngleId }: SavedAnglesPanelProps) {
  const [groups, setGroups] = useState<AngleGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)
  const [expandedAngle, setExpandedAngle] = useState<string | null>(null)
  const [copiedAngleId, setCopiedAngleId] = useState<string | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<string | null>(null)

  const loadAngles = async () => {
    try {
      const res = await fetch('/api/studio/saved-angles')
      const data = await res.json()
      if (data.success) {
        setGroups(data.groups || [])
      }
    } catch {
      // silent fail
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { loadAngles() }, [])

  const handleDeleteProduct = async (productName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (deletingProduct) return

    setDeletingProduct(productName)
    try {
      const res = await fetch(`/api/studio/saved-angles?productName=${encodeURIComponent(productName)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        setGroups(prev => prev.filter(g => g.productName !== productName))
        toast.success('Angulos eliminados')
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch {
      toast.error('Error al eliminar angulos')
    } finally {
      setDeletingProduct(null)
    }
  }

  const handleCopyAngle = (angle: AngleData, e: React.MouseEvent) => {
    e.stopPropagation()
    const text = `${angle.name} (${angle.tone})

Hook: "${angle.hook}"

Angulo de Venta:
${angle.salesAngle}

Descripcion:
${angle.description}

Publico Objetivo: ${angle.avatarSuggestion}`

    navigator.clipboard.writeText(text)
    setCopiedAngleId(angle.id)
    toast.success('Angulo copiado')
    setTimeout(() => setCopiedAngleId(null), 2000)
  }

  const handleAngleClick = (angle: AngleData, e: React.MouseEvent) => {
    if (selectable) {
      onSelectAngle?.(angle)
    } else {
      // Toggle accordion
      setExpandedAngle(prev => prev === angle.id ? null : angle.id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <p className="text-xs text-text-muted text-center py-4">
        No tienes angulos guardados. Genera angulos en el Generador de Banners.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const isExpanded = expandedProduct === group.productName

        return (
          <div key={group.productName} className="border border-[#333] rounded-xl overflow-hidden bg-[#1a1a1a]">
            {/* Product Accordion Header */}
            <button
              onClick={() => setExpandedProduct(isExpanded ? null : group.productName)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#222] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-[#e5e5e5] truncate">{group.productName}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-400 font-medium flex-shrink-0">
                  {group.angles.length}
                </span>
              </div>
              <button
                onClick={(e) => handleDeleteProduct(group.productName, e)}
                disabled={deletingProduct === group.productName}
                className="p-1 hover:bg-red-500/10 rounded-lg text-text-muted hover:text-red-400 transition-colors flex-shrink-0"
              >
                {deletingProduct === group.productName ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
            </button>

            {/* Angles List */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-2">
                {group.angles.map((angle) => {
                  const isSelected = selectable && selectedAngleId === angle.id
                  const isAngleExpanded = expandedAngle === angle.id
                  const toneColor = TONE_COLORS[angle.tone] || 'bg-gray-500/20 text-gray-400'

                  return (
                    <div
                      key={angle.id}
                      className={`rounded-lg border transition-all overflow-hidden ${
                        isSelected
                          ? 'border-teal-500 bg-teal-500/10'
                          : selectable
                            ? 'border-[#333] hover:border-teal-500/40'
                            : 'border-[#333]'
                      }`}
                    >
                      {/* Angle Header — always visible */}
                      <div
                        onClick={(e) => handleAngleClick(angle, e)}
                        className={`flex items-center justify-between px-3 py-2 ${selectable ? 'cursor-pointer' : 'cursor-pointer hover:bg-[#222]'} transition-colors`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {!selectable && (
                            isAngleExpanded
                              ? <ChevronUp className="w-3 h-3 text-text-muted flex-shrink-0" />
                              : <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-[#e5e5e5] truncate">{angle.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${toneColor}`}>
                            {angle.tone}
                          </span>
                          {isSelected && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-500 text-white font-medium ml-auto flex-shrink-0">
                              Seleccionado
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => handleCopyAngle(angle, e)}
                          className="p-1 hover:bg-[#333] rounded-lg text-text-muted hover:text-teal-400 transition-colors flex-shrink-0 ml-1"
                          title="Copiar angulo"
                        >
                          {copiedAngleId === angle.id ? (
                            <Check className="w-3.5 h-3.5 text-teal-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Angle Preview — always visible */}
                      <div className="px-3 pb-2">
                        <p className="text-[11px] text-amber-500/80">&quot;{angle.hook}&quot;</p>
                      </div>

                      {/* Angle Detail — expanded accordion */}
                      {(isAngleExpanded && !selectable) && (
                        <div className="px-3 pb-3 pt-1 border-t border-[#333] space-y-2.5">
                          <div>
                            <span className="text-[9px] font-bold text-teal-400 uppercase tracking-wider">Angulo de Venta</span>
                            <p className="text-[11px] text-[#ccc] mt-0.5 leading-relaxed">{angle.salesAngle}</p>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-teal-400 uppercase tracking-wider">Descripcion</span>
                            <p className="text-[11px] text-[#ccc] mt-0.5 leading-relaxed">{angle.description}</p>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-teal-400 uppercase tracking-wider">Publico Objetivo</span>
                            <p className="text-[11px] text-[#ccc] mt-0.5">{angle.avatarSuggestion}</p>
                          </div>
                        </div>
                      )}

                      {/* Selectable mode: show summary below hook */}
                      {selectable && (
                        <div className="px-3 pb-2">
                          <p className="text-[10px] text-[#999] line-clamp-2">{angle.salesAngle}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
