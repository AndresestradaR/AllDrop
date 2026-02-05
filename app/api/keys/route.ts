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

    // If profile doesn't exist, return empty state (not an error)
    if (profileError || !profile) {
      return NextResponse.json({
        hasGoogleApiKey: false,
        hasOpenaiApiKey: false,
        hasKieApiKey: false,
        hasBflApiKey: false,
        hasElevenlabsApiKey: false,
        hasApifyApiKey: false,
        hasBrowserlessApiKey: false,
      })
    }

    // Safely mask keys (catch any decryption errors)
    const safeMask = (key: string | null) => {
      try {
        return mask(key)
      } catch {
        return key ? '••••••••••••' : ''
      }
    }

    // Return masked keys
    return NextResponse.json({
      // Google/Gemini
      maskedGoogleApiKey: safeMask(profile.google_api_key),
      hasGoogleApiKey: !!profile.google_api_key,
      // OpenAI
      maskedOpenaiApiKey: safeMask(profile.openai_api_key),
      hasOpenaiApiKey: !!profile.openai_api_key,
      // KIE.ai
      maskedKieApiKey: safeMask(profile.kie_api_key),
      hasKieApiKey: !!profile.kie_api_key,
      // BFL
      maskedBflApiKey: safeMask(profile.bfl_api_key),
      hasBflApiKey: !!profile.bfl_api_key,
      // ElevenLabs
      maskedElevenlabsApiKey: safeMask(profile.elevenlabs_api_key),
      hasElevenlabsApiKey: !!profile.elevenlabs_api_key,
      // Apify
      maskedApifyApiKey: safeMask(profile.apify_api_key),
      hasApifyApiKey: !!profile.apify_api_key,
      // Browserless
      maskedBrowserlessApiKey: safeMask(profile.browserless_api_key),
      hasBrowserlessApiKey: !!profile.browserless_api_key,
    })
  } catch (error: any) {
    console.error('GET /api/keys error:', error)
    return NextResponse.json({ error: `Error interno: ${error.message}` }, { status: 500 })
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

    try {
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
    } catch (encryptError: any) {
      console.error('Encryption error:', encryptError)
      return NextResponse.json({ error: `Error de encriptación: ${encryptError.message}` }, { status: 500 })
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'API key requerida' }, { status: 400 })
    }

    // Use service client to update (bypasses RLS for update)
    const serviceClient = await createServiceClient()

    // First check if profile exists
    const { data: existingProfile, error: selectError } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      console.error('Select error:', selectError)
      return NextResponse.json({ error: `Error al buscar perfil: ${selectError.message}` }, { status: 500 })
    }

    if (!existingProfile) {
      // Profile doesn't exist, create it
      const { error: insertError } = await serviceClient
        .from('profiles')
        .insert({ id: user.id, ...updateData })

      if (insertError) {
        console.error('Insert error:', insertError)
        return NextResponse.json({ error: `Error al crear perfil: ${insertError.message}` }, { status: 500 })
      }
    } else {
      // Profile exists, update it
      const { error: updateError } = await serviceClient
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)

      if (updateError) {
        console.error('Update error:', updateError)
        return NextResponse.json({ error: `Error al guardar: ${updateError.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({ error: `Error interno: ${error.message}` }, { status: 500 })
  }
}
