'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import translations, { Locale, LOCALES, countryNames } from './translations'

type Translations = typeof translations.es

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Translations
  countryName: (code: string) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

const STORAGE_KEY = 'alldrop-locale'

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'es'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && translations[stored as Locale]) return stored as Locale
  // Try browser language
  const browserLang = navigator.language.slice(0, 2) as Locale
  if (translations[browserLang]) return browserLang
  return 'es'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('es')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setLocaleState(getInitialLocale())
    setMounted(true)
  }, [])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem(STORAGE_KEY, newLocale)
    document.documentElement.lang = newLocale
  }, [])

  const t = translations[locale]

  const countryName = useCallback((code: string) => {
    return countryNames[locale]?.[code] || code
  }, [locale])

  // Avoid hydration mismatch by using 'es' until mounted
  const value: I18nContextType = {
    locale: mounted ? locale : 'es',
    setLocale,
    t: mounted ? t : translations.es,
    countryName,
  }

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}

export { LOCALES }
export type { Locale }
