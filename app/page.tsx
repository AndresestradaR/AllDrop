import type { Metadata } from 'next'
import AllDropLanding from '@/components/alldrop-landing'

export const metadata: Metadata = {
  title: 'AllDrop — Proximamente',
  description: 'AllDrop - La suite definitiva para dropshippers en Europa. Product Research, Creativos IA, Landings y mas. Proximamente.',
  icons: {
    icon: [
      { url: '/alldrop/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/alldrop/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/alldrop/images/apple-touch-icon.png',
  },
}

export default function HomePage() {
  return <AllDropLanding />
}
