// Meta Ads AI Manager — Claude Executor
// Orchestrates Anthropic API with tool_use loop + SSE streaming

import Anthropic from '@anthropic-ai/sdk'
import { MetaAPIClient } from './meta-api'
import { META_ADS_TOOLS, getToolsForPhase, type AgentPhase } from './tools'
import { META_ADS_SYSTEM_PROMPT } from './system-prompt'
import { isWriteTool } from './types'
import type { SSEEvent } from './types'
import { executeLandingPipeline } from './landing-pipeline'
import { executeDropPagePipeline } from './droppage-pipeline'

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
  onExecuteEstrategasTool?: (toolName: string, toolInput: Record<string, any>) => Promise<{ success: boolean; data?: any; error?: string }>
  onExecuteDropPageTool?: (toolName: string, toolInput: Record<string, any>) => Promise<{ success: boolean; data?: any; error?: string }>
  // Pipeline support — direct references for deterministic execution
  estrategasToolsHandler?: import('./estrategas-tools').EstrategasToolsHandler
  dropPageClientInstance?: import('./droppage-client').DropPageClient
  // Auto-recovered from conversation history: product_id from last execute_landing_pipeline
  lastLandingProductId?: string
}

// Maximum tool_use loop iterations to prevent infinite loops
const MAX_TOOL_ITERATIONS = 30

// Truncate tool result JSON to avoid blowing up the prompt on next iteration
function truncateResult(result: any): string {
  const str = JSON.stringify(result)
  if (str.length <= 4000) return str
  try {
    const parsed = typeof result === 'string' ? JSON.parse(result) : result
    // Truncate large string values (e.g. base64 image data)
    if (typeof parsed === 'object' && parsed !== null) {
      const cleaned: Record<string, any> = {}
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string' && v.length > 500) {
          cleaned[k] = v.substring(0, 200) + `... [${v.length} chars]`
        } else if (Array.isArray(v) && v.length > 10) {
          cleaned[k] = v.slice(0, 5)
          cleaned[`_${k}_total`] = v.length
        } else {
          cleaned[k] = v
        }
      }
      return JSON.stringify(cleaned)
    }
  } catch { /* ignore */ }
  return str.substring(0, 4000) + '... [truncated]'
}

// Detect which phase the conversation is in based on tool usage history
function detectPhase(messages: Anthropic.MessageParam[]): AgentPhase {
  const allContent = JSON.stringify(messages)

  // Check for Meta Ads tool usage or campaign-related content
  const hasMetaTools = /create_campaign|create_adset|create_ad|get_campaigns|get_adsets|get_ads|get_insights|get_pixels|get_pages|search_targeting/.test(allContent)
  // Check for landing/banner generation
  const hasLandingTools = /generate_landing_banner|import_sections_to_droppage|get_templates|create_estrategas_product/.test(allContent)
  // Check for DropPage setup
  const hasDropPageTools = /create_droppage_product|create_droppage_page_design|create_droppage_quantity_offer|update_droppage_checkout_config/.test(allContent)

  if (hasMetaTools) return 'meta_ads'
  if (hasDropPageTools) return 'droppage_setup'
  if (hasLandingTools) return 'landing_creation'
  return 'initial'
}

// EstrategasIA tool names — used for routing
const ESTRATEGAS_TOOLS = [
  'create_estrategas_product',
  'get_landing_sections',
  'get_templates',
  'generate_landing_banner',
  'import_sections_to_droppage',
  'upload_product_image',
]

// Extended options for routing including pipeline support
interface RouteOptions extends Pick<ExecutorOptions, 'onExecuteEstrategasTool' | 'onExecuteDropPageTool' | 'onGetProducts'> {
  userId?: string
  // Auto-populated: product_id from the last execute_landing_pipeline result
  lastLandingProductId?: string
  estrategasTools?: import('./estrategas-tools').EstrategasToolsHandler
  dropPageClient?: import('./droppage-client').DropPageClient
  sendEvent?: (event: SSEEvent) => void
}

// Route tool execution to the correct handler (EstrategasIA, DropPage, Pipeline, or Meta API)
async function routeToolExecution(
  toolName: string,
  toolInput: Record<string, any>,
  metaClient: MetaAPIClient,
  opts: RouteOptions,
): Promise<{ success: boolean; data?: any; error?: string }> {
  // Pipeline tools — execute deterministic pipelines directly (no Claude cost)
  if (toolName === 'execute_landing_pipeline' && opts.estrategasTools && opts.sendEvent) {
    const result = await executeLandingPipeline(toolInput as any, opts.estrategasTools, opts.sendEvent)
    // Save product_id for auto-injection into execute_droppage_setup
    if (result.product_id) {
      opts.lastLandingProductId = result.product_id
    }
    return result
  }
  if (toolName === 'execute_droppage_setup' && opts.dropPageClient && opts.sendEvent) {
    // Auto-inject userId + estrategas_product_id so pipeline can fetch banners from DB
    const dropPageInput = {
      ...toolInput,
      user_id: opts.userId,
      estrategas_product_id: toolInput.estrategas_product_id || opts.lastLandingProductId,
    }
    return executeDropPagePipeline(dropPageInput as any, opts.dropPageClient, opts.sendEvent)
  }

  // EstrategasIA tools
  if (ESTRATEGAS_TOOLS.includes(toolName)) {
    if (opts.onExecuteEstrategasTool) {
      return opts.onExecuteEstrategasTool(toolName, toolInput)
    }
    return { success: false, error: 'EstrategasIA tools not configured' }
  }
  // DropPage tools
  if (toolName.startsWith('get_droppage_') || toolName.startsWith('create_droppage_') || toolName.startsWith('update_droppage_') || toolName === 'associate_droppage_product_design') {
    if (opts.onExecuteDropPageTool) {
      return opts.onExecuteDropPageTool(toolName, toolInput)
    }
    return { success: false, error: 'DropPage tools not configured' }
  }
  // Internal product list
  if (toolName === 'get_my_products' && opts.onGetProducts) {
    try {
      const products = await opts.onGetProducts()
      return { success: true, data: products }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
  // Default: Meta Ads API
  return metaClient.executeTool(toolName, toolInput)
}

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

  // Route options — includes pipeline support
  const routeOpts: RouteOptions = {
    userId: opts.userId,
    lastLandingProductId: opts.lastLandingProductId,
    onExecuteEstrategasTool: opts.onExecuteEstrategasTool,
    onExecuteDropPageTool: opts.onExecuteDropPageTool,
    onGetProducts: opts.onGetProducts,
    estrategasTools: opts.estrategasToolsHandler,
    dropPageClient: opts.dropPageClientInstance,
    sendEvent,
  }

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++

    // Call Claude with tools — phase-aware tool pruning + prompt caching
    const validModels = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001']
    const selectedModel = opts.model && validModels.includes(opts.model) ? opts.model : 'claude-sonnet-4-6'

    // Detect conversation phase to send only relevant tools (saves ~40% tokens)
    const phase = detectPhase(currentMessages)
    const phaseTools = getToolsForPhase(phase)

    // Safety check: measure total message size and log for debugging
    const messagesJson = JSON.stringify(currentMessages)
    const systemSize = META_ADS_SYSTEM_PROMPT.length
    const toolsSize = JSON.stringify(phaseTools).length
    const messagesSize = messagesJson.length
    const totalChars = systemSize + toolsSize + messagesSize
    console.log(`[Executor] Iteration ${iterations}: system=${systemSize}, tools=${toolsSize}, messages=${messagesSize}, total=${totalChars} chars (~${Math.round(totalChars / 4)} tokens), phase=${phase}`)

    // If messages are enormous, find and log the largest content blocks
    if (messagesSize > 500000) {
      console.error(`[Executor] WARNING: messages are ${messagesSize} chars! Scanning for large blocks...`)
      for (let mi = 0; mi < currentMessages.length; mi++) {
        const msg = currentMessages[mi]
        const msgStr = JSON.stringify(msg)
        if (msgStr.length > 50000) {
          console.error(`[Executor] Message[${mi}] role=${msg.role} size=${msgStr.length} chars`)
          // Truncate this message's content to prevent the explosion
          if (Array.isArray(msg.content)) {
            for (let ci = 0; ci < (msg.content as any[]).length; ci++) {
              const block = (msg.content as any[])[ci]
              const blockStr = JSON.stringify(block)
              if (blockStr.length > 10000) {
                console.error(`[Executor] Message[${mi}].content[${ci}] type=${block.type} size=${blockStr.length} chars — TRUNCATING`)
                if (block.type === 'tool_use' && block.input) {
                  block.input = { _truncated: true, _original_size: blockStr.length }
                } else if (block.type === 'tool_result' && typeof block.content === 'string' && block.content.length > 4000) {
                  block.content = block.content.substring(0, 4000) + '... [truncated]'
                } else if (block.type === 'text' && typeof block.text === 'string' && block.text.length > 10000) {
                  block.text = block.text.substring(0, 5000) + `... [truncated from ${block.text.length} chars]`
                }
              }
            }
          } else if (typeof msg.content === 'string' && msg.content.length > 50000) {
            console.error(`[Executor] Message[${mi}] string content size=${msg.content.length} — TRUNCATING`)
            msg.content = msg.content.substring(0, 5000) + `... [truncated from ${(msg.content as string).length} chars]`
          }
        }
      }
      // Re-measure after truncation
      const newSize = JSON.stringify(currentMessages).length
      console.log(`[Executor] After emergency truncation: ${messagesSize} -> ${newSize} chars`)
    }

    const response = await anthropic.messages.create({
      model: selectedModel,
      max_tokens: 8192,
      // Prompt caching: system prompt + tools cached after first call (90% savings on input)
      system: [
        {
          type: 'text' as const,
          text: META_ADS_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      tools: phaseTools.map(t => ({
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

          const result = await routeToolExecution(toolName, toolInput, metaClient, routeOpts)

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
            content: truncateResult(result),
          })
          continue
        }

        // Read-only tool — execute immediately
        sendEvent({
          type: 'tool_start',
          data: { tool_name: toolName, tool_input: toolInput },
        })

        const result = await routeToolExecution(toolName, toolInput, metaClient, routeOpts)

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

// Execute a confirmed write action — routes to correct handler (including pipelines)
export async function executeConfirmedAction(
  metaAccessToken: string,
  toolName: string,
  toolInput: Record<string, any>,
  handlers?: {
    userId?: string
    lastLandingProductId?: string
    onExecuteEstrategasTool?: (toolName: string, toolInput: Record<string, any>) => Promise<{ success: boolean; data?: any; error?: string }>
    onExecuteDropPageTool?: (toolName: string, toolInput: Record<string, any>) => Promise<{ success: boolean; data?: any; error?: string }>
    estrategasTools?: import('./estrategas-tools').EstrategasToolsHandler
    dropPageClient?: import('./droppage-client').DropPageClient
    sendEvent?: (event: SSEEvent) => void
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  const metaClient = new MetaAPIClient({ accessToken: metaAccessToken })
  return routeToolExecution(toolName, toolInput, metaClient, handlers || {})
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
