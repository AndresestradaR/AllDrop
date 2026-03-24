'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useI18n, LOCALES } from '@/lib/i18n'
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'
import { Sparkles, ArrowLeft, Globe, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'

export const dynamic = 'force-dynamic'

type Step = 'email' | 'otp'

export default function LoginPage() {
  const router = useRouter()
  const { t, locale, setLocale } = useI18n()
  const [step, setStep] = useState<Step>('email')
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [langOpen, setLangOpen] = useState(false)

  const currentLocale = LOCALES.find(l => l.code === locale)

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      toast.error(t.login.enterEmailError)
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
        toast.error(data.error || t.login.verifyEmailError)
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

      toast.success(t.login.codeSent)
      setStep('otp')
    } catch (error) {
      toast.error(t.login.sendError)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!otp.trim()) {
      toast.error(t.login.enterCodeError)
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
        toast.error(t.login.invalidCode)
        return
      }

      toast.success(t.login.welcomeBack)
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      toast.error(t.login.verifyError)
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

      toast.success(t.login.codeResent)
    } catch (error) {
      toast.error(t.login.resendError)
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
                <CardTitle className="text-2xl">{t.login.welcome}</CardTitle>
                <CardDescription>
                  {t.login.enterEmail}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <Input
                    type="email"
                    label={t.login.emailLabel}
                    placeholder={t.login.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                  <Button type="submit" className="w-full" isLoading={isLoading}>
                    {t.login.sendCode}
                  </Button>
                </form>

                <p className="text-center text-xs text-text-secondary mt-6">
                  {t.login.membersOnly}
                </p>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">{t.login.enterCode}</CardTitle>
                <CardDescription>
                  {t.login.sentCodeTo}<br />
                  <span className="text-text-primary font-medium">{email}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <Input
                    type="text"
                    label={t.login.codeLabel}
                    placeholder={t.login.codePlaceholder}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    className="text-center text-xl tracking-widest"
                  />
                  <Button type="submit" className="w-full" isLoading={isLoading}>
                    {t.login.verifyCode}
                  </Button>
                </form>

                <div className="flex items-center justify-between mt-6">
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {t.login.changeEmail}
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={isLoading}
                    className="text-sm text-accent hover:text-accent-hover transition-colors disabled:opacity-50"
                  >
                    {t.login.resendCode}
                  </button>
                </div>
              </CardContent>
            </>
          )}
        </Card>

        {/* Language selector at bottom of login */}
        <div className="flex justify-center mt-6">
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span>{currentLocale?.flag} {currentLocale?.name}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
            </button>

            {langOpen && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-surface border border-border rounded-lg shadow-xl overflow-hidden min-w-[160px]">
                {LOCALES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLocale(l.code)
                      setLangOpen(false)
                    }}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm transition-colors ${
                      locale === l.code
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'text-text-secondary hover:text-text-primary hover:bg-border/50'
                    }`}
                  >
                    <span className="text-base">{l.flag}</span>
                    {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
