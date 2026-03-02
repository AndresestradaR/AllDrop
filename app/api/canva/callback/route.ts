import { NextResponse } from 'next/server'
import { decryptState, CANVA_CONFIG } from '@/lib/canva/pkce'

interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  scope: string
}

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<TokenResponse> {
  const clientId = process.env.CANVA_CLIENT_ID!
  const clientSecret = process.env.CANVA_CLIENT_SECRET!

  const response = await fetch(CANVA_CONFIG.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  return response.json()
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle OAuth errors from Canva
  if (error) {
    console.error('Canva OAuth error:', error, errorDescription)
    return NextResponse.redirect(
      `${origin}/dashboard?canva_error=${encodeURIComponent(errorDescription || error)}`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${origin}/dashboard?canva_error=missing_params`
    )
  }

  // Decrypt the state to recover code_verifier + returnUrl (no cookies needed)
  const stateData = decryptState(state)
  if (!stateData) {
    console.error('Canva callback: failed to decrypt state (expired or tampered)')
    return NextResponse.redirect(
      `${origin}/dashboard?canva_error=invalid_state`
    )
  }

  const { codeVerifier, returnUrl } = stateData

  try {
    const redirectUri = process.env.CANVA_REDIRECT_URI || 'https://estrategas-landing-generator.vercel.app/api/canva/callback'

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUri)

    // Build redirect — go back to the page the user was on
    const redirectResponse = NextResponse.redirect(
      `${origin}${returnUrl}${returnUrl.includes('?') ? '&' : '?'}canva_success=true`
    )

    const secureCookie = process.env.NODE_ENV === 'production'

    // Store tokens in cookies for future API calls
    redirectResponse.cookies.set('canva_access_token', tokens.access_token, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'lax',
      maxAge: tokens.expires_in,
      path: '/',
    })

    redirectResponse.cookies.set('canva_refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })

    return redirectResponse
  } catch (err: any) {
    console.error('Canva callback error:', err)
    return NextResponse.redirect(
      `${origin}/dashboard?canva_error=${encodeURIComponent(err.message)}`
    )
  }
}
