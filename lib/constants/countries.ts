// Countries supported for banner generation

export interface Country {
  code: string
  name: string
  currency: string
  currencySymbol: string
  flag: string
  region: 'europe' | 'north-america'
}

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
  ...EUROPE_COUNTRIES,
  ...NORTH_AMERICA_COUNTRIES,
]

export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code)
}

export function getDefaultCountry(): Country {
  return COUNTRIES[0] // España
}

export function getCountriesByRegion(region: Country['region']): Country[] {
  return COUNTRIES.filter((c) => c.region === region)
}
