export type SupportedLandingLocale = 'en' | 'fr' | 'es' | 'de' | 'it' | 'pt' | 'nl'

const SUPPORTED = new Set<SupportedLandingLocale>([
  'en',
  'fr',
  'es',
  'de',
  'it',
  'pt',
  'nl',
])

function asSupported(v: string): SupportedLandingLocale | null {
  const n = v.trim().toLowerCase()
  return SUPPORTED.has(n as SupportedLandingLocale) ? (n as SupportedLandingLocale) : null
}

export function normalizeLandingLocale(input?: string | null): SupportedLandingLocale | null {
  if (!input) return null
  return asSupported(String(input))
}

const ES_COUNTRIES = new Set([
  'ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'UY', 'PY', 'BO', 'CR', 'PA',
  'DO', 'GT', 'HN', 'SV', 'NI', 'CU', 'PR',
])
const PT_COUNTRIES = new Set(['PT', 'BR', 'AO', 'MZ', 'CV', 'GW', 'ST', 'TL'])
const DE_COUNTRIES = new Set(['DE', 'AT', 'CH', 'LI', 'LU'])
const IT_COUNTRIES = new Set(['IT', 'SM', 'VA'])
const NL_COUNTRIES = new Set(['NL', 'BE'])
const FR_COUNTRIES = new Set(['FR', 'BE', 'CH', 'LU', 'CA'])

export function localeFromCountryCode(countryCode?: string | null): SupportedLandingLocale {
  const cc = String(countryCode ?? '').trim().toUpperCase()
  if (!cc) return 'en'
  if (PT_COUNTRIES.has(cc)) return 'pt'
  if (ES_COUNTRIES.has(cc)) return 'es'
  if (DE_COUNTRIES.has(cc)) return 'de'
  if (IT_COUNTRIES.has(cc)) return 'it'
  if (NL_COUNTRIES.has(cc)) return 'nl'
  if (FR_COUNTRIES.has(cc)) return 'fr'
  return 'en'
}
