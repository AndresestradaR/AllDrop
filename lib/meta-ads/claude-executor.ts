// Meta Ads AI Manager — Claude Executor
// Orchestrates Anthropic API with tool_use loop + SSE streaming

import Anthropic from '@anthropic-ai/sdk'
import { MetaAPIClient } from './meta-api'
import { META_ADS_TOOLS } from './tools'
import { META_ADS_SYSTEM_PROMPT } from './system-prompt'
import { isWriteTool } from './types'
import type { SSEEvent } from './types'

export interface ExecutorOptions {
  anthropicApiKey: string
  metaAccessToken: string
  conversationId: string
  userId: string
  // Claude model to use
  model?: string
  // Auto-execute write tools without individual confirmation
  autoExecute?: boolean
  // Previous messages for context (Anthropic format)
  messages: Anthropic.MessageParam[]
  // Callback to persist messages/actions to DB
  onSaveMessage?: (msg: {
    role: string
    content?: string
    tool_name?: string
    tool_input?: Record<string, any>
    tool_result?: Record<string, any>
    tool_use_id?: string
    requires_confirmation?: boolean
  }) => Promise<string | undefined>
  // Callback to fetch user's products from EstrategasIA
  onGetProducts?: () => Promise<any[]>
  // Callback to create pending action
  onCreatePendingAction?: (action: {
    action_type: string
    action_payload: Record<string, any>
    description: string
    tool_use_id: string
  }) => Promise<string>
}

// Maximum tool_use loop iterations to prevent infinite loops
const MAX_TOOL_ITERATIONS = 30

export async function executeChat(
  opts: ExecutorOptions,
  sendEvent: (event: SSEEvent) => void
): Promise<void> {
  const { anthropicApiKey, metaAccessToken, messages } = opts

  const anthropic = new Anthropic({ apiKey: anthropicApiKey })
  const metaClient = new MetaAPIClient({ accessToken: metaAccessToken })

  // Build the current message list
  let currentMessages: Anthropic.MessageParam[] = [...messages]
  let iterations = 0

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++

    // Call Claude with tools
    const validModels = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']
    const selectedModel = opts.model && validModels.includes(opts.model) ? opts.model : 'claude-opus-4-6'
    const response = await anthropic.messages.create({
      model: selectedModel,
      max_tokens: 8192,
      system: META_ADS_SYSTEM_PROMPT,
      tools: META_ADS_TOOLS.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool['input_schema'],
      })),
      messages: currentMessages,
    })

    // Process response content blocks
    let textContent = ''
    const toolUseBlocks: Anthropic.ContentBlockParam[] = []
    const toolResultBlocks: Anthropic.ToolResultBlockParam[] = []
    let hasToolUse = false
    let needsConfirmation = false

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text
        // Stream text delta
        sendEvent({ type: 'delta', data: { text: block.text } })
      } else if (block.type === 'tool_use') {
        hasToolUse = true
        const toolName = block.name
        const toolInput = block.input as Record<string, any>

        // Check if this is a write tool (needs confirmation unless autoExecute)
        if (isWriteTool(toolName) && !opts.autoExecute) {
          needsConfirmation = true

          // Save pending action FIRST to get the action_id
          let actionId = ''
          if (opts.onCreatePendingAction) {
            actionId = await opts.onCreatePendingAction({
              action_type: toolName,
              action_payload: toolInput,
              description: describeAction(toolName, toolInput),
              tool_use_id: block.id,
            })
          }

          // Notify frontend with the action_id
          sendEvent({
            type: 'confirmation_required',
            data: {
              tool_use_id: block.id,
              tool_name: toolName,
              tool_input: toolInput,
              description: describeAction(toolName, toolInput),
              action_id: actionId,
            },
          })

          // Save assistant text (if any) and tool_call separately
          if (opts.onSaveMessage) {
            if (textContent) {
              await opts.onSaveMessage({ role: 'assistant', content: textContent })
            }
            await opts.onSaveMessage({
              role: 'tool_call',
              tool_name: toolName,
              tool_input: toolInput,
              tool_use_id: block.id,
              requires_confirmation: true,
            })
          }

          // Stop the loop — wait for user confirmation
          sendEvent({
            type: 'done',
            data: { stop_reason: 'confirmation_required', tool_use_id: block.id },
          })
          return
        }

        // Auto-execute write tools: notify frontend, execute, continue loop
        if (isWriteTool(toolName) && opts.autoExecute) {
          sendEvent({
            type: 'tool_start',
            data: { tool_name: toolName, tool_input: toolInput, is_write: true },
          })

          const result = await metaClient.executeTool(toolName, toolInput)

          sendEvent({
            type: 'tool_result',
            data: { tool_name: toolName, result, is_write: true },
          })

          // Save to DB
          if (opts.onSaveMessage) {
            await opts.onSaveMessage({
              role: 'tool_call',
              tool_name: toolName,
              tool_input: toolInput,
              tool_use_id: block.id,
            })
            await opts.onSaveMessage({
              role: 'tool_result',
              tool_name: toolName,
              tool_result: result,
              tool_use_id: block.id,
            })
          }

          // Accumulate for next iteration
          toolUseBlocks.push(block)
          toolResultBlocks.push({
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
          continue
        }

        // Read-only tool — execute immediately
        sendEvent({
          type: 'tool_start',
          data: { tool_name: toolName, tool_input: toolInput },
        })

        // Handle internal tools (not Meta API)
        let result: { success: boolean; data?: any; error?: string }
        if (toolName === 'get_my_products' && opts.onGetProducts) {
          try {
            const products = await opts.onGetProducts()
            result = { success: true, data: products }
          } catch (err: any) {
            result = { success: false, error: err.message }
          }
        } else {
          result = await metaClient.executeTool(toolName, toolInput)
        }

        sendEvent({
          type: 'tool_result',
          data: { tool_name: toolName, result },
        })

        // Save tool call + result to DB
        if (opts.onSaveMessage) {
          await opts.onSaveMessage({
            role: 'tool_call',
            tool_name: toolName,
            tool_input: toolInput,
            tool_use_id: block.id,
          })
          await opts.onSaveMessage({
            role: 'tool_result',
            tool_name: toolName,
            tool_result: result,
            tool_use_id: block.id,
          })
        }

        // Accumulate for the next iteration
        toolUseBlocks.push(block)
        toolResultBlocks.push({
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
      }
    }

    // Save assistant text message
    if (textContent && opts.onSaveMessage) {
      await opts.onSaveMessage({ role: 'assistant', content: textContent })
    }

    // If no tool use, we're done
    if (!hasToolUse || needsConfirmation) {
      break
    }

    // If Claude used tools, add the assistant response + tool results and loop
    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResultBlocks },
    ]
  }

  sendEvent({ type: 'done', data: { stop_reason: 'end_turn' } })
}

// Execute a confirmed write action
export async function executeConfirmedAction(
  metaAccessToken: string,
  toolName: string,
  toolInput: Record<string, any>
): Promise<{ success: boolean; data?: any; error?: string }> {
  const metaClient = new MetaAPIClient({ accessToken: metaAccessToken })
  return metaClient.executeTool(toolName, toolInput)
}

// Generate human-readable description for write actions
function describeAction(toolName: string, input: Record<string, any>): string {
  switch (toolName) {
    case 'create_campaign':
      return `Crear campaña "${input.name}" con objetivo ${input.objective}${input.daily_budget ? ` y presupuesto diario de ${(input.daily_budget / 100).toFixed(2)}` : ''}`
    case 'create_adset':
      return `Crear conjunto de anuncios "${input.name}" optimizando por ${input.optimization_goal}`
    case 'create_ad':
      return `Crear anuncio "${input.name}"`
    case 'update_budget':
      if (input.daily_budget) {
        return `Cambiar presupuesto diario de ${input.object_type} a ${(input.daily_budget / 100).toFixed(2)}`
      }
      return `Cambiar presupuesto de ${input.object_type}`
    case 'toggle_status':
      return `${input.new_status === 'ACTIVE' ? 'Activar' : 'Pausar'} ${input.object_type} (${input.object_id})`
    case 'update_targeting':
      return `Actualizar targeting del adset ${input.adset_id}`
    default:
      return `Ejecutar ${toolName}`
  }
}
