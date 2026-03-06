export const runtime = 'edge'

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url')
  if (!url) {
    return new Response('URL required', { status: 400 })
  }

  try {
    const resp = await fetch(url)
    if (!resp.ok) {
      return new Response(`Failed to fetch: ${resp.status}`, { status: resp.status })
    }

    return new Response(resp.body, {
      headers: {
        'Content-Type': resp.headers.get('Content-Type') || 'video/mp4',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error: any) {
    return new Response(`Fetch error: ${error.message}`, { status: 500 })
  }
}
