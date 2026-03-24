'use client'

import { Globe } from 'lucide-react'
import { COUNTRIES, Country, getCountriesByRegion } from '@/lib/constants/countries'
import { useI18n } from '@/lib/i18n'

interface CountrySelectorProps {
  value: string // country code
  onChange: (country: Country) => void
  disabled?: boolean
}

export default function CountrySelector({ value, onChange, disabled }: CountrySelectorProps) {
  const { t, countryName } = useI18n()

  const latam = getCountriesByRegion('latam')
  const europe = getCountriesByRegion('europe')
  const northAmerica = getCountriesByRegion('north-america')

  const renderGroup = (countries: Country[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
      {countries.map((country) => (
        <button
          key={country.code}
          type="button"
          disabled={disabled}
          onClick={() => onChange(country)}
          className={`
            flex items-center gap-2 p-3 rounded-xl border transition-all
            ${
              value === country.code
                ? 'border-accent bg-accent/10 ring-2 ring-accent/50'
                : 'border-border hover:border-accent/50 bg-background'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <span className="text-xl">{country.flag}</span>
          <div className="text-left">
            <p className="text-sm font-medium text-text-primary">{countryName(country.code)}</p>
            <p className="text-xs text-text-secondary">{country.currencySymbol}</p>
          </div>
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
        <Globe className="w-4 h-4 text-accent" />
        {t.country.targetCountry}
      </label>

      {/* LATAM */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-text-secondary/70 uppercase tracking-wider">LATAM</p>
        {renderGroup(latam)}
      </div>

      {/* Europe */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-text-secondary/70 uppercase tracking-wider">Europe</p>
        {renderGroup(europe)}
      </div>

      {/* North America */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-text-secondary/70 uppercase tracking-wider">North America</p>
        {renderGroup(northAmerica)}
      </div>
    </div>
  )
}

// Compact version for smaller spaces
export function CountrySelectorCompact({
  value,
  onChange,
  disabled,
}: CountrySelectorProps) {
  const { t, countryName } = useI18n()

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium text-text-primary">
        <Globe className="w-4 h-4 text-accent" />
        {t.country.country}
      </label>
      <select
        value={value}
        onChange={(e) => {
          const country = COUNTRIES.find((c) => c.code === e.target.value)
          if (country) onChange(country)
        }}
        disabled={disabled}
        className={`
          w-full px-4 py-3 bg-background border border-border rounded-xl
          text-text-primary appearance-none cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <optgroup label="LATAM">
          {getCountriesByRegion('latam').map((country) => (
            <option key={country.code} value={country.code}>
              {country.flag} {countryName(country.code)} ({country.currencySymbol})
            </option>
          ))}
        </optgroup>
        <optgroup label="Europe">
          {getCountriesByRegion('europe').map((country) => (
            <option key={country.code} value={country.code}>
              {country.flag} {countryName(country.code)} ({country.currencySymbol})
            </option>
          ))}
        </optgroup>
        <optgroup label="North America">
          {getCountriesByRegion('north-america').map((country) => (
            <option key={country.code} value={country.code}>
              {country.flag} {countryName(country.code)} ({country.currencySymbol})
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  )
}
