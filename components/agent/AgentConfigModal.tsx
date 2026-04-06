'use client'

import { useState, useEffect } from 'react'
import { X, Bot } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import toast from 'react-hot-toast'

interface AgentConfig {
  id?: string
  agent_name: string
  agent_avatar_url: string | null
  personality: string
  custom_instructions: string | null
}

interface AgentConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: (config: AgentConfig) => void
}

const PERSONALITY_OPTIONS = ['professional', 'friendly', 'casual', 'custom'] as const

export default function AgentConfigModal({ isOpen, onClose, onSaved }: AgentConfigModalProps) {
  const { t } = useI18n()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [agentName, setAgentName] = useState('AllDrop Assistant')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [personality, setPersonality] = useState<string>('professional')
  const [customInstructions, setCustomInstructions] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetch('/api/agent/config')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setAgentName(data.agent_name || 'AllDrop Assistant')
          setAvatarUrl(data.agent_avatar_url || '')
          setPersonality(data.personality || 'professional')
          setCustomInstructions(data.custom_instructions || '')
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isOpen])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/agent/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: agentName.trim() || 'AllDrop Assistant',
          agent_avatar_url: avatarUrl.trim() || null,
          personality,
          custom_instructions: personality === 'custom' ? customInstructions.trim() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      toast.success(t.agent.settingsSaved)
      onSaved(data)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error saving settings')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const personalityDescriptions: Record<string, string> = {
    professional: t.agent.professionalDesc || 'Direct, data-driven, no fluff',
    friendly: t.agent.friendlyDesc || 'Warm, encouraging, supportive',
    casual: t.agent.casualDesc || 'Relaxed, informal, fun',
    custom: t.agent.customDesc || 'Custom instructions',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">{t.agent.agentSettings}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-gray-600 border-t-[#8b5cf6] rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Agent Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t.agent.agentName}</label>
                <input
                  type="text"
                  value={agentName}
                  onChange={e => setAgentName(e.target.value.slice(0, 30))}
                  maxLength={30}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#8b5cf6] transition-colors placeholder-gray-500"
                  placeholder="AllDrop Assistant"
                />
                <p className="text-xs text-gray-500 mt-1">{agentName.length}/30</p>
              </div>

              {/* Avatar URL */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t.agent.agentAvatar}</label>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0 overflow-hidden">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="w-full h-full object-cover rounded-full"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <Bot className="w-5 h-5 text-[#8b5cf6]" />
                    )}
                  </div>
                  <input
                    type="text"
                    value={avatarUrl}
                    onChange={e => setAvatarUrl(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#8b5cf6] transition-colors placeholder-gray-500"
                    placeholder="https://example.com/avatar.png"
                  />
                </div>
              </div>

              {/* Personality */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t.agent.personality}</label>
                <div className="space-y-2">
                  {PERSONALITY_OPTIONS.map(option => (
                    <button
                      key={option}
                      onClick={() => setPersonality(option)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                        personality === option
                          ? 'border-[#8b5cf6] bg-[#8b5cf6]/10 text-white'
                          : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                      }`}
                    >
                      <span className="text-sm font-medium">
                        {option === 'professional' && t.agent.professional}
                        {option === 'friendly' && t.agent.friendly}
                        {option === 'casual' && t.agent.casual}
                        {option === 'custom' && t.agent.custom}
                      </span>
                      <span className="block text-xs mt-0.5 opacity-70">
                        {personalityDescriptions[option]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Instructions */}
              {personality === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">{t.agent.customInstructions}</label>
                  <textarea
                    value={customInstructions}
                    onChange={e => setCustomInstructions(e.target.value)}
                    rows={4}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#8b5cf6] transition-colors placeholder-gray-500 resize-none"
                    placeholder={t.agent.customInstructionsPlaceholder}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700">
          <button
            onClick={handleSave}
            disabled={loading || saving}
            className="w-full py-2.5 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
          >
            {saving ? '...' : t.agent.saveSettings}
          </button>
        </div>
      </div>
    </div>
  )
}
