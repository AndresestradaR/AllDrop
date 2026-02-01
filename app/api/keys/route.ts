import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { encrypt, mask } from '@/lib/services/encryption'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('google_api_key, openai_api_key, kie_api_key, bfl_api_key, elevenlabs_api_key, apify_api_key, browserless_api_key')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    // Return masked keys
    return NextResponse.json({
      // Google/Gemini
      maskedGoogleApiKey: mask(profile.google_api_key),
      hasGoogleApiKey: !!profile.google_api_key,
      // OpenAI
      maskedOpenaiApiKey: mask(profile.openai_api_key),
      hasOpenaiApiKey: !!profile.openai_api_key,
      // KIE.ai
      maskedKieApiKey: mask(profile.kie_api_key),
      hasKieApiKey: !!profile.kie_api_key,
      // BFL
      maskedBflApiKey: mask(profile.bfl_api_key),
      hasBflApiKey: !!profile.bfl_api_key,
      // ElevenLabs
      maskedElevenlabsApiKey: mask(profile.elevenlabs_api_key),
      hasElevenlabsApiKey: !!profile.elevenlabs_api_key,
      // Apify
      maskedApifyApiKey: mask(profile.apify_api_key),
      hasApifyApiKey: !!profile.apify_api_key,
      // Browserless
      maskedBrowserlessApiKey: mask(profile.browserless_api_key),
      hasBrowserlessApiKey: !!profile.browserless_api_key,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { googleApiKey, openaiApiKey, kieApiKey, bflApiKey, elevenlabsApiKey, apifyApiKey, browserlessApiKey } = body

    // Build update object with only provided keys
    const updateData: Record<string, string> = {}

    if (googleApiKey) {
      updateData.google_api_key = encrypt(googleApiKey)
    }
    if (openaiApiKey) {
      updateData.openai_api_key = encrypt(openaiApiKey)
    }
    if (kieApiKey) {
      updateData.kie_api_key = encrypt(kieApiKey)
    }
    if (bflApiKey) {
      updateData.bfl_api_key = encrypt(bflApiKey)
    }
    if (elevenlabsApiKey) {
      updateData.elevenlabs_api_key = encrypt(elevenlabsApiKey)
    }
    if (apifyApiKey) {
      updateData.apify_api_key = encrypt(apifyApiKey)
    }
    if (browserlessApiKey) {
      updateData.browserless_api_key = encrypt(browserlessApiKey)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'API key requerida' }, { status: 400 })
    }

    // Use service client to update (bypasses RLS for update)
    const serviceClient = await createServiceClient()
    const { error: updateError } = await serviceClient
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Error al guardar key' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
