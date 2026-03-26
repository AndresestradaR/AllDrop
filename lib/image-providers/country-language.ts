// Maps country codes to their language for banner text generation

export interface CountryLanguageInfo {
  countryName: string
  language: string
  languageInstruction: string
  region: string
}

const COUNTRY_LANGUAGE_MAP: Record<string, CountryLanguageInfo> = {
  // Europe
  ES: { countryName: 'Spain', language: 'Spanish', languageInstruction: 'ALL text in PERFECT SPANISH (European Spanish)', region: 'Europe' },
  FR: { countryName: 'France', language: 'French', languageInstruction: 'ALL text in PERFECT FRENCH. Headlines, benefits, CTAs — everything in French', region: 'Europe' },
  IT: { countryName: 'Italy', language: 'Italian', languageInstruction: 'ALL text in PERFECT ITALIAN. Headlines, benefits, CTAs — everything in Italian', region: 'Europe' },
  DE: { countryName: 'Germany', language: 'German', languageInstruction: 'ALL text in PERFECT GERMAN. Headlines, benefits, CTAs — everything in German', region: 'Europe' },
  PT: { countryName: 'Portugal', language: 'Portuguese', languageInstruction: 'ALL text in PERFECT EUROPEAN PORTUGUESE. Headlines, benefits, CTAs — everything in Portuguese', region: 'Europe' },
  GB: { countryName: 'United Kingdom', language: 'English', languageInstruction: 'ALL text in PERFECT BRITISH ENGLISH. Headlines, benefits, CTAs — everything in English', region: 'Europe' },
  // North America
  US: { countryName: 'United States', language: 'English', languageInstruction: 'ALL text in PERFECT AMERICAN ENGLISH. Headlines, benefits, CTAs — everything in English', region: 'North America' },
  // LATAM (legacy support)
  CO: { countryName: 'Colombia', language: 'Spanish', languageInstruction: 'ALL text in PERFECT SPANISH (Latin American)', region: 'LATAM' },
  MX: { countryName: 'Mexico', language: 'Spanish', languageInstruction: 'ALL text in PERFECT SPANISH (Latin American)', region: 'LATAM' },
  PA: { countryName: 'Panama', language: 'Spanish', languageInstruction: 'ALL text in PERFECT SPANISH (Latin American)', region: 'LATAM' },
  EC: { countryName: 'Ecuador', language: 'Spanish', languageInstruction: 'ALL text in PERFECT SPANISH (Latin American)', region: 'LATAM' },
  PE: { countryName: 'Peru', language: 'Spanish', languageInstruction: 'ALL text in PERFECT SPANISH (Latin American)', region: 'LATAM' },
  CL: { countryName: 'Chile', language: 'Spanish', languageInstruction: 'ALL text in PERFECT SPANISH (Latin American)', region: 'LATAM' },
  AR: { countryName: 'Argentina', language: 'Spanish', languageInstruction: 'ALL text in PERFECT SPANISH (Latin American)', region: 'LATAM' },
}

// Language code to override info (when user manually selects output language)
const LANGUAGE_OVERRIDE: Record<string, { language: string; languageInstruction: string }> = {
  es: { language: 'Spanish', languageInstruction: 'ALL text in PERFECT SPANISH' },
  en: { language: 'English', languageInstruction: 'ALL text in PERFECT ENGLISH' },
  fr: { language: 'French', languageInstruction: 'ALL text in PERFECT FRENCH. Headlines, benefits, CTAs — everything in French' },
  it: { language: 'Italian', languageInstruction: 'ALL text in PERFECT ITALIAN. Headlines, benefits, CTAs — everything in Italian' },
  pt: { language: 'Portuguese', languageInstruction: 'ALL text in PERFECT PORTUGUESE. Headlines, benefits, CTAs — everything in Portuguese' },
  de: { language: 'German', languageInstruction: 'ALL text in PERFECT GERMAN. Headlines, benefits, CTAs — everything in German' },
}

export function getCountryLanguage(countryCode: string, outputLanguage?: string): CountryLanguageInfo {
  const base = COUNTRY_LANGUAGE_MAP[countryCode] || COUNTRY_LANGUAGE_MAP['US']
  // If user manually selected a different output language, override
  if (outputLanguage && LANGUAGE_OVERRIDE[outputLanguage]) {
    const override = LANGUAGE_OVERRIDE[outputLanguage]
    return { ...base, language: override.language, languageInstruction: override.languageInstruction }
  }
  return base
}
