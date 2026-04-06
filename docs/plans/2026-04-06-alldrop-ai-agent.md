# AllDrop AI Agent — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an AI assistant agent to AllDrop (similar to Nikola in estrategasia.com) powered by OpenRouter with cheap models (Qwen/DeepSeek/Gemini cascade), available only for plans >= Pro (79€).

**Architecture:** SSE streaming chat endpoint using OpenAI SDK pointed at OpenRouter. Cascade of 3 models (Qwen 3.6 Plus free → DeepSeek V3.2 → Gemini 2.5 Flash). Reuses existing Supabase tables pattern from Meta Ads agent. User never sees/chooses the model — cascade is transparent.

**Tech Stack:** Next.js 14 App Router, OpenAI SDK (OpenRouter-compatible), Supabase (auth + DB + storage), SSE streaming, React client with EventSource.

---

## Context for Implementor

### Repos
- **alldrop-io**: `C:\Users\Asus\Downloads\alldrop-io-deploy\` — GitHub: `all-drop/alldrop-io`
- **DO NOT TOUCH**: `AndresestradaR/estrategas-landing-generator` or any other repo

### Existing Patterns to Follow
- Auth: `lib/supabase/server.ts` → `createClient()` + `supabase.auth.getUser()`
- Service client: `createServiceClient()` for admin ops (bypasses RLS)
- SSE streaming: See `app/api/meta-ads/chat/route.ts` for reference pattern
- Sidebar nav: `app/(dashboard)/layout.tsx` lines 51-74
- Plan check: `profiles.plan` column — values: `free`, `starter`, `pro`, `business`, `enterprise`
- Admin email: `infoalldrop@gmail.com` (hardcoded in layout.tsx:34)

### Critical Rules
- NEVER modify `lib/services/encryption.ts`
- NEVER modify `middleware.ts`
- NEVER modify `lib/services/ai-text.ts` (use separate OpenRouter client)
- Use `""` not `"/"` in API route paths
- All new tables need RLS policies with `auth.uid() = user_id`

### OpenRouter API
- Base URL: `https://openrouter.ai/api/v1`
- 100% OpenAI SDK compatible (chat.completions.create with tools/functions)
- Models: `qwen/qwen3.6-plus:free`, `deepseek/deepseek-chat-v3.2`, `google/gemini-2.5-flash`
- Env var: `OPENROUTER_API_KEY` (platform key, NOT per-user BYOK)
- Streaming: standard SSE via `stream: true`

---

## Task 1: Install OpenAI SDK + add env var

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Create: `.env.local` (add key locally)

**Step 1: Install openai package**

```bash
cd C:\Users\Asus\Downloads\alldrop-io-deploy
npm install openai
```

**Step 2: Add env var to .env.example**

Add to `.env.example`:
```env
# OpenRouter (AI Agent)
OPENROUTER_API_KEY=
```

**Step 3: Add actual key to .env.local**

Add `OPENROUTER_API_KEY=sk-or-v1-xxxxx` to `.env.local` (get from https://openrouter.ai/settings/keys)

**Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "feat(agent): install openai SDK + add OPENROUTER_API_KEY env var"
```

---

## Task 2: Create OpenRouter client with cascade logic

**Files:**
- Create: `lib/agent/openrouter.ts`

**Step 1: Create the cascade client**

```typescript
// lib/agent/openrouter.ts
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
  onToolCall: (toolCall: { id: string; name: string; arguments: string }) => void
  onError: (error: string) => void
  onDone: (fullText: string, model: string) => void
}

export async function streamAgentResponse(
  messages: AgentMessage[],
  tools: OpenAI.Chat.Completions.ChatCompletionTool[] | undefined,
  callbacks: AgentStreamCallbacks,
): Promise<void> {
  const openai = getClient()
  let lastError = ''

  for (const model of MODELS) {
    try {
      const stream = await openai.chat.completions.create({
        model,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined,
        stream: true,
        max_tokens: 4096,
        temperature: 0.7,
      })

      let fullText = ''
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta
        if (!delta) continue

        // Text content
        if (delta.content) {
          fullText += delta.content
          callbacks.onDelta(delta.content)
        }

        // Tool calls
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.function?.name) {
              callbacks.onToolCall({
                id: tc.id || `call_${Date.now()}`,
                name: tc.function.name,
                arguments: tc.function.arguments || '',
              })
            }
          }
        }
      }

      callbacks.onDone(fullText, model)
      return // Success — don't try next model
    } catch (err: any) {
      lastError = err?.message || 'Unknown error'
      console.error(`[Agent] Model ${model} failed: ${lastError}`)
      // Continue to next model in cascade
    }
  }

  // All models failed
  callbacks.onError(`All models failed. Last error: ${lastError}`)
}
```

**Step 2: Commit**

```bash
git add lib/agent/openrouter.ts
git commit -m "feat(agent): OpenRouter client with Qwen→DeepSeek→Gemini cascade"
```

---

## Task 3: Create database migration for agent tables

**Files:**
- Create: `supabase/migrations/20260406_agent_chat.sql`

**Step 1: Write migration**

```sql
-- Agent conversations
CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_conversations_user ON agent_conversations(user_id);

ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own conversations" ON agent_conversations
  FOR ALL USING (auth.uid() = user_id);

-- Agent messages
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool_call', 'tool_result')),
  content TEXT,
  tool_name TEXT,
  tool_input JSONB,
  tool_result JSONB,
  tool_call_id TEXT,
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_messages_conv ON agent_messages(conversation_id);

ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own messages" ON agent_messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM agent_conversations WHERE user_id = auth.uid()
    )
  );
```

**Step 2: Run migration on Supabase**

Run this SQL in the Supabase SQL Editor at https://supabase.com/dashboard (project papfcbiswvdgalfteujm, or whichever project alldrop uses).

**Step 3: Commit**

```bash
git add supabase/migrations/20260406_agent_chat.sql
git commit -m "feat(agent): database migration for conversations + messages tables"
```

---

## Task 4: Create system prompt

**Files:**
- Create: `lib/agent/system-prompt.ts`

**Step 1: Write system prompt**

```typescript
// lib/agent/system-prompt.ts

export function buildSystemPrompt(userName?: string): string {
  const name = userName || 'there'
  
  return `# IDENTITY
You are the AllDrop AI Assistant — a senior marketing strategist specialized in dropshipping, product research, landing page creation, and online store optimization.

# PERSONALITY
- Professional but friendly
- Direct and actionable — no fluff
- You speak the user's language (detect from their messages and respond in the same language)
- You proactively suggest next steps
- You never execute actions without asking first

# CAPABILITIES
You help AllDrop users with:
1. **Product Research** — Finding winning products, analyzing competition, evaluating margins
2. **Landing Pages** — Writing compelling copy, structuring sections, choosing angles of attack
3. **Store Optimization** — Checkout flow, upsells/downsells, pricing strategies, trust elements
4. **Marketing Strategy** — Ad angles, target audiences, creative ideas, A/B testing suggestions
5. **Copywriting** — Headlines, descriptions, email sequences, ad copy in any language
6. **Cost Calculations** — Product costs, shipping, CPA, break-even analysis

# RULES
- ALWAYS respond in the same language the user writes in
- Be concise — short paragraphs, bullet points when helpful
- When suggesting copy or ad text, write it ready to use (not "you could write something like...")
- If the user asks about features that don't exist yet, say so honestly
- Never make up data or statistics
- For product research questions, ask about: niche, target country, budget, and margins

# GREETING
When starting a new conversation, greet ${name} briefly and ask how you can help today. Keep it to 1-2 sentences.`
}
```

**Step 2: Commit**

```bash
git add lib/agent/system-prompt.ts
git commit -m "feat(agent): system prompt for AllDrop AI assistant"
```

---

## Task 5: Create SSE chat API endpoint

**Files:**
- Create: `app/api/agent/chat/route.ts`

**Step 1: Write the chat endpoint**

```typescript
// app/api/agent/chat/route.ts
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { streamAgentResponse, type AgentMessage } from '@/lib/agent/openrouter'
import { buildSystemPrompt } from '@/lib/agent/system-prompt'

export const maxDuration = 60

// Plans that can access the agent (>= Pro)
const ALLOWED_PLANS = ['pro', 'business', 'enterprise']

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check plan
    const serviceClient = await createServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('plan, full_name')
      .eq('id', user.id)
      .single()

    if (!profile || !ALLOWED_PLANS.includes(profile.plan)) {
      return NextResponse.json(
        { error: 'Agent requires Pro plan or higher' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { conversation_id, message } = body as {
      conversation_id?: string
      message: string
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    // Get or create conversation
    let convId = conversation_id
    if (!convId) {
      const { data: conv, error: convErr } = await supabase
        .from('agent_conversations')
        .insert({ user_id: user.id, title: message.slice(0, 80) })
        .select('id')
        .single()
      if (convErr) throw convErr
      convId = conv.id
    }

    // Save user message
    await supabase.from('agent_messages').insert({
      conversation_id: convId,
      role: 'user',
      content: message,
    })

    // Load conversation history (last 40 messages for context)
    const { data: history } = await supabase
      .from('agent_messages')
      .select('role, content, tool_name, tool_input, tool_result, tool_call_id')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(40)

    // Build messages array for OpenAI format
    const messages: AgentMessage[] = [
      { role: 'system', content: buildSystemPrompt(profile.full_name) },
    ]

    for (const msg of (history || [])) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content || '' })
      }
      // Tool messages can be added later when tools are implemented
    }

    // SSE stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: any) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: event, ...data })}\n\n`)
          )
        }

        // Send conversation_id first (for new conversations)
        send('conversation_id', { conversation_id: convId })

        await streamAgentResponse(messages, undefined, {
          onDelta: (text) => send('delta', { text }),
          onToolCall: (tc) => send('tool_call', tc),
          onError: (error) => send('error', { error }),
          onDone: async (fullText, model) => {
            // Save assistant response
            await supabase.from('agent_messages').insert({
              conversation_id: convId,
              role: 'assistant',
              content: fullText,
              model_used: model,
            })
            // Update conversation timestamp
            await supabase
              .from('agent_conversations')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', convId)

            send('done', { model })
            controller.close()
          },
        })
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err: any) {
    console.error('[Agent Chat]', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add app/api/agent/chat/route.ts
git commit -m "feat(agent): SSE chat endpoint with plan gating (pro+)"
```

---

## Task 6: Create conversations API (list + delete)

**Files:**
- Create: `app/api/agent/conversations/route.ts`

**Step 1: Write the conversations endpoint**

```typescript
// app/api/agent/conversations/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('agent_conversations')
    .select('id, title, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('agent_conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

**Step 2: Create messages endpoint**

```typescript
// app/api/agent/conversations/[id]/messages/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify conversation belongs to user
  const { data: conv } = await supabase
    .from('agent_conversations')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('agent_messages')
    .select('id, role, content, model_used, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

**Step 3: Commit**

```bash
git add app/api/agent/conversations/route.ts app/api/agent/conversations/\[id\]/messages/route.ts
git commit -m "feat(agent): conversations list/delete + messages API"
```

---

## Task 7: Create agent chat UI page

**Files:**
- Create: `app/(dashboard)/dashboard/agent/page.tsx`

**Step 1: Write the chat page**

This is the main UI component. It includes:
- Left sidebar: conversation list + "New conversation" button
- Right pane: chat messages + input
- SSE listener for streaming responses
- Markdown rendering for assistant messages
- Plan gate (shows upgrade prompt if not Pro+)

The component should follow the same visual style as the rest of AllDrop (dark theme, purple/teal accents).

Key behaviors:
- On load: fetch conversations from `GET /api/agent/conversations`
- On select conversation: fetch messages from `GET /api/agent/conversations/{id}/messages`
- On send message: POST to `/api/agent/chat` with SSE EventSource
- Stream text chunks into current message bubble
- Auto-scroll to bottom on new messages
- Show "typing" indicator while streaming
- "New conversation" clears chat and creates new on first message

Use `useI18n()` for ALL UI text — add translation keys to `lib/i18n/translations.ts` for all 6 languages.

**Translation keys needed (add to all 6 languages under `agent` section):**
```
agent.title: "AI Assistant" / "Assistant IA" / "Assistent IA" / ...
agent.newConversation: "New conversation" / "Nueva conversación" / ...
agent.placeholder: "Type your message..." / "Escribe tu mensaje..." / ...
agent.sending: "Sending..." / "Enviando..." / ...
agent.planRequired: "AI Assistant requires Pro plan or higher" / ...
agent.upgradePlan: "Upgrade Plan" / ...
agent.noConversations: "No conversations yet" / ...
agent.deleteConfirm: "Delete this conversation?" / ...
agent.thinking: "Thinking..." / "Pensando..." / ...
```

**Step 2: Commit**

```bash
git add app/\(dashboard\)/dashboard/agent/page.tsx lib/i18n/translations.ts
git commit -m "feat(agent): chat UI page with SSE streaming + i18n"
```

---

## Task 8: Add agent to sidebar navigation

**Files:**
- Modify: `app/(dashboard)/layout.tsx`

**Step 1: Add agent nav item**

In the `creatorNavigation` array (around line 55), add:

```typescript
{ name: t.nav.agent || 'AI Assistant', href: '/dashboard/agent', icon: Bot, isNew: true },
```

Import `Bot` from `lucide-react` if not already imported.

**Step 2: Gate visibility by plan**

The agent nav item should only show if `profile.plan` is in `['pro', 'business', 'enterprise']`. Fetch user plan in the layout (it may already be fetched for other purposes).

If plan is free/starter, either:
- Hide the nav item entirely, OR
- Show it but with a lock icon, and the page shows an upgrade CTA

**Step 3: Add translation key**

Add to all 6 languages in `translations.ts`:
```
nav.agent: "AI Assistant" / "Asistente IA" / "Assistant IA" / ...
```

**Step 4: Commit**

```bash
git add app/\(dashboard\)/layout.tsx lib/i18n/translations.ts
git commit -m "feat(agent): add AI Assistant to sidebar nav (pro+ only)"
```

---

## Task 9: Add OPENROUTER_API_KEY to Vercel env vars

**Step 1: Get OpenRouter API key**

Go to https://openrouter.ai/settings/keys → Create key → Copy

**Step 2: Add to Vercel**

```bash
# Add to the correct Vercel team (all-drop-4612s-projects)
# This must be done via the Vercel dashboard since we don't have CLI access to that team
```

Go to: `vercel.com/all-drop-4612s-projects/alldrop-io/settings/environment-variables`
Add: `OPENROUTER_API_KEY` = `sk-or-v1-xxxxx` (all environments)

**Step 3: Also add $10 credits to OpenRouter**

Go to https://openrouter.ai/settings/credits → Add $10 to unlock 1,000 free requests/day limit.

---

## Task 10: Test end-to-end and deploy

**Step 1: Local test**

```bash
npm run dev
# Navigate to http://localhost:3000/dashboard/agent
# Send a message, verify SSE streaming works
# Check Supabase tables for conversation + message rows
```

**Step 2: Push to deploy**

```bash
git push origin main
# Verify deploy at vercel.com/all-drop-4612s-projects/alldrop-io
```

**Step 3: Production test**

- Open alldrop-io.vercel.app
- Log in with a Pro plan account
- Go to AI Assistant
- Send a message
- Verify streaming response
- Verify conversation persists on reload
- Test with free account → should show upgrade CTA

---

## Future Tasks (NOT in this plan)

These are intentionally deferred — do NOT implement now:

1. **Tool calling** — Add tools for product research, landing creation, cost calculator
2. **Agent configuration modal** — Name, personality, avatar customization
3. **Agent memory** — Remember insights across conversations
4. **Image/file uploads** — Send product photos to the agent
5. **Pending actions** — Confirmation workflow before executing actions
6. **Drop cost** — Charge drops per agent message (e.g., 1 drop/message)
7. **Usage analytics** — Track model usage, costs, errors per user

---

## Architecture Diagram

```
User (Pro+ plan)
    ↓
/dashboard/agent (React page)
    ↓ POST /api/agent/chat (SSE)
    ↓
Auth check (Supabase) → Plan check (profiles.plan)
    ↓
Load history (agent_messages table, last 40)
    ↓
Build messages array [system prompt + history + new message]
    ↓
streamAgentResponse() — cascade:
    ├─ 1. qwen/qwen3.6-plus:free     → if fails...
    ├─ 2. deepseek/deepseek-chat-v3.2 → if fails...
    └─ 3. google/gemini-2.5-flash     → last resort
    ↓
SSE stream → data: {"type":"delta","text":"..."}\n\n
    ↓
Save assistant message to agent_messages (model_used tracked)
    ↓
Client renders Markdown in real-time
```
