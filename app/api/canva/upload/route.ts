import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { CANVA_CONFIG } from '@/lib/canva/pkce'

interface AssetUploadResponse {
  job: {
    id: string
    status: 'in_progress' | 'success' | 'failed'
  }
}

interface AssetJobResponse {
  job: {
    id: string
    status: 'in_progress' | 'success' | 'failed'
    asset?: {
      id: string
      name: string
    }
    error?: {
      code: string
      message: string
    }
  }
}

interface CreateDesignResponse {
  design: {
    id: string
    urls: {
      edit_url: string
      view_url: string
    }
  }
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const clientId = process.env.CANVA_CLIENT_ID!
  const clientSecret = process.env.CANVA_CLIENT_SECRET!

  const response = await fetch(CANVA_CONFIG.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    throw new Error('Token refresh failed')
  }

  return response.json()
}

async function resolveImageBuffer(imageBase64?: string, imageUrl?: string): Promise<Buffer> {
  if (imageUrl) {
    const res = await fetch(imageUrl)
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)
    const arrayBuf = await res.arrayBuffer()
    return Buffer.from(arrayBuf)
  }
  if (imageBase64) {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    return Buffer.from(base64Data, 'base64')
  }
  throw new Error('No image data provided')
}

async function uploadAsset(
  accessToken: string,
  imageBuffer: Buffer,
  filename: string
): Promise<string> {

  // Start asset upload
  const uploadResponse = await fetch(CANVA_CONFIG.assetUploadEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Asset-Upload-Metadata': JSON.stringify({
        name_base64: Buffer.from(filename).toString('base64'),
      }),
    },
    body: new Uint8Array(imageBuffer),
  })

  if (!uploadResponse.ok) {
    const error = await uploadResponse.text()
    throw new Error(`Asset upload failed: ${error}`)
  }

  const uploadData: AssetUploadResponse = await uploadResponse.json()
  const jobId = uploadData.job.id

  // Poll for job completion
  let attempts = 0
  const maxAttempts = 30

  while (attempts < maxAttempts) {
    const statusResponse = await fetch(
      `${CANVA_CONFIG.assetUploadEndpoint}/${jobId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!statusResponse.ok) {
      throw new Error('Failed to check upload status')
    }

    const statusData: AssetJobResponse = await statusResponse.json()

    if (statusData.job.status === 'success' && statusData.job.asset) {
      return statusData.job.asset.id
    }

    if (statusData.job.status === 'failed') {
      throw new Error(statusData.job.error?.message || 'Upload failed')
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
    attempts++
  }

  throw new Error('Upload timed out')
}

async function createDesignWithAsset(
  accessToken: string,
  assetId: string,
  title: string
): Promise<string> {
  // Canva API requires design_type to be an object with type and dimensions
  // For stories format: 1080x1920
  const response = await fetch(CANVA_CONFIG.designEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      design_type: {
        type: 'custom',
        width: 1080,
        height: 1920,
      },
      asset_id: assetId,
      title: title,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Design creation failed: ${error}`)
  }

  const data: CreateDesignResponse = await response.json()
  return data.design.urls.edit_url
}

export async function POST(request: Request) {
  try {
    const { imageBase64, imageUrl, sectionId, productName } = await request.json()

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json(
        { error: 'No image data provided' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    let accessToken = cookieStore.get('canva_access_token')?.value
    const refreshToken = cookieStore.get('canva_refresh_token')?.value

    // Check if we need to refresh the token
    if (!accessToken && refreshToken) {
      try {
        const newTokens = await refreshAccessToken(refreshToken)
        accessToken = newTokens.access_token

        // Update cookies with new tokens
        cookieStore.set('canva_access_token', newTokens.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: newTokens.expires_in,
          path: '/',
        })

        if (newTokens.refresh_token) {
          cookieStore.set('canva_refresh_token', newTokens.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30,
            path: '/',
          })
        }
      } catch (refreshError) {
        return NextResponse.json(
          { error: 'Token expired', needsAuth: true },
          { status: 401 }
        )
      }
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated with Canva', needsAuth: true },
        { status: 401 }
      )
    }

    // Resolve image to Buffer (server-side fetch avoids CORS issues)
    const imageBuffer = await resolveImageBuffer(imageBase64, imageUrl)

    // Upload asset — Canva limits name to 50 chars (unencoded)
    const rawName = `${productName || 'banner'}-${Date.now()}`
    const filename = rawName.length > 46 ? rawName.slice(0, 46) + '.png' : rawName + '.png'
    const assetId = await uploadAsset(accessToken, imageBuffer, filename)

    // Create design with correct format
    const title = `Banner ${productName || 'Estrategas'}`
    const editUrl = await createDesignWithAsset(accessToken, assetId, title)

    return NextResponse.json({
      success: true,
      editUrl: editUrl,
    })
  } catch (error: any) {
    console.error('Canva upload error:', error)

    // Check if it's an auth error
    if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
      return NextResponse.json(
        { error: 'Authentication expired', needsAuth: true },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    )
  }
}
