import OpenAI from 'openai'

const MODELS = [
  'openai/gpt-4.1-mini',
  'openai/gpt-5.4-nano',
  'deepseek/deepseek-chat-v3.2',
]

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured')
    client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://alldrop-io.vercel.app',
        'X-Title': 'AllDrop AI Agent',
      },
    })
  }
  return client
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: any[]
  tool_call_id?: string
  name?: string
}

export interface ToolCallResult {
  id: string
  name: string
  arguments: string
}

export interface AgentStreamCallbacks {
  onDelta: (text: string) => void
  onError: (error: string) => void
  onDone: (fullText: string, model: string) => void
  onToolCall?: (toolCall: ToolCallResult) => void
}

export interface StreamOptions {
  tools?: any[]
}

export async function streamAgentResponse(
  messages: AgentMessage[],
  callbacks: AgentStreamCallbacks,
  options?: StreamOptions,
): Promise<void> {
  const openai = getClient()
  let lastError = ''

  for (const model of MODELS) {
    try {
      const createParams: any = {
        model,
        messages: messages as any,
        stream: true,
        max_tokens: 4096,
        temperature: 0.7,
      }

      if (options?.tools && options.tools.length > 0) {
        createParams.tools = options.tools
        createParams.tool_choice = 'auto'
      }

      const stream = await openai.chat.completions.create(createParams) as any

      let fullText = ''
      // Accumulate tool calls across chunks
      const toolCallsMap: Record<number, { id: string; name: string; arguments: string }> = {}

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta
        const finishReason = chunk.choices?.[0]?.finish_reason
        if (!delta) continue

        // Handle text content
        if (delta.content) {
          fullText += delta.content
          callbacks.onDelta(delta.content)
        }

        // Handle tool calls - accumulate across chunks
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0
            if (!toolCallsMap[idx]) {
              toolCallsMap[idx] = { id: '', name: '', arguments: '' }
            }
            if (tc.id) {
              toolCallsMap[idx].id = tc.id
            }
            if (tc.function?.name) {
              toolCallsMap[idx].name = tc.function.name
            }
            if (tc.function?.arguments) {
              toolCallsMap[idx].arguments += tc.function.arguments
            }
          }
        }

        // When finish_reason is 'tool_calls', emit accumulated tool calls
        if (finishReason === 'tool_calls' || finishReason === 'stop') {
          if (finishReason === 'tool_calls' && callbacks.onToolCall) {
            for (const idx of Object.keys(toolCallsMap).map(Number).sort()) {
              const tc = toolCallsMap[idx]
              if (tc.id && tc.name) {
                callbacks.onToolCall({
                  id: tc.id,
                  name: tc.name,
                  arguments: tc.arguments,
                })
              }
            }
          }
        }
      }

      // If we had tool calls but no finish_reason caught them, emit now
      const toolCallIds = Object.keys(toolCallsMap)
      if (toolCallIds.length > 0 && callbacks.onToolCall) {
        // Check if any tool calls weren't emitted yet (some providers don't set finish_reason)
        for (const idx of toolCallIds.map(Number).sort()) {
          const tc = toolCallsMap[idx]
          if (tc.id && tc.name) {
            callbacks.onToolCall({
              id: tc.id,
              name: tc.name,
              arguments: tc.arguments,
            })
          }
        }
        // Don't call onDone yet - caller will handle tool loop
        return
      }

      callbacks.onDone(fullText, model)
      return
    } catch (err: any) {
      lastError = err?.message || 'Unknown error'
      console.error(`[Agent] Model ${model} failed: ${lastError}`)
    }
  }

  callbacks.onError(`All models failed. Last error: ${lastError}`)
}
