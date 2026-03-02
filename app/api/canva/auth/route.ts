import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { generateCodeVerifier, generateCodeChallenge, generateState, CANVA_CONFIG } from '@/lib/canva/pkce'

export async function GET(request: Request) {
  // Check for Canva credentials
  const clientId = process.env.CANVA_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: 'Canva client ID not configured' },
      { status: 500 }
    )
  }

  // Read optional returnUrl so we can redirect back after OAuth
  const { searchParams } = new URL(request.url)
  const returnUrl = searchParams.get('returnUrl')

  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)
  const state = generateState()

  // Build authorization URL
  const redirectUri = process.env.CANVA_REDIRECT_URI || 'https://estrategas-landing-generator.vercel.app/api/canva/callback'

  const authUrl = new URL(CANVA_CONFIG.authorizationEndpoint)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', CANVA_CONFIG.scopes)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')

  // Use NextResponse.redirect so we can set cookies on the response
  const response = NextResponse.redirect(authUrl.toString())

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  }

  response.cookies.set('canva_code_verifier', codeVerifier, cookieOpts)
  response.cookies.set('canva_state', state, cookieOpts)
  if (returnUrl) {
    response.cookies.set('canva_return_url', returnUrl, cookieOpts)
  }

  return response
}
