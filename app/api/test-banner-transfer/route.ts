// TEST ENDPOINT: Transfer banners from landing_sections to a DropPage page_design
// Usage: GET /api/test-banner-transfer?productId=xxx&designId=yyy&supabaseToken=zzz
// This bypasses Matías entirely — tests ONLY the banner → DropPage transfer

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 120

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('productId')
  const designId = searchParams.get('designId')
  const supabaseToken = searchParams.get('supabaseToken')

  if (!productId) {
    return NextResponse.json({ error: 'productId required' }, { status: 400 })
  }

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Step 1: Fetch banners from landing_sections
  const { data: sections, error: sectionsError } = await serviceClient
    .from('landing_sections')
    .select('id, generated_image_url, section_type, status')
    .eq('product_id', productId)
    .eq('status', 'completed')
    .order('created_at', { ascending: true })

  if (sectionsError) {
    return NextResponse.json({ error: 'DB error: ' + sectionsError.message }, { status: 500 })
  }

  if (!sections?.length) {
    return NextResponse.json({ error: 'No banners found for this product', productId }, { status: 404 })
  }

  // Step 2: Convert base64 to Storage URLs
  const resolvedUrls: string[] = []
  const log: string[] = []
  log.push(`Found ${sections.length} banners`)

  for (let i = 0; i < sections.length; i++) {
    const imgData = sections[i].generated_image_url
    const sectionType = sections[i].section_type || 'unknown'

    if (!imgData) {
      log.push(`  ${i} (${sectionType}): SKIP - no image data`)
      continue
    }

    if (imgData.startsWith('http')) {
      resolvedUrls.push(imgData)
      log.push(`  ${i} (${sectionType}): already URL`)
    } else if (imgData.startsWith('data:')) {
      try {
        const base64Match = imgData.match(/^data:[^;]+;base64,(.+)$/)
        if (!base64Match) {
          log.push(`  ${i} (${sectionType}): SKIP - invalid base64 format`)
          continue
        }
        const buffer = Buffer.from(base64Match[1], 'base64')
        const fileName = `imports/test-transfer/${Date.now()}-${i}.webp`
        const { error: upErr } = await serviceClient.storage
          .from('landing-images')
          .upload(fileName, buffer, { contentType: 'image/webp', upsert: true })

        if (upErr) {
          log.push(`  ${i} (${sectionType}): UPLOAD FAILED - ${upErr.message}`)
        } else {
          const { data: urlData } = serviceClient.storage.from('landing-images').getPublicUrl(fileName)
          resolvedUrls.push(urlData.publicUrl)
          log.push(`  ${i} (${sectionType}): uploaded OK`)
        }
      } catch (e: any) {
        log.push(`  ${i} (${sectionType}): ERROR - ${e.message}`)
      }
    } else {
      log.push(`  ${i} (${sectionType}): SKIP - unknown format: ${imgData.substring(0, 30)}`)
    }
  }

  log.push(`\nResolved ${resolvedUrls.length} URLs`)

  if (resolvedUrls.length === 0) {
    return NextResponse.json({ error: 'No URLs resolved', log }, { status: 500 })
  }

  // Step 3: Build grapesjs_data
  const imageComponents = resolvedUrls.map((url, i) => ({
    type: 'image',
    tagName: 'img',
    attributes: { src: url, alt: `Section ${i + 1}` },
    style: { width: '100%', 'max-width': '100%', display: 'block', margin: '0 auto' },
  }))

  const grapesjs_data = {
    pages: [{
      id: 'page-1',
      frames: [{
        id: 'frame-1',
        component: {
          type: 'wrapper',
          components: imageComponents,
        },
      }],
    }],
    assets: resolvedUrls.map(url => ({ src: url, type: 'image' })),
    styles: [],
  }

  log.push(`Built grapesjs_data: ${imageComponents.length} components`)

  // Step 4: If designId provided, update via DropPage API using cookie-based auth from the user's session
  if (designId) {
    const DROPPAGE_API = process.env.NEXT_PUBLIC_DROPPAGE_API_URL || 'https://shopiestrategas-production.up.railway.app'

    // Use Supabase auth from cookies to get a DropPage JWT via SSO
    const { createClient: createAuthClient } = await import('@/lib/supabase/server')
    const authClient = await createAuthClient()
    const { data: { session } } = await authClient.auth.getSession()

    if (!session?.access_token) {
      log.push('No Supabase session — user must be logged in')
      return NextResponse.json({ error: 'Not logged in', log }, { status: 401 })
    }

    // SSO: exchange Supabase token for DropPage JWT
    const ssoRes = await fetch(`${DROPPAGE_API}/api/auth/sso/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: session.access_token }),
    })

    if (!ssoRes.ok) {
      log.push('SSO FAILED: ' + (await ssoRes.text()).substring(0, 200))
      return NextResponse.json({ error: 'SSO failed', log }, { status: 401 })
    }

    const ssoData = await ssoRes.json()
    const jwt = ssoData.access_token
    log.push('SSO OK — got DropPage JWT')

    // Update page_design
    const updatePayload = {
      grapesjs_data,
      html_content: resolvedUrls
        .map(url => `<img src="${url}" style="width:100%;max-width:100%;display:block;margin:0 auto;" />`)
        .join('\n'),
      css_content: 'body{margin:0;padding:0;} img{max-width:100%;}',
      is_published: true,
    }

    log.push(`Sending PUT to ${DROPPAGE_API}/api/admin/page-designs/${designId}`)
    log.push(`Payload size: ${JSON.stringify(updatePayload).length} chars`)

    const updateRes = await fetch(`${DROPPAGE_API}/api/admin/page-designs/${designId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
      },
      body: JSON.stringify(updatePayload),
    })

    const updateBody = await updateRes.text()
    log.push(`Update response: ${updateRes.status} ${updateBody.substring(0, 300)}`)

    if (updateRes.ok) {
      log.push('\n✅ SUCCESS — reload the constructor page to see the banners')
    } else {
      log.push('\n❌ FAILED to update page_design')
    }
  } else {
    log.push('\nDry run — no designId. Add &designId=xxx to update a page_design')
  }

  return NextResponse.json({
    productId,
    designId: designId || null,
    bannersFound: sections.length,
    urlsResolved: resolvedUrls.length,
    grapesjs_components: imageComponents.length,
    firstUrl: resolvedUrls[0]?.substring(0, 100),
    log,
  })
}
