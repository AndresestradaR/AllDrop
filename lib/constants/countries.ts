// Countries supported for banner generation

export interface Country {
  code: string
  name: string
  currency: string
  currencySymbol: string
  flag: string
  region: 'latam' | 'europe' | 'north-america'
}

// LATAM countries
const LATAM_COUNTRIES: Country[] = [
  { code: 'CO', name: 'Colombia', currency: 'COP', currencySymbol: '$', flag: '🇨🇴', region: 'latam' },
  { code: 'MX', name: 'México', currency: 'MXN', currencySymbol: '$', flag: '🇲🇽', region: 'latam' },
  { code: 'PA', name: 'Panamá', currency: 'USD', currencySymbol: '$', flag: '🇵🇦', region: 'latam' },
  { code: 'EC', name: 'Ecuador', currency: 'USD', currencySymbol: '$', flag: '🇪🇨', region: 'latam' },
  { code: 'PE', name: 'Perú', currency: 'PEN', currencySymbol: 'S/', flag: '🇵🇪', region: 'latam' },
  { code: 'CL', name: 'Chile', currency: 'CLP', currencySymbol: '$', flag: '🇨🇱', region: 'latam' },
  { code: 'PY', name: 'Paraguay', currency: 'PYG', currencySymbol: '₲', flag: '🇵🇾', region: 'latam' },
  { code: 'AR', name: 'Argentina', currency: 'ARS', currencySymbol: '$', flag: '🇦🇷', region: 'latam' },
  { code: 'GT', name: 'Guatemala', currency: 'GTQ', currencySymbol: 'Q', flag: '🇬🇹', region: 'latam' },
]

// European countries
const EUROPE_COUNTRIES: Country[] = [
  { code: 'ES', name: 'España', currency: 'EUR', currencySymbol: '€', flag: '🇪🇸', region: 'europe' },
  { code: 'FR', name: 'Francia', currency: 'EUR', currencySymbol: '€', flag: '🇫🇷', region: 'europe' },
  { code: 'IT', name: 'Italia', currency: 'EUR', currencySymbol: '€', flag: '🇮🇹', region: 'europe' },
  { code: 'DE', name: 'Alemania', currency: 'EUR', currencySymbol: '€', flag: '🇩🇪', region: 'europe' },
  { code: 'PT', name: 'Portugal', currency: 'EUR', currencySymbol: '€', flag: '🇵🇹', region: 'europe' },
  { code: 'GB', name: 'Reino Unido', currency: 'GBP', currencySymbol: '£', flag: '🇬🇧', region: 'europe' },
]

// North America
const NORTH_AMERICA_COUNTRIES: Country[] = [
  { code: 'US', name: 'Estados Unidos', currency: 'USD', currencySymbol: '$', flag: '🇺🇸', region: 'north-america' },
]

export const COUNTRIES: Country[] = [
  ...LATAM_COUNTRIES,
  ...EUROPE_COUNTRIES,
  ...NORTH_AMERICA_COUNTRIES,
]

export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code)
}

export function getDefaultCountry(): Country {
  return COUNTRIES[0] // Colombia
}

export function getCountriesByRegion(region: Country['region']): Country[] {
  return COUNTRIES.filter((c) => c.region === region)
}
