'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'
import { Sparkles, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

export const dynamic = 'force-dynamic'

type Step = 'email' | 'otp'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim()) {
      toast.error('Ingresa tu correo')
      return
    }

    setIsLoading(true)

    try {
      // Verificar si el email está permitido
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Error al verificar email')
        return
      }

      // Email permitido, enviar OTP
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
        },
      })

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success('¡Código enviado! Revisa tu correo')
      setStep('otp')
    } catch (error) {
      toast.error('Error al enviar código')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!otp.trim()) {
      toast.error('Ingresa el código')
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: 'email',
      })

      if (error) {
        toast.error('Código inválido o expirado')
        return
      }

      toast.success('¡Bienvenido!')
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      toast.error('Error al verificar código')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
      })

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success('Código reenviado')
    } catch (error) {
      toast.error('Error al reenviar')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src="/images/logo.png" alt="AllDrop" className="w-10 h-10 object-contain" />
          <span className="text-2xl font-bold" style={{ background: 'linear-gradient(135deg, #00f0ff, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AllDrop</span>
        </div>

        <Card>
          {step === 'email' ? (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Bienvenido</CardTitle>
                <CardDescription>
                  Ingresa tu correo para recibir un código de acceso
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <Input
                    type="email"
                    label="Correo electrónico"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                  <Button type="submit" className="w-full" isLoading={isLoading}>
                    Enviar código
                  </Button>
                </form>

                <p className="text-center text-xs text-text-secondary mt-6">
                  Solo miembros de AllDrop pueden acceder
                </p>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Ingresa el código</CardTitle>
                <CardDescription>
                  Enviamos un código a<br />
                  <span className="text-text-primary font-medium">{email}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <Input
                    type="text"
                    label="Código de verificación"
                    placeholder="Ingresa el código del correo"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    className="text-center text-xl tracking-widest"
                  />
                  <Button type="submit" className="w-full" isLoading={isLoading}>
                    Verificar código
                  </Button>
                </form>

                <div className="flex items-center justify-between mt-6">
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Cambiar correo
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={isLoading}
                    className="text-sm text-accent hover:text-accent-hover transition-colors disabled:opacity-50"
                  >
                    Reenviar código
                  </button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
