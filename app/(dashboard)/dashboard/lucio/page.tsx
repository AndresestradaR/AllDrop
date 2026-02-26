'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send } from 'lucide-react'

const LUCIO_URL = process.env.NEXT_PUBLIC_LUCIO_URL || ''
const LUCIO_TOKEN = process.env.NEXT_PUBLIC_LUCIO_TOKEN || ''

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

function uid(): string {
  return crypto.randomUUID()
}

function httpsToWss(url: string): string {
  return url.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')
}

/** Extract text from OpenClaw message content (string or array of parts) */
function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((p: any) => p.type === 'text' && typeof p.text === 'string')
      .map((p: any) => p.text)
      .join('')
  }
  if (content && typeof content === 'object' && 'text' in content) {
    return String((content as any).text)
  }
  return ''
}

export default function LucioPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [streamText, setStreamText] = useState('')

  const wsRef = useRef<WebSocket | null>(null)
  const pendingRef = useRef<Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>>(new Map())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const instanceId = useRef(uid())
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionKeyRef = useRef<string | null>(null)
  const currentRunId = useRef<string | null>(null)

  const sessionKey = userId ? `agent:main:${userId}` : null
  sessionKeyRef.current = sessionKey

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  // Get Supabase user
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
      setPageLoading(false)
    })
  }, [])

  // JSON-RPC request
  const rpcRequest = useCallback((method: string, params: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'))
        return
      }
      const id = uid()
      pendingRef.current.set(id, { resolve, reject })
      ws.send(JSON.stringify({ type: 'req', id, method, params }))
      setTimeout(() => {
        if (pendingRef.current.has(id)) {
          pendingRef.current.delete(id)
          reject(new Error('Timeout'))
        }
      }, 30000)
    })
  }, [])

  // Handle chat events
  const handleChatEvent = useCallback((payload: any) => {
    if (!payload || payload.sessionKey !== sessionKeyRef.current) return

    const state = payload.state as string
    const msgContent = extractText(payload.message?.content)

    if (state === 'delta') {
      // content is full accumulated text
      if (msgContent) setStreamText(msgContent)
    } else if (state === 'thinking' || state === 'tool') {
      // still working, keep showing indicator
    } else if (state === 'final') {
      const finalText = msgContent
      if (finalText) {
        setMessages(prev => [...prev, {
          id: uid(),
          role: 'assistant',
          content: finalText,
          timestamp: payload.message?.timestamp || Date.now()
        }])
      }
      setStreamText('')
      setSending(false)
      currentRunId.current = null
    } else if (state === 'error') {
      const errText = payload.errorMessage || 'Error al procesar el mensaje'
      setMessages(prev => [...prev, {
        id: uid(),
        role: 'system',
        content: errText,
        timestamp: Date.now()
      }])
      setStreamText('')
      setSending(false)
      currentRunId.current = null
    } else if (state === 'aborted') {
      // Save whatever was streamed
      if (msgContent) {
        setMessages(prev => [...prev, {
          id: uid(),
          role: 'assistant',
          content: msgContent,
          timestamp: Date.now()
        }])
      }
      setStreamText('')
      setSending(false)
      currentRunId.current = null
    }
  }, [])

  // WebSocket connection
  useEffect(() => {
    if (!LUCIO_URL || !sessionKey) return

    let cancelled = false
    const wsUrl = httpsToWss(LUCIO_URL)

    function connect() {
      if (cancelled) return

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      let connectSent = false

      const sendConnect = async () => {
        if (connectSent || cancelled) return
        connectSent = true
        try {
          await rpcRequest('connect', {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: 'webchat-ui',
              version: '1.0',
              platform: navigator.platform || 'web',
              mode: 'webchat',
              instanceId: instanceId.current
            },
            role: 'operator',
            scopes: ['operator.admin', 'operator.approvals', 'operator.pairing'],
            caps: [],
            ...(LUCIO_TOKEN ? { auth: { token: LUCIO_TOKEN } } : {}),
            userAgent: navigator.userAgent,
            locale: navigator.language
          })

          if (cancelled) return
          setConnected(true)

          // Load history
          try {
            const history = await rpcRequest('chat.history', {
              sessionKey,
              limit: 200
            })
            if (history?.messages && Array.isArray(history.messages)) {
              const parsed: ChatMessage[] = []
              for (const m of history.messages) {
                const text = extractText(m.content)
                if (text) {
                  parsed.push({
                    id: uid(),
                    role: m.role || 'assistant',
                    content: text,
                    timestamp: m.timestamp || Date.now()
                  })
                }
              }
              setMessages(parsed)
            }
          } catch (e) {
            console.warn('[Lucio] History error:', e)
          }
        } catch (e) {
          console.error('[Lucio] Connect error:', e)
        }
      }

      ws.addEventListener('open', () => {
        // OpenClaw waits 750ms before sending connect
        setTimeout(sendConnect, 750)
      })

      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data)

          // RPC response
          if (data.type === 'res') {
            const p = pendingRef.current.get(data.id)
            if (p) {
              pendingRef.current.delete(data.id)
              if (data.ok) p.resolve(data.payload)
              else p.reject(new Error(data.error?.message || 'Request failed'))
            }
          }

          // Events
          if (data.type === 'event') {
            // Handle connect challenge
            if (data.event === 'connect.challenge' && data.payload?.nonce) {
              connectSent = false
              sendConnect()
            }
            if (data.event === 'chat') {
              handleChatEvent(data.payload)
            }
          }
        } catch {}
      })

      ws.addEventListener('close', () => {
        setConnected(false)
        pendingRef.current.forEach(p => p.reject(new Error('Disconnected')))
        pendingRef.current.clear()
        if (!cancelled) {
          reconnectTimer.current = setTimeout(connect, 3000)
        }
      })

      ws.addEventListener('error', () => {})
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [LUCIO_URL, sessionKey, rpcRequest, handleChatEvent])

  // Send message
  const sendMessage = async () => {
    if (!input.trim() || !sessionKey || !connected || sending) return

    const text = input.trim()
    setInput('')
    setSending(true)
    setStreamText('')

    setMessages(prev => [...prev, {
      id: uid(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    }])

    const runId = uid()
    currentRunId.current = runId

    try {
      await rpcRequest('chat.send', {
        sessionKey,
        message: text,
        deliver: false,
        idempotencyKey: runId,
        attachments: []
      })
    } catch (err) {
      console.error('[Lucio] Send error:', err)
      setSending(false)
      currentRunId.current = null
    }
  }

  // Enter to send, Shift+Enter for new line
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
    }
  }, [input])

  // --- Fallback states ---

  if (!LUCIO_URL) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-3">
          <span className="text-5xl">🦞</span>
          <h2 className="text-lg font-bold text-text-primary">Lucio no está disponible</h2>
          <p className="text-sm text-text-secondary">La conexión con el asistente no está configurada.</p>
        </div>
      </div>
    )
  }

  if (pageLoading) {
    return (
      <div className="-m-6 flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
        <Header connected={false} />
        <div className="flex-1 flex items-center justify-center">
          <Spinner text="Cargando..." />
        </div>
      </div>
    )
  }

  // --- Main UI ---

  return (
    <div className="-m-6 flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
      <Header connected={connected} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && !sending && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-80">
            <span className="text-7xl">🦞</span>
            <div>
              <h2 className="text-xl font-bold text-text-primary">¡Hola! Soy Lucio</h2>
              <p className="text-sm text-text-secondary mt-1">
                Tu asistente de dropshipping COD. Pregúntame lo que necesites.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming / thinking indicator */}
        {sending && (
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-sm">🦞</span>
            </div>
            <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-surface border border-border">
              {streamText ? (
                <p className="text-sm text-text-primary whitespace-pre-wrap">{streamText}</p>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-text-secondary">Lucio está pensando...</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border bg-surface p-4">
        <div className="flex items-end gap-3 max-w-3xl mx-auto">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={connected ? 'Escribe tu mensaje...' : 'Conectando con Lucio...'}
            disabled={!connected}
            rows={1}
            className="flex-1 resize-none bg-background border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || !connected || sending}
            className="shrink-0 w-10 h-10 rounded-xl bg-accent text-background flex items-center justify-center hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Sub-components ---

function Header({ connected }: { connected: boolean }) {
  return (
    <div className="px-6 py-4 border-b border-border bg-surface flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🦞</span>
        <div>
          <h1 className="text-lg font-bold text-text-primary">Lucio</h1>
          <p className="text-sm text-text-secondary">Tu asistente de dropshipping COD</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-orange-400 animate-pulse'}`} />
        <span className="text-xs text-text-secondary">{connected ? 'Conectado' : 'Conectando...'}</span>
      </div>
    </div>
  )
}

function Spinner({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 text-text-secondary">
      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <p className="text-xs text-text-secondary bg-border/30 px-3 py-1.5 rounded-full">{message.content}</p>
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'items-start gap-2'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-sm">🦞</span>
        </div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-accent/20 text-text-primary'
          : 'bg-surface border border-border text-text-primary'
      }`}>
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </div>
  )
}
