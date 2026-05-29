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
  const raw = String(input).trim().toLowerCase()
  const direct = asSupported(raw)
  if (direct) return direct
  // Accept locale tags like `fr-FR` / `pt_BR`.
  const primary = raw.split(/[-_]/)[0] || ''
  return asSupported(primary)
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

const ES_COUNTRY_NAMES = new Set(['spain', 'espana', 'españa', 'mexico', 'argentina', 'colombia', 'chile', 'peru', 'perú', 'venezuela'])
const PT_COUNTRY_NAMES = new Set(['portugal', 'brazil', 'brasil', 'angola', 'mozambique'])
const DE_COUNTRY_NAMES = new Set(['germany', 'deutschland', 'austria', 'switzerland', 'liechtenstein', 'luxembourg'])
const IT_COUNTRY_NAMES = new Set(['italy', 'italia'])
const NL_COUNTRY_NAMES = new Set(['netherlands', 'holland', 'nederland'])
const FR_COUNTRY_NAMES = new Set(['france', 'français', 'francais', 'switzerland', 'canada', 'quebec', 'québec'])

const COUNTRY_CODE_ALIASES: Record<string, string> = {
  // French-speaking / FR defaults
  FRA: 'FR',
  BEL: 'BE',
  CHE: 'CH',
  LUX: 'LU',
  CAN: 'CA',
  // Spanish defaults
  ESP: 'ES',
  MEX: 'MX',
  ARG: 'AR',
  COL: 'CO',
  CHL: 'CL',
  PER: 'PE',
  VEN: 'VE',
  ECU: 'EC',
  URY: 'UY',
  PRY: 'PY',
  BOL: 'BO',
  CRI: 'CR',
  PAN: 'PA',
  DOM: 'DO',
  GTM: 'GT',
  HND: 'HN',
  SLV: 'SV',
  NIC: 'NI',
  CUB: 'CU',
  PRI: 'PR',
  // Portuguese defaults
  PRT: 'PT',
  BRA: 'BR',
  AGO: 'AO',
  MOZ: 'MZ',
  CPV: 'CV',
  GNB: 'GW',
  STP: 'ST',
  TLS: 'TL',
  // German defaults
  DEU: 'DE',
  AUT: 'AT',
  LIE: 'LI',
  // Italian defaults
  ITA: 'IT',
  SMR: 'SM',
  VAT: 'VA',
  // Dutch defaults
  NLD: 'NL',
  // English-speaking defaults
  GBR: 'GB',
  USA: 'US',
  IRL: 'IE',
  AUS: 'AU',
  NZL: 'NZ',
  ZAF: 'ZA',
}

/** Normalise stored country values to ISO 3166-1 alpha-2 for print providers. */
export function normalizeCountryCodeAlpha2(countryCode?: string | null): string {
  const raw = String(countryCode ?? '').trim()
  if (!raw) return ''
  const upperRaw = raw.toUpperCase()
  return COUNTRY_CODE_ALIASES[upperRaw] || upperRaw
}

export function localeFromCountryCode(countryCode?: string | null): SupportedLandingLocale {
  const raw = String(countryCode ?? '').trim()
  if (!raw) return 'en'
  const upperRaw = raw.toUpperCase()
  const cc = normalizeCountryCodeAlpha2(upperRaw)
  if (PT_COUNTRIES.has(cc)) return 'pt'
  if (ES_COUNTRIES.has(cc)) return 'es'
  if (DE_COUNTRIES.has(cc)) return 'de'
  if (IT_COUNTRIES.has(cc)) return 'it'
  if (NL_COUNTRIES.has(cc)) return 'nl'
  if (FR_COUNTRIES.has(cc)) return 'fr'
  // Accept common non-ISO inputs (e.g. "France", "fr-FR", "FRA").
  const normalizedLocale = normalizeLandingLocale(raw)
  if (normalizedLocale) return normalizedLocale
  const alphaOnly = raw.toLowerCase().replace(/[^a-z]/g, '')
  if (FR_COUNTRY_NAMES.has(alphaOnly)) return 'fr'
  if (PT_COUNTRY_NAMES.has(alphaOnly)) return 'pt'
  if (ES_COUNTRY_NAMES.has(alphaOnly)) return 'es'
  if (DE_COUNTRY_NAMES.has(alphaOnly)) return 'de'
  if (IT_COUNTRY_NAMES.has(alphaOnly)) return 'it'
  if (NL_COUNTRY_NAMES.has(alphaOnly)) return 'nl'
  return 'en'
}
