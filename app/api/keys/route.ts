import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { encrypt, decrypt, mask } from '@/lib/services/encryption'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const reveal = searchParams.get('reveal') === 'true'

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('google_api_key, openai_api_key, kie_api_key, bfl_api_key, fal_api_key, wavespeed_api_key, elevenlabs_api_key, apify_api_key, browserless_api_key, cf_account_id, cf_access_key_id, cf_secret_access_key, cf_bucket_name, cf_public_url, publer_api_key, publer_workspace_id, meta_access_token, anthropic_api_key')
      .eq('id', user.id)
      .single()

    // If profile doesn't exist, return empty state (not an error)
    if (profileError || !profile) {
      return NextResponse.json({
        hasGoogleApiKey: false,
        hasOpenaiApiKey: false,
        hasKieApiKey: false,
        hasBflApiKey: false,
        hasFalApiKey: false,
        hasWavespeedApiKey: false,
        hasElevenlabsApiKey: false,
        hasApifyApiKey: false,
        hasBrowserlessApiKey: false,
        hasR2: false,
        r2AccountId: '',
        r2BucketName: '',
        r2PublicUrl: '',
        maskedR2AccessKeyId: '',
        hasR2AccessKeyId: false,
        maskedR2SecretAccessKey: '',
        hasR2SecretAccessKey: false,
        hasPubler: false,
      hasMetaAccessToken: false,
      hasAnthropicApiKey: false,
      })
    }

    // Safely decrypt non-secret fields
    const safeDecrypt = (key: string | null) => {
      try {
        return key ? decrypt(key) : ''
      } catch {
        return ''
      }
    }

    // Safely mask keys (catch any decryption errors)
    const safeMask = (key: string | null) => {
      try {
        return mask(key)
      } catch {
        return key ? '••••••••••••' : ''
      }
    }

    // Show key: masked or full depending on reveal param
    const showKey = (key: string | null) => {
      if (reveal) return safeDecrypt(key)
      return safeMask(key)
    }

    // Return masked keys
    return NextResponse.json({
      // Google/Gemini
      maskedGoogleApiKey: showKey(profile.google_api_key),
      hasGoogleApiKey: !!profile.google_api_key,
      // OpenAI
      maskedOpenaiApiKey: showKey(profile.openai_api_key),
      hasOpenaiApiKey: !!profile.openai_api_key,
      // KIE.ai
      maskedKieApiKey: showKey(profile.kie_api_key),
      hasKieApiKey: !!profile.kie_api_key,
      // BFL
      maskedBflApiKey: showKey(profile.bfl_api_key),
      hasBflApiKey: !!profile.bfl_api_key,
      // fal.ai
      maskedFalApiKey: showKey(profile.fal_api_key),
      hasFalApiKey: !!profile.fal_api_key,
      // WaveSpeed
      maskedWavespeedApiKey: showKey(profile.wavespeed_api_key),
      hasWavespeedApiKey: !!profile.wavespeed_api_key,
      // ElevenLabs
      maskedElevenlabsApiKey: showKey(profile.elevenlabs_api_key),
      hasElevenlabsApiKey: !!profile.elevenlabs_api_key,
      // Apify
      maskedApifyApiKey: showKey(profile.apify_api_key),
      hasApifyApiKey: !!profile.apify_api_key,
      // Browserless
      maskedBrowserlessApiKey: showKey(profile.browserless_api_key),
      hasBrowserlessApiKey: !!profile.browserless_api_key,
      // Cloudflare R2
      hasR2: !!profile.cf_account_id,
      r2AccountId: safeDecrypt(profile.cf_account_id),
      r2BucketName: safeDecrypt(profile.cf_bucket_name),
      r2PublicUrl: safeDecrypt(profile.cf_public_url),
      maskedR2AccessKeyId: showKey(profile.cf_access_key_id),
      hasR2AccessKeyId: !!profile.cf_access_key_id,
      maskedR2SecretAccessKey: showKey(profile.cf_secret_access_key),
      hasR2SecretAccessKey: !!profile.cf_secret_access_key,
      // Publer
      maskedPublerApiKey: showKey(profile.publer_api_key),
      publerWorkspaceId: safeDecrypt(profile.publer_workspace_id),
      hasPubler: !!(profile.publer_api_key && profile.publer_workspace_id),
      // Meta Ads
      maskedMetaAccessToken: showKey(profile.meta_access_token),
      hasMetaAccessToken: !!profile.meta_access_token,
      // Anthropic
      maskedAnthropicApiKey: showKey(profile.anthropic_api_key),
      hasAnthropicApiKey: !!profile.anthropic_api_key,
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
    const { googleApiKey, openaiApiKey, kieApiKey, bflApiKey, falApiKey, wavespeedApiKey, elevenlabsApiKey, apifyApiKey, browserlessApiKey, cfAccountId, cfAccessKeyId, cfSecretAccessKey, cfBucketName, cfPublicUrl, publerApiKey, publerWorkspaceId, metaAccessToken, anthropicApiKey } = body

    // Build update object with only provided keys
    const updateData: Record<string, string | null> = {}

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
      if (falApiKey) {
        updateData.fal_api_key = encrypt(falApiKey)
      }
      if (wavespeedApiKey) {
        updateData.wavespeed_api_key = encrypt(wavespeedApiKey)
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
      // Cloudflare R2
      if (cfAccountId) {
        updateData.cf_account_id = encrypt(cfAccountId)
      }
      if (cfAccessKeyId) {
        updateData.cf_access_key_id = encrypt(cfAccessKeyId)
      }
      if (cfSecretAccessKey) {
        updateData.cf_secret_access_key = encrypt(cfSecretAccessKey)
      }
      if (cfBucketName) {
        updateData.cf_bucket_name = encrypt(cfBucketName)
      }
      if (cfPublicUrl) {
        updateData.cf_public_url = encrypt(cfPublicUrl)
      }
      // Publer
      if (publerApiKey) {
        updateData.publer_api_key = encrypt(publerApiKey)
      }
      if (publerWorkspaceId !== undefined) {
        updateData.publer_workspace_id = publerWorkspaceId ? encrypt(publerWorkspaceId) : null
      }
      // Meta Ads
      if (metaAccessToken) {
        updateData.meta_access_token = encrypt(metaAccessToken)
      }
      if (anthropicApiKey) {
        updateData.anthropic_api_key = encrypt(anthropicApiKey)
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
