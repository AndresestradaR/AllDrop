import OpenAI from 'openai'

const MODELS = [
  'qwen/qwen3.6-plus:free',
  'deepseek/deepseek-chat-v3.2',
  'google/gemini-2.5-flash',
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
  content: string
  tool_calls?: any[]
  tool_call_id?: string
  name?: string
}

export interface AgentStreamCallbacks {
  onDelta: (text: string) => void
  onError: (error: string) => void
  onDone: (fullText: string, model: string) => void
}

export async function streamAgentResponse(
  messages: AgentMessage[],
  callbacks: AgentStreamCallbacks,
): Promise<void> {
  const openai = getClient()
  let lastError = ''

  for (const model of MODELS) {
    try {
      const stream = await openai.chat.completions.create({
        model,
        messages: messages as any,
        stream: true,
        max_tokens: 4096,
        temperature: 0.7,
      })

      let fullText = ''
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta
        if (!delta) continue
        if (delta.content) {
          fullText += delta.content
          callbacks.onDelta(delta.content)
        }
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
