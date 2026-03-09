import { NextResponse } from 'next/server'
import { generateCodeVerifier, generateCodeChallenge, encryptState, CANVA_CONFIG } from '@/lib/canva/pkce'

export async function GET(request: Request) {
  const clientId = process.env.CANVA_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: 'Canva client ID not configured' },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(request.url)
  const returnUrl = searchParams.get('returnUrl') || '/dashboard'

  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)

  // Encrypt code_verifier + returnUrl into the state parameter itself.
  // This eliminates cookie dependency — the callback decrypts the state to get everything.
  const state = encryptState(codeVerifier, returnUrl)

  const redirectUri = process.env.CANVA_REDIRECT_URI || 'https://estrategas-landing-generator.vercel.app/api/canva/callback'

  const authUrl = new URL(CANVA_CONFIG.authorizationEndpoint)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', CANVA_CONFIG.scopes)
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')

  return NextResponse.redirect(authUrl.toString())
}
