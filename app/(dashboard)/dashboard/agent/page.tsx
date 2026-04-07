'use client'

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react'
import { useI18n } from '@/lib/i18n'
import { MessageSquare, Send, Trash2, Plus, Lock, Bot, Settings, ImagePlus, X } from 'lucide-react'
import AgentConfigModal from '@/components/agent/AgentConfigModal'

interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = now - date
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  return `${months}mo`
}

/** Escape HTML entities to prevent XSS */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Render basic markdown from sanitized assistant content */
function renderMarkdown(text: string): string {
  // First escape HTML to prevent XSS
  let html = escapeHtml(text)
  // Code blocks (use escaped backticks pattern after escaping)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-gray-900 rounded-lg p-3 my-2 overflow-x-auto text-sm"><code>$2</code></pre>')
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-900 px-1.5 py-0.5 rounded text-sm text-emerald-400">$1</code>')
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
  // Paragraphs (double newline)
  html = html.replace(/\n\n/g, '</p><p class="mt-2">')
  // Single newlines
  html = html.replace(/\n/g, '<br/>')
  return `<p>${html}</p>`
}

export default function AgentPage() {
  const { t, locale } = useI18n()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [planBlocked, setPlanBlocked] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [agentName, setAgentName] = useState('AllDrop Assistant')
  const [agentAvatarUrl, setAgentAvatarUrl] = useState<string | null>(null)
  const [attachedImages, setAttachedImages] = useState<{ file: File; preview: string }[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Fetch conversations on mount
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/conversations')
      if (res.status === 403) {
        setPlanBlocked(true)
        setLoadingConversations(false)
        return
      }
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setConversations(data)
    } catch {
      // silent
    } finally {
      setLoadingConversations(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
    // Load agent config
    fetch('/api/agent/config')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setAgentName(data.agent_name || 'AllDrop Assistant')
          setAgentAvatarUrl(data.agent_avatar_url || null)
        }
      })
      .catch(() => {})
  }, [fetchConversations])

  // Load messages when conversation changes
  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/agent/conversations/${conversationId}/messages`)
      if (!res.ok) throw new Error('Failed to fetch messages')
      const data = await res.json()
      setMessages(data)
    } catch {
      setMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id)
    loadMessages(id)
  }, [loadMessages])

  const handleNewConversation = useCallback(() => {
    setActiveConversationId(null)
    setMessages([])
    setInputValue('')
    textareaRef.current?.focus()
  }, [])

  const handleDeleteConversation = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(t.agent.deleteConfirm)) return
    try {
      await fetch('/api/agent/conversations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setConversations(prev => prev.filter(c => c.id !== id))
      if (activeConversationId === id) {
        setActiveConversationId(null)
        setMessages([])
      }
    } catch {
      // silent
    }
  }, [t.agent.deleteConfirm, activeConversationId])

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    const newImages = imageFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setAttachedImages(prev => [...prev, ...newImages].slice(0, 5))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const removeImage = useCallback((index: number) => {
    setAttachedImages(prev => {
      const updated = [...prev]
      URL.revokeObjectURL(updated[index].preview)
      updated.splice(index, 1)
      return updated
    })
  }, [])

  const handleSend = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || isStreaming) return

    // Convert images to base64
    let productImages: string[] = []
    if (attachedImages.length > 0) {
      productImages = await Promise.all(
        attachedImages.map(img => new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(img.file)
        }))
      )
    }

    const displayContent = attachedImages.length > 0
      ? `${text}\n\n[${attachedImages.length} imagen(es) adjunta(s)]`
      : text

    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: displayContent,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setAttachedImages([])
    setIsStreaming(true)

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const assistantMessage: Message = {
      id: `temp-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, assistantMessage])

    try {
      const controller = new AbortController()
      abortRef.current = controller

      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: activeConversationId,
          message: text,
          locale,
          ...(productImages.length > 0 && { product_images: productImages }),
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      if (!res.body) {
        throw new Error('No stream body')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulatedText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr || jsonStr === '[DONE]') continue

          try {
            const event = JSON.parse(jsonStr)

            if (event.type === 'conversation_id') {
              setActiveConversationId(event.conversation_id)
            } else if (event.type === 'delta') {
              accumulatedText += event.text
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last && last.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: accumulatedText }
                }
                return updated
              })
            } else if (event.type === 'done') {
              // Stream complete
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      // On error, update last assistant message
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last && last.role === 'assistant' && !last.content) {
          updated[updated.length - 1] = { ...last, content: `Error: ${err instanceof Error ? err.message : 'could not get response.'}` }
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
      abortRef.current = null
      fetchConversations()
    }
  }, [inputValue, isStreaming, activeConversationId, fetchConversations, locale, attachedImages])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleTextareaInput = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxHeight = 4 * 24 // ~4 lines
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [])

  // Plan gate
  if (planBlocked) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-[#0a0a0a]">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 max-w-md text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-3">{t.agent.title}</h2>
          <p className="text-gray-400 mb-6">{t.agent.planRequired}</p>
          <a
            href="/dashboard/pricing"
            className="inline-flex items-center px-6 py-3 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-medium transition-colors"
          >
            {t.agent.upgradePlan}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#0a0a0a]">
      {/* Left Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-[280px] min-w-[280px]' : 'w-0 min-w-0 overflow-hidden'
        } border-r border-gray-800 flex flex-col transition-all duration-200`}
      >
        {/* New Conversation Button */}
        <div className="p-3">
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-medium transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            {t.agent.newConversation}
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {loadingConversations ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-gray-600 border-t-[#8b5cf6] rounded-full animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-10 px-4">
              <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">{t.agent.noConversations}</p>
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                className={`group w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-colors relative ${
                  activeConversationId === conv.id
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm truncate flex-1">{conv.title || t.agent.newConversation}</span>
                  <span className="text-xs text-gray-600 shrink-0">{formatRelativeTime(conv.updated_at || conv.created_at)}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-700 transition-opacity"
                  aria-label="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5 text-gray-500 hover:text-red-400" />
                </button>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          {agentAvatarUrl ? (
            <img src={agentAvatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
          ) : (
            <Bot className="w-5 h-5 text-[#8b5cf6]" />
          )}
          <h1 className="text-white font-medium flex-1">{agentName}</h1>
          <button
            onClick={() => setConfigModalOpen(true)}
            className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
            aria-label={t.agent.agentSettings}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!activeConversationId && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-[#8b5cf6]" />
              </div>
              <p className="text-gray-500 text-sm max-w-xs">{t.agent.selectConversation}</p>
            </div>
          ) : loadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-gray-600 border-t-[#8b5cf6] rounded-full animate-spin" />
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center mr-2 mt-1 shrink-0 overflow-hidden">
                      {agentAvatarUrl ? (
                        <img src={agentAvatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Bot className="w-4 h-4 text-[#8b5cf6]" />
                      )}
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#8b5cf6] text-white rounded-br-md'
                        : 'bg-gray-800 text-gray-200 rounded-bl-md'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div
                        className="prose prose-invert prose-sm max-w-none [&_pre]:my-2 [&_code]:text-emerald-400 [&_li]:my-0.5"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content || '') }}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {isStreaming && messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1]?.content && (
                <div className="flex items-center gap-2 text-gray-500 text-sm pl-9">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span>{t.agent.thinking}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-800 p-4">
          <div className="max-w-3xl mx-auto">
            {/* Image previews */}
            {attachedImages.length > 0 && (
              <div className="flex gap-2 mb-2 flex-wrap">
                {attachedImages.map((img, i) => (
                  <div key={i} className="relative group">
                    <img src={img.preview} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-700" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 bg-gray-900 border border-gray-700 rounded-2xl px-4 py-2 focus-within:border-[#8b5cf6] transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming}
                className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white disabled:opacity-30 shrink-0"
                aria-label="Attach image"
              >
                <ImagePlus className="w-5 h-5" />
              </button>
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value)
                  handleTextareaInput()
                }}
                onKeyDown={handleKeyDown}
                placeholder={t.agent.placeholder}
                disabled={isStreaming}
                rows={1}
                className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none resize-none text-sm py-1.5 max-h-[96px] disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={isStreaming || !inputValue.trim()}
                className="p-2 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
                aria-label={t.agent.send}
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <AgentConfigModal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        onSaved={(config) => {
          setAgentName(config.agent_name || 'AllDrop Assistant')
          setAgentAvatarUrl(config.agent_avatar_url || null)
        }}
      />
    </div>
  )
}
