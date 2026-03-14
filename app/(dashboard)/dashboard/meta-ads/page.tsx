'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MetaAdsChat } from '@/components/meta-ads/MetaAdsChat'
import { ConversationList } from '@/components/meta-ads/ConversationList'
import { Plus, MessageSquare, Settings, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Conversation {
  id: string
  title: string
  meta_ad_account_id: string | null
  created_at: string
  updated_at: string
}

export default function MetaAdsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [hasKeys, setHasKeys] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSidebar, setShowSidebar] = useState(true)

  useEffect(() => {
    checkKeys()
    loadConversations()
  }, [])

  async function checkKeys() {
    try {
      const res = await fetch('/api/keys')
      const data = await res.json()
      setHasKeys(data.hasMetaAccessToken && data.hasAnthropicApiKey)
    } catch {
      setHasKeys(false)
    }
  }

  async function loadConversations() {
    try {
      const res = await fetch('/api/meta-ads/conversations')
      const data = await res.json()
      if (Array.isArray(data)) setConversations(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function createConversation() {
    const res = await fetch('/api/meta-ads/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nueva conversación' }),
    })
    const conv = await res.json()
    if (conv.id) {
      setConversations(prev => [conv, ...prev])
      setActiveConversation(conv.id)
    }
  }

  if (hasKeys === false) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md space-y-4">
          <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto">
            <Settings className="w-8 h-8 text-purple-600" />
          </div>
          <h2 className="text-xl font-semibold">Configura tus credenciales</h2>
          <p className="text-gray-500 text-sm">
            Para usar Meta Ads IA necesitas configurar tu <strong>Token de Meta</strong> y tu <strong>API Key de Anthropic (Claude)</strong> en Settings.
          </p>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Ir a Settings
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Sidebar */}
      {showSidebar && (
        <div className="w-72 border-r border-gray-200 flex flex-col bg-gray-50">
          <div className="p-3 border-b border-gray-200">
            <button
              onClick={createConversation}
              className="w-full flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Nueva conversación
            </button>
          </div>
          <ConversationList
            conversations={conversations}
            activeId={activeConversation}
            onSelect={(id) => setActiveConversation(id)}
            loading={loading}
          />
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeConversation ? (
          <>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {showSidebar ? <ArrowLeft className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
              </button>
              <h2 className="text-sm font-medium text-gray-700 truncate">
                {conversations.find(c => c.id === activeConversation)?.title || 'Chat'}
              </h2>
            </div>
            <MetaAdsChat conversationId={activeConversation} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center space-y-3">
              <MessageSquare className="w-12 h-12 mx-auto opacity-50" />
              <p className="text-sm">Selecciona o crea una conversación para empezar</p>
              <button
                onClick={createConversation}
                className="text-purple-600 hover:text-purple-700 text-sm font-medium"
              >
                + Nueva conversación
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
