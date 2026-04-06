import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = await createServiceClient()

    // Try to get existing config
    const { data: config, error } = await serviceClient
      .from('agent_config')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code === 'PGRST116') {
      // Not found — create default
      const { data: newConfig, error: insertError } = await serviceClient
        .from('agent_config')
        .insert({
          user_id: user.id,
          agent_name: 'AllDrop Assistant',
          personality: 'professional',
        })
        .select('*')
        .single()

      if (insertError) {
        console.error('[AgentConfig] Failed to create default config:', insertError)
        return NextResponse.json({ error: 'Failed to create config' }, { status: 500 })
      }

      return NextResponse.json(newConfig)
    }

    if (error) {
      console.error('[AgentConfig] Failed to fetch config:', error)
      return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 })
    }

    return NextResponse.json(config)
  } catch (error: any) {
    console.error('[AgentConfig] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { agent_name, personality, custom_instructions, agent_avatar_url } = body as {
      agent_name?: string
      personality?: string
      custom_instructions?: string
      agent_avatar_url?: string
    }

    // Validate
    if (agent_name && agent_name.length > 30) {
      return NextResponse.json({ error: 'Agent name must be 30 characters or less' }, { status: 400 })
    }

    const validPersonalities = ['professional', 'friendly', 'casual', 'custom']
    if (personality && !validPersonalities.includes(personality)) {
      return NextResponse.json({ error: 'Invalid personality' }, { status: 400 })
    }

    const serviceClient = await createServiceClient()

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
    if (agent_name !== undefined) updateData.agent_name = agent_name
    if (personality !== undefined) updateData.personality = personality
    if (custom_instructions !== undefined) updateData.custom_instructions = custom_instructions
    if (agent_avatar_url !== undefined) updateData.agent_avatar_url = agent_avatar_url

    const { data: config, error } = await serviceClient
      .from('agent_config')
      .upsert({
        user_id: user.id,
        ...updateData,
      }, { onConflict: 'user_id' })
      .select('*')
      .single()

    if (error) {
      console.error('[AgentConfig] Failed to upsert config:', error)
      return NextResponse.json({ error: 'Failed to save config' }, { status: 500 })
    }

    return NextResponse.json(config)
  } catch (error: any) {
    console.error('[AgentConfig] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
