import type { FlagshipProps } from '@/components/FlagshipLanding'
import {
  DEFAULT_FLAGSHIP_DASHBOARD_OVERRIDES,
  type FlagshipDashboardOverrides,
} from '@/lib/flagship-dashboard-defaults'
import { flagshipPublicUrl } from '@/lib/flagship-site-url'
import { listStashpointsFromDb, type StashpointBusinessMetricsRow } from '@/lib/stasher-db'

export type { FlagshipDashboardOverrides } from '@/lib/flagship-dashboard-defaults'
export { flagshipPublicUrl, resolveFlagshipSiteBaseUrl } from '@/lib/flagship-site-url'

/**
 * Mirrors Google Sheets: LOWER(REGEXREPLACE(Business Name,"[^a-zA-Z0-9]+", "-"))
 */
export function slugFromBusinessName(businessName: string): string {
  const s = businessName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'stashpoint'
}

export type FlagshipBusinessPackage = FlagshipProps & {
  slug: string
  flagshipUrl: string
}

/** Drops metadata used for emails / dashboard; pass the result to `FlagshipLanding`. */
export function toFlagshipLandingProps({
  slug: _omitSlug,
  flagshipUrl: _omitUrl,
  ...landing
}: FlagshipBusinessPackage): FlagshipProps {
  void _omitSlug
  void _omitUrl
  return landing
}

function toFiniteNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const n = Number.parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * Derived “lift” metrics from website impressions (same period as `views_last_30_days` in the DB).
 */
export function computeFlagshipDerivedMetrics(websiteImpressions: number) {
  const gmapsImpressions = websiteImpressions / 1.5
  const liftWebsiteImpressions = Math.max(821, websiteImpressions * 1.8 + 400)
  const liftGmapsImpressions = Math.max(720, gmapsImpressions * 2 + 200)
  const liftBookings = liftWebsiteImpressions / 8
  const liftRevenue = liftBookings * 6
  return {
    gmapsImpressions,
    liftWebsiteImpressions,
    liftGmapsImpressions,
    liftBookings,
    liftRevenue,
  }
}

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString('en-GB')
}

/** `SUM(est_commission_amount_gbp)` is stored in pence; convert to pounds for display. */
function formatRevenueFromPence(pence: number): string {
  if (!Number.isFinite(pence)) return '—'
  const pounds = pence / 100
  return pounds.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Merge Stasher DB listing row + dashboard-only fields into props for `FlagshipLanding`.
 */
export function buildFlagshipPropsFromMetrics(
  row: StashpointBusinessMetricsRow,
  overrides: FlagshipDashboardOverrides = {}
): FlagshipBusinessPackage {
  const slug = slugFromBusinessName(row.business_name)
  const viewsMissing =
    row.views_last_30_days === null || row.views_last_30_days === undefined
  const views = viewsMissing ? 0 : toFiniteNumber(row.views_last_30_days)
  const bookings = toFiniteNumber(row.bookings_last_30_days)
  const revenuePence = toFiniteNumber(row.revenue_last_30_days_gbp)
  const derived = computeFlagshipDerivedMetrics(views)

  const hasContactOverride =
    overrides.contactEmail !== undefined || overrides.contactPhone !== undefined

  return {
    slug,
    flagshipUrl: flagshipPublicUrl(slug),
    businessName: row.business_name,
    city: row.city,
    landmark: row.poi ?? undefined,
    heroImageUrl: overrides.heroImageUrl,
    ...(hasContactOverride
      ? {
          contact: {
            email: overrides.contactEmail,
            phone: overrides.contactPhone,
          },
        }
      : {}),
    formAction: overrides.formAction,
    googleMapsUrl: overrides.googleMapsUrl,
    locale: overrides.locale,
    currency: overrides.currency,
    websiteImpressions: viewsMissing ? undefined : formatCount(views),
    gmapsImpressions: viewsMissing ? undefined : formatCount(derived.gmapsImpressions),
    bookings: formatCount(bookings),
    revenue: formatRevenueFromPence(revenuePence),
    liftWebsiteImpressions: formatCount(derived.liftWebsiteImpressions),
    liftGmapsImpressions: formatCount(derived.liftGmapsImpressions),
    liftBookings: formatCount(derived.liftBookings),
    liftRevenue: formatCount(derived.liftRevenue),
    topBookings: overrides.topBookings,
    topViews: overrides.topViews,
    topRevenue: overrides.topRevenue,
    ownerEmail: row.owner_email ?? undefined,
    ownerPhone: row.owner_phone ?? undefined,
    parisOne: overrides.parisOne,
    parisTwo: overrides.parisTwo,
    madridOne: overrides.madridOne,
    madridTwo: overrides.madridTwo,
  }
}

export async function findStashpointRowBySlug(
  slug: string
): Promise<StashpointBusinessMetricsRow | null> {
  const normalized = slug.trim().toLowerCase()
  const rows = await listStashpointsFromDb()
  return (
    rows.find((r) => slugFromBusinessName(r.business_name) === normalized) ?? null
  )
}

export async function getAllFlagshipSlugs(): Promise<string[]> {
  const rows = await listStashpointsFromDb()
  return [...new Set(rows.map((r) => slugFromBusinessName(r.business_name)))]
}

/** Shared defaults for flagship pages (same as dashboard form defaults). */
export async function loadFlagshipDashboardOverrides(
  _slug: string
): Promise<FlagshipDashboardOverrides> {
  return { ...DEFAULT_FLAGSHIP_DASHBOARD_OVERRIDES }
}
