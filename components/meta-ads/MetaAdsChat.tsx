'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Loader2, Check, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface Message {
  id?: string
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result' | 'confirmation'
  content: string | null
  tool_name?: string | null
  tool_input?: Record<string, any> | null
  tool_result?: Record<string, any> | null
  requires_confirmation?: boolean
}

interface PendingAction {
  tool_use_id: string
  tool_name: string
  tool_input: Record<string, any>
  description: string
  action_id?: string
}

interface MetaAdsChatProps {
  conversationId: string
}

export function MetaAdsChat({ conversationId }: MetaAdsChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    loadMessages()
  }, [conversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    try {
      const res = await fetch(`/api/meta-ads/conversations/${conversationId}/messages`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setMessages(data.filter((m: Message) => m.role === 'user' || m.role === 'assistant' || m.role === 'confirmation'))
      }
    } catch {
      // ignore
    }
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setIsStreaming(true)

    let assistantText = ''

    try {
      const res = await fetch('/api/meta-ads/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, message: text }),
      })

      if (!res.ok) {
        const err = await res.json()
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.error || 'Error desconocido'}` }])
        setIsStreaming(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()

      // Add placeholder for assistant response
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))

            if (event.type === 'delta') {
              assistantText += event.data.text
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: assistantText }
                }
                return updated
              })
            } else if (event.type === 'tool_start') {
              // Show tool execution indicator
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  const toolInfo = `\n\n🔍 *Consultando ${event.data.tool_name}...*`
                  updated[updated.length - 1] = { ...last, content: (assistantText || '') + toolInfo }
                }
                return updated
              })
            } else if (event.type === 'tool_result') {
              // Remove the "consultando" text, Claude will incorporate results
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: assistantText }
                }
                return updated
              })
            } else if (event.type === 'confirmation_required') {
              setPendingAction({
                tool_use_id: event.data.tool_use_id,
                tool_name: event.data.tool_name,
                tool_input: event.data.tool_input,
                description: event.data.description,
              })
            } else if (event.type === 'error') {
              assistantText += `\n\n⚠️ ${event.data.message}`
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: assistantText }
                }
                return updated
              })
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error de conexión: ${err.message}` }])
    } finally {
      setIsStreaming(false)
    }
  }

  async function handleConfirm(confirmed: boolean) {
    if (!pendingAction) return
    setConfirmLoading(true)

    try {
      // We need to find the action_id from pending_actions table
      // For now, we'll search by conversation_id + pending status
      const res = await fetch('/api/meta-ads/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_id: pendingAction.action_id,
          confirmed,
        }),
      })

      const result = await res.json()
      const statusMsg = confirmed
        ? (result.success ? `✅ ${pendingAction.description}` : `⚠️ Error: ${result.error}`)
        : `❌ Acción cancelada: ${pendingAction.description}`

      setMessages(prev => [...prev, { role: 'confirmation', content: statusMsg }])
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'confirmation', content: `⚠️ Error: ${err.message}` }])
    } finally {
      setPendingAction(null)
      setConfirmLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-8">
            <p className="text-lg mb-1">👋 ¡Hola! Soy Matías</p>
            <p>Tu media buyer IA. Pregúntame sobre tus campañas de Meta Ads.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[
                '¿Cuáles son mis cuentas publicitarias?',
                '¿Cómo van mis campañas activas?',
                'Muéstrame las métricas de los últimos 7 días',
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); inputRef.current?.focus() }}
                  className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs hover:bg-purple-100 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : msg.role === 'confirmation'
                  ? 'bg-gray-100 text-gray-700 border border-gray-200'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none prose-table:text-xs prose-th:px-2 prose-td:px-2">
                  <ReactMarkdown>{msg.content || ''}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {/* Pending action confirmation */}
        {pendingAction && (
          <div className="flex justify-start">
            <div className="max-w-[80%] bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm">
              <p className="font-medium text-amber-800 mb-2">⚡ Confirmación requerida</p>
              <p className="text-amber-700 mb-3">{pendingAction.description}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleConfirm(true)}
                  disabled={confirmLoading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-xs font-medium"
                >
                  {confirmLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Confirmar
                </button>
                <button
                  onClick={() => handleConfirm(false)}
                  disabled={confirmLoading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 text-xs font-medium"
                >
                  <X className="w-3 h-3" />
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {isStreaming && messages[messages.length - 1]?.content === '' && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje..."
            rows={1}
            className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 outline-none"
            style={{ maxHeight: '120px' }}
            onInput={(e) => {
              const el = e.target as HTMLTextAreaElement
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className="p-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors"
          >
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
