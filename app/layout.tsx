import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'Estrategas IA - Generador de Landings',
  description: 'Genera imágenes de producto profesionales con IA para tus landings de dropshipping',
  keywords: ['landing page', 'dropshipping', 'AI', 'product images', 'e-commerce'],
  authors: [{ name: 'Estrategas IA' }],
  openGraph: {
    title: 'Estrategas IA - Generador de Landings',
    description: 'Genera imágenes de producto profesionales con IA',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-background text-text-primary antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#121212',
              color: '#FFFFFF',
              border: '1px solid #262626',
              fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
              whiteSpace: 'pre-line' as const,
              maxWidth: '420px',
              lineHeight: '1.5',
            },
            success: {
              iconTheme: {
                primary: '#14b8a6',
                secondary: '#0a0a0a',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#0a0a0a',
              },
            },
          }}
        />
      </body>
    </html>
  )
}