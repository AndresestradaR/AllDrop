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
const PROVIDER_CONFIG: Record&lt;string, { label: string; color: string; emoji: string }&gt; = {
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
  /** Public URL to the media (preferred if available) */
  mediaUrl?: string
  /** Base64 encoded media (will be uploaded to get URL) */
  mediaBase64?: string
  /** MIME type of the media */
  mediaContentType?: string
  /** Type of content: photo, video, or status */
  contentType: 'photo' | 'video' | 'status'
  /** Suggested caption text */
  defaultCaption?: string
  /** Preview URL for thumbnail (can be data: URL for base64) */
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
  const [accounts, setAccounts] = useState&lt;PublerAccount[]&gt;([])
  const [selectedAccountIds, setSelectedAccountIds] = useState&lt;string[]&gt;([])
  const [caption, setCaption] = useState(defaultCaption)
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false)
  const [step, setStep] = useState&lt;PublishStep&gt;('select')
  const [errorMessage, setErrorMessage] = useState('')
  const [accountsError, setAccountsError] = useState('')

  // Fetch accounts when modal opens
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

      // Publer API returns accounts without a "status" field.
      // Filter by: not locked AND has access permission.
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

      // Build scheduled datetime
      let scheduledAt: string | undefined
      if (isScheduled && scheduledDate && scheduledTime) {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
      }

      // Send everything to publish route - it handles media URL/base64 directly
      const publishBody: Record&lt;string, any&gt; = {
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

      // Close after 1.5s
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
    &lt;div className="fixed inset-0 z-50 flex items-center justify-center"&gt;
      {/* Backdrop */}
      &lt;div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} /&gt;

      {/* Modal */}
      &lt;div className="relative w-full max-w-lg mx-4 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden"&gt;
        {/* Header */}
        &lt;div className="flex items-center justify-between px-6 py-4 border-b border-border"&gt;
          &lt;div className="flex items-center gap-3"&gt;
            &lt;div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500 text-white"&gt;
              &lt;Share2 className="w-4 h-4" /&gt;
            &lt;/div&gt;
            &lt;h3 className="text-lg font-semibold text-text-primary"&gt;Publicar en Redes&lt;/h3&gt;
          &lt;/div&gt;
          &lt;button
            onClick={onClose}
            className="p-2 hover:bg-border/50 rounded-lg transition-colors"
          &gt;
            &lt;X className="w-5 h-5 text-text-secondary" /&gt;
          &lt;/button&gt;
        &lt;/div&gt;

        &lt;div className="px-6 py-4 max-h-[70vh] overflow-y-auto"&gt;
          {/* Step: Select accounts */}
          {step === 'select' && (
            &lt;div className="space-y-4"&gt;
              {/* Media Preview */}
              {previewUrl && (
                &lt;div className="flex items-center gap-3 p-3 bg-surface-elevated rounded-xl"&gt;
                  {contentType === 'video' ? (
                    &lt;div className="w-16 h-16 rounded-lg bg-border flex items-center justify-center"&gt;
                      &lt;Video className="w-6 h-6 text-text-secondary" /&gt;
                    &lt;/div&gt;
                  ) : (
                    &lt;img
                      src={previewUrl}
                      alt="Preview"
                      className="w-16 h-16 object-cover rounded-lg"
                    /&gt;
                  )}
                  &lt;div&gt;
                    &lt;p className="text-sm font-medium text-text-primary flex items-center gap-1"&gt;
                      &lt;ContentIcon className="w-4 h-4" /&gt;
                      {contentType === 'video' ? 'Video' : contentType === 'status' ? 'Texto' : 'Imagen'}
                    &lt;/p&gt;
                    &lt;p className="text-xs text-text-secondary"&gt;Listo para publicar&lt;/p&gt;
                  &lt;/div&gt;
                &lt;/div&gt;
              )}

              {/* Caption */}
              &lt;div&gt;
                &lt;label className="block text-sm font-medium text-text-secondary mb-1.5"&gt;
                  Caption / Texto
                &lt;/label&gt;
                &lt;textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Escribe el texto de tu publicación..."
                  rows={3}
                  className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-xl text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
                /&gt;
              &lt;/div&gt;

              {/* Accounts */}
              &lt;div&gt;
                &lt;div className="flex items-center justify-between mb-2"&gt;
                  &lt;label className="text-sm font-medium text-text-secondary"&gt;
                    Cuentas destino
                  &lt;/label&gt;
                  {accounts.length > 0 && (
                    &lt;button
                      onClick={selectAll}
                      className="text-xs text-accent hover:text-accent-hover transition-colors"
                    &gt;
                      {selectedAccountIds.length === accounts.length
                        ? 'Deseleccionar todo'
                        : 'Seleccionar todo'}
                    &lt;/button&gt;
                  )}
                &lt;/div&gt;

                {isLoadingAccounts ? (
                  &lt;div className="flex items-center justify-center py-8"&gt;
                    &lt;Loader2 className="w-6 h-6 animate-spin text-accent" /&gt;
                    &lt;span className="ml-2 text-sm text-text-secondary"&gt;Cargando cuentas...&lt;/span&gt;
                  &lt;/div&gt;
                ) : accountsError ? (
                  &lt;div className="text-center py-6"&gt;
                    &lt;AlertCircle className="w-8 h-8 text-error mx-auto mb-2" /&gt;
                    &lt;p className="text-sm text-error mb-2"&gt;{accountsError}&lt;/p&gt;
                    &lt;a
                      href="/dashboard/settings"
                      className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover"
                    &gt;
                      &lt;Settings className="w-3 h-3" /&gt;
                      Configurar Publer en Settings
                    &lt;/a&gt;
                  &lt;/div&gt;
                ) : accounts.length === 0 ? (
                  &lt;div className="text-center py-6"&gt;
                    &lt;p className="text-sm text-text-secondary mb-2"&gt;
                      No hay cuentas sociales conectadas
                    &lt;/p&gt;
                    &lt;a
                      href="https://app.publer.com/settings"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:text-accent-hover"
                    &gt;
                      Conectar cuentas en Publer -&amp;gt;
                    &lt;/a&gt;
                  &lt;/div&gt;
                ) : (
                  &lt;div className="space-y-1.5 max-h-48 overflow-y-auto"&gt;
                    {accounts.map((account) => {
                      const config = PROVIDER_CONFIG[account.provider] || {
                        label: account.provider,
                        color: 'bg-gray-500',
                        emoji: '🌐',
                      }
                      const isSelected = selectedAccountIds.includes(account.id)

                      return (
                        &lt;button
                          key={account.id}
                          onClick={() => toggleAccount(account.id)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
                            isSelected
                              ? 'bg-accent/10 border border-accent/30'
                              : 'bg-surface-elevated border border-transparent hover:border-border'
                          )}
                        &gt;
                          {/* Provider icon */}
                          &lt;div
                            className={cn(
                              'w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm',
                              config.color
                            )}
                          &gt;
                            {account.picture ? (
                              &lt;img
                                src={account.picture}
                                alt=""
                                className="w-8 h-8 rounded-lg object-cover"
                              /&gt;
                            ) : (
                              &lt;span&gt;{config.emoji}&lt;/span&gt;
                            )}
                          &lt;/div&gt;

                          &lt;div className="flex-1 text-left"&gt;
                            &lt;p className="text-sm font-medium text-text-primary"&gt;{account.name}&lt;/p&gt;
                            &lt;p className="text-xs text-text-secondary"&gt;{config.label}&lt;/p&gt;
                          &lt;/div&gt;

                          {/* Checkbox */}
                          &lt;div
                            className={cn(
                              'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors',
                              isSelected
                                ? 'bg-accent border-accent'
                                : 'border-border'
                            )}
                          &gt;
                            {isSelected && &lt;Check className="w-3 h-3 text-white" /&gt;}
                          &lt;/div&gt;
                        &lt;/button&gt;
                      )
                    })}
                  &lt;/div&gt;
                )}
              &lt;/div&gt;

              {/* Schedule toggle */}
              &lt;div&gt;
                &lt;button
                  onClick={() => setIsScheduled(!isScheduled)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm',
                    isScheduled
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                  )}
                &gt;
                  &lt;Calendar className="w-4 h-4" /&gt;
                  {isScheduled ? 'Publicación agendada' : 'Agendar para después'}
                &lt;/button&gt;

                {isScheduled && (
                  &lt;div className="flex gap-2 mt-2"&gt;
                    &lt;input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="flex-1 px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                    /&gt;
                    &lt;input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="px-3 py-2 bg-surface-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                    /&gt;
                  &lt;/div&gt;
                )}
              &lt;/div&gt;
            &lt;/div&gt;
          )}

          {/* Step: Publishing */}
          {step === 'publishing' && (
            &lt;div className="flex flex-col items-center justify-center py-12"&gt;
              &lt;Loader2 className="w-10 h-10 animate-spin text-accent mb-4" /&gt;
              &lt;p className="text-text-primary font-medium"&gt;
                {isScheduled ? 'Agendando publicación...' : 'Publicando...'}
              &lt;/p&gt;
              &lt;p className="text-sm text-text-secondary mt-1"&gt;
                Subiendo media y enviando a {selectedAccountIds.length} cuenta{selectedAccountIds.length > 1 ? 's' : ''}
              &lt;/p&gt;
            &lt;/div&gt;
          )}

          {/* Step: Done */}
          {step === 'done' && (
            &lt;div className="flex flex-col items-center justify-center py-12"&gt;
              &lt;div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4"&gt;
                &lt;Check className="w-8 h-8 text-green-500" /&gt;
              &lt;/div&gt;
              &lt;p className="text-text-primary font-medium"&gt;
                {isScheduled ? '¡Publicación agendada!' : '¡Publicado exitosamente!'}
              &lt;/p&gt;
              &lt;p className="text-sm text-text-secondary mt-1"&gt;
                {selectedAccountIds.length} cuenta{selectedAccountIds.length > 1 ? 's' : ''}
              &lt;/p&gt;
            &lt;/div&gt;
          )}

          {/* Step: Error */}
          {step === 'error' && (
            &lt;div className="flex flex-col items-center justify-center py-12"&gt;
              &lt;div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4"&gt;
                &lt;AlertCircle className="w-8 h-8 text-red-500" /&gt;
              &lt;/div&gt;
              &lt;p className="text-text-primary font-medium"&gt;Error al publicar&lt;/p&gt;
              &lt;p className="text-sm text-error mt-1"&gt;{errorMessage}&lt;/p&gt;
              &lt;button
                onClick={() => setStep('select')}
                className="mt-4 px-4 py-2 text-sm bg-surface-elevated border border-border rounded-lg hover:bg-border/50 transition-colors text-text-primary"
              &gt;
                Reintentar
              &lt;/button&gt;
            &lt;/div&gt;
          )}
        &lt;/div&gt;

        {/* Footer - only show on select step */}
        {step === 'select' && (
          &lt;div className="px-6 py-4 border-t border-border flex gap-3"&gt;
            &lt;button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-elevated transition-colors"
            &gt;
              Cancelar
            &lt;/button&gt;
            &lt;button
              onClick={handlePublish}
              disabled={selectedAccountIds.length === 0}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
                selectedAccountIds.length === 0
                  ? 'bg-border text-text-secondary cursor-not-allowed'
                  : 'bg-accent hover:bg-accent-hover text-background shadow-lg shadow-accent/25'
              )}
            &gt;
              &lt;Send className="w-4 h-4" /&gt;
              {isScheduled ? 'Agendar' : 'Publicar ahora'}
            &lt;/button&gt;
          &lt;/div&gt;
        )}
      &lt;/div&gt;
    &lt;/div&gt;
  )
}
