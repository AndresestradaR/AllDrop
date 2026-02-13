'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'
import {
  X,
  Share2,
  Check,
  Loader2,
  Calendar,
  Clock,
  Send,
  AlertCircle,
  Settings,
  Image as ImageIcon,
  Video,
  Music,
} from 'lucide-react'
import toast from 'react-hot-toast'

// Provider icons (simple text-based for now)
const PROVIDER_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  facebook: { label: 'Facebook', color: 'bg-blue-600', emoji: '📘' },
  instagram: { label: 'Instagram', color: 'bg-gradient-to-br from-purple-600 to-pink-500', emoji: '📸' },
  twitter: { label: 'X / Twitter', color: 'bg-black', emoji: '𝕏' },
  linkedin: { label: 'LinkedIn', color: 'bg-blue-700', emoji: '💼' },
  tiktok: { label: 'TikTok', color: 'bg-black', emoji: '🎵' },
  youtube: { label: 'YouTube', color: 'bg-red-600', emoji: '▶️' },
  pinterest: { label: 'Pinterest', color: 'bg-red-700', emoji: '📌' },
  threads: { label: 'Threads', color: 'bg-black', emoji: '🧵' },
  telegram: { label: 'Telegram', color: 'bg-sky-500', emoji: '✈️' },
  google: { label: 'Google Business', color: 'bg-green-600', emoji: '🏢' },
  mastodon: { label: 'Mastodon', color: 'bg-purple-600', emoji: '🦣' },
  bluesky: { label: 'Bluesky', color: 'bg-sky-400', emoji: '🦋' },
  wordpress_basic: { label: 'WordPress', color: 'bg-blue-800', emoji: '📝' },
  wordpress_oauth: { label: 'WordPress', color: 'bg-blue-800', emoji: '📝' },
}

interface PublerAccount {
  id: string
  name: string
  provider: string
  type: string
  picture: string
  locked?: boolean
  permissions?: { can_access?: boolean }
}

interface PublisherModalProps {
  isOpen: boolean
  onClose: () => void
  mediaUrl?: string
  mediaBase64?: string
  mediaContentType?: string
  contentType: 'photo' | 'video' | 'status'
  defaultCaption?: string
  previewUrl?: string
}

type PublishStep = 'select' | 'publishing' | 'done' | 'error'

export function PublisherModal({
  isOpen,
  onClose,
  mediaUrl,
  mediaBase64,
  mediaContentType,
  contentType,
  defaultCaption = '',
  previewUrl,
}: PublisherModalProps) {
  const [accounts, setAccounts] = useState<PublerAccount[]>([])
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
  const [caption, setCaption] = useState(defaultCaption)
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false)
  const [step, setStep] = useState<PublishStep>('select')
  const [errorMessage, setErrorMessage] = useState('')
  const [accountsError, setAccountsError] = useState('')

  const fetchAccounts = useCallback(async () => {
    setIsLoadingAccounts(true)
    setAccountsError('')
    try {
      const response = await fetch('/api/publer/accounts')
      const data = await response.json()

      if (!response.ok) {
        setAccountsError(data.error || 'Error cargando cuentas')
        return
      }

      const rawAccounts: PublerAccount[] = data.accounts || []
      const activeAccounts = rawAccounts.filter(
        (a) => !a.locked && a.permissions?.can_access !== false
      )
      setAccounts(activeAccounts)
    } catch (err: any) {
      setAccountsError(err.message || 'Error de conexión')
    } finally {
      setIsLoadingAccounts(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchAccounts()
      setCaption(defaultCaption)
      setStep('select')
      setSelectedAccountIds([])
      setIsScheduled(false)
      setScheduledDate('')
      setScheduledTime('')
      setErrorMessage('')
    }
  }, [isOpen, defaultCaption, fetchAccounts])

  const toggleAccount = (accountId: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
    )
  }

  const selectAll = () => {
    if (selectedAccountIds.length === accounts.length) {
      setSelectedAccountIds([])
    } else {
      setSelectedAccountIds(accounts.map((a) => a.id))
    }
  }

  const handlePublish = async () => {
    if (selectedAccountIds.length === 0) {
      toast.error('Selecciona al menos una cuenta')
      return
    }

    if (!mediaUrl && !mediaBase64 && contentType !== 'status') {
      toast.error('No hay media para publicar')
      return
    }

    try {
      setStep('publishing')

      let scheduledAt: string | undefined
      if (isScheduled && scheduledDate && scheduledTime) {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
      }

      // Send everything directly to publish route (no separate upload step)
      const publishBody: Record<string, any> = {
        accountIds: selectedAccountIds,
        text: caption,
        contentType,
      }

      if (mediaUrl) {
        publishBody.mediaUrl = mediaUrl
      } else if (mediaBase64) {
        publishBody.mediaBase64 = mediaBase64
        publishBody.mediaContentType = mediaContentType || 'image/png'
      }

      if (scheduledAt) {
        publishBody.scheduledAt = scheduledAt
      }

      const publishResponse = await fetch('/api/publer/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(publishBody),
      })

      const publishData = await publishResponse.json()

      if (!publishResponse.ok || publishData.success === false) {
        throw new Error(publishData.error || 'Error publicando')
      }

      setStep('done')
      toast.success(
        isScheduled
          ? `Post agendado para ${selectedAccountIds.length} cuenta${selectedAccountIds.length > 1 ? 's' : ''}`
          : `Publicado en ${selectedAccountIds.length} cuenta${selectedAccountIds.length > 1 ? 's' : ''}`
      )

      setTimeout(() => onClose(), 1500)
    } catch (err: any) {
      console.error('[Publisher] Error:', err)
      setStep('error')
      setErrorMessage(err.message || 'Error al publicar')
    }
  }

  if (!isOpen) return null

  const ContentIcon = contentType === 'video' ? Video : contentType === 'status' ? Send : ImageIcon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg mx-4 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500 text-white">
              <Share2 className="w-4 h-4" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary">Publicar en Redes</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-border/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {step === 'select' && (
            <div className="space-y-4">
              {previewUrl && (
                <div className="flex items-center gap-3 p-3 bg-surface-elevated rounded-xl">
                  {contentType === 'video' ? (
                    <div className="w-16 h-16 rounded-lg bg-border flex items-center justify-center">
                      <Video className="w-6 h-6 text-text-secondary" />
                    </div>
                  ) : (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium text-text-primary flex items-center gap-1">
                      <ContentIcon className="w-4 h-4" />
                      {contentType === 'video' ? 'Video' : contentType === 'status' ? 'Texto' : 'Imagen'}
                    </p>
                    <p className="text-xs text-text-secondary">Listo para publicar</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Caption / Texto
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Escribe el texto de tu publicación..."
                  rows={3}
                  className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-text-secondary">
                    Cuentas destino
                  </label>
                  {accounts.length > 0 && (
                    <button
                      onClick={selectAll}
                      className="text-xs text-accent hover:text-accent-hover transition-colors"
                    >
                      {selectedAccountIds.length === accounts.length
                        ? 'Deseleccionar todo'
                        : 'Seleccionar todo'}
                    </button>
                  )}
                </div>

                {isLoadingAccounts ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-accent" />
                    <span className="ml-2 text-sm text-text-secondary">Cargando cuentas...</span>
                  </div>
                ) : accountsError ? (
                  <div className="text-center py-6">
                    <AlertCircle className="w-8 h-8 text-error mx-auto mb-2" />
                    <p className="text-sm text-error mb-2">{accountsError}</p>
                    <a
                      href="/dashboard/settings"
                      className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
                    >
                      <Settings className="w-3 h-3" />
                      Configurar Publer en Settings
                    </a>
                  </div>
                ) : accounts.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-text-secondary mb-2">
                      No hay cuentas sociales conectadas
                    </p>
                    <a
                      href="https://app.publer.com/settings"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:text-accent-hover"
                    >
                      Conectar cuentas en Publer
                    </a>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {accounts.map((account) => {
                      const config = PROVIDER_CONFIG[account.provider] || {
                        label: account.provider,
                        color: 'bg-gray-500',
                        emoji: '🌐',
                      }
                      const isSelected = selectedAccountIds.includes(account.id)

                      return (
                        <button
                          key={account.id}
                          onClick={() => toggleAccount(account.id)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
                            isSelected
                              ? 'bg-accent/10 border border-accent/30'
                              : 'bg-surface-elevated border border-transparent hover:border-border'
                          )}
                        >
                          <div
                            className={cn(
                              'w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm',
                              config.color
                            )}
                          >
                            {account.picture ? (
                              <img
                                src={account.picture}
                                alt=""
                                className="w-8 h-8 rounded-lg object-cover"
                              />
                            ) : (
                              <span>{config.emoji}</span>
                            )}
                          </div>

                          <div className="flex-1 text-left">
                            <p className="text-sm font-medium text-text-primary">{account.name}</p>
                            <p className="text-xs text-text-secondary">{config.label}</p>
                          </div>

                          <div
                            className={cn(
                              'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors',
                              isSelected
                                ? 'bg-accent border-accent'
                                : 'border-border'
                            )}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div>
                <button
                  onClick={() => setIsScheduled(!isScheduled)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm',
                    isScheduled
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                  )}
                >
                  <Calendar className="w-4 h-4" />
                  {isScheduled ? 'Publicación agendada' : 'Agendar para después'}
                </button>

                {isScheduled && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="flex-1 px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'publishing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-10 h-10 animate-spin text-accent mb-4" />
              <p className="text-text-primary font-medium">
                {isScheduled ? 'Agendando publicación...' : 'Publicando...'}
              </p>
              <p className="text-sm text-text-secondary mt-1">
                Subiendo media y enviando a {selectedAccountIds.length} cuenta{selectedAccountIds.length > 1 ? 's' : ''}
              </p>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-text-primary font-medium">
                {isScheduled ? '¡Publicación agendada!' : '¡Publicado exitosamente!'}
              </p>
              <p className="text-sm text-text-secondary mt-1">
                {selectedAccountIds.length} cuenta{selectedAccountIds.length > 1 ? 's' : ''}
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-text-primary font-medium">Error al publicar</p>
              <p className="text-sm text-error mt-1">{errorMessage}</p>
              <button
                onClick={() => setStep('select')}
                className="mt-4 px-4 py-2 text-sm bg-surface-elevated border border-border rounded-lg hover:bg-border/50 transition-colors text-text-primary"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>

        {step === 'select' && (
          <div className="px-6 py-4 border-t border-border flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-elevated transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handlePublish}
              disabled={selectedAccountIds.length === 0}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
                selectedAccountIds.length === 0
                  ? 'bg-border text-text-secondary cursor-not-allowed'
                  : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25'
              )}
            >
              <Send className="w-4 h-4" />
              {isScheduled ? 'Agendar' : 'Publicar ahora'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
