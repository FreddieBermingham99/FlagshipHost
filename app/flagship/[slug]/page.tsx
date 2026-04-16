import { notFound } from 'next/navigation'
import FlagshipLanding from '@/components/FlagshipLanding'
import {
  buildFlagshipPropsFromMetrics,
  findStashpointRowBySlug,
  getAllFlagshipSlugs,
  resolvePublicFlagshipOverrides,
  toFlagshipLandingProps,
} from '@/lib/flagship-business'
import { isStasherDbConfigured } from '@/lib/stasher-db'
import { getBusinessBySlug, fetchSheetRows } from '@/lib/sheets'

type PageProps = {
  params: {
    slug: string
  }
}

/** Always resolve the slug against the DB / sheet at request time (no stale static 404). */
export const dynamic = 'force-dynamic'

/** Allow `/flagship/[slug]` for any slug even if it was not returned at build time. */
export const dynamicParams = true

// Optional: prewarm common paths when env is available at build (Vercel CI must have DB URL).
export async function generateStaticParams() {
  try {
    if (isStasherDbConfigured()) {
      const slugs = await getAllFlagshipSlugs()
      return slugs.map((slug) => ({ slug }))
    }
    const rows = await fetchSheetRows()
    return rows.filter((row) => row.slug).map((row) => ({ slug: row.slug }))
  } catch (error) {
    console.error('Error generating static params:', error)
    return []
  }
}

export default async function FlagshipPage({ params }: PageProps) {
  if (isStasherDbConfigured()) {
    const row = await findStashpointRowBySlug(params.slug)
    if (!row) {
      console.error(`[Flagship] No stashpoint for slug: "${params.slug}"`)
      try {
        const slugs = (await getAllFlagshipSlugs()).slice(0, 10)
        console.error(`[Flagship] Sample slugs (first 10):`, slugs)
      } catch (err) {
        console.error(`[Flagship] Error listing slugs:`, err)
      }
      notFound()
    }
    const overrides = await resolvePublicFlagshipOverrides(row.city)
    const pkg = buildFlagshipPropsFromMetrics(row, overrides)
    return <FlagshipLanding {...toFlagshipLandingProps(pkg)} stashpointId={String(row.stashpoint_id)} />
  }

  const business = await getBusinessBySlug(params.slug)

  if (!business) {
    // Debug logging to help diagnose missing locations
    console.error(`[Flagship] Business not found for slug: "${params.slug}"`)
    try {
      const allRows = await fetchSheetRows()
      const availableSlugs = allRows
        .map((r) => r.slug)
        .filter((s) => s && s.trim())
        .slice(0, 10) // Show first 10 for debugging
      console.error(`[Flagship] Available slugs (first 10):`, availableSlugs)
    } catch (err) {
      console.error(`[Flagship] Error fetching sheet rows:`, err)
    }
    notFound()
  }

  return (
    <FlagshipLanding
      businessName={business.businessName}
      city={business.city}
      landmark={business.landmark}
      heroImageUrl={business.heroImageUrl}
      contact={{
        email: business.contactEmail,
        phone: business.contactPhone,
      }}
      formAction={business.formAction}
      stashpointId={business.stashpointId || business.stashpoint_id}
      googleMapsUrl={business.googleMapsUrl}
      locale={business.locale}
      currency={business.currency}
      websiteImpressions={business.websiteImpressions}
      gmapsImpressions={business.gmapsImpressions}
      bookings={business.bookings}
      revenue={business.revenue}
      liftWebsiteImpressions={business.liftWebsiteImpressions}
      liftGmapsImpressions={business.liftGmapsImpressions}
      liftBookings={business.liftBookings}
      liftRevenue={business.liftRevenue}
      topBookings={business.topBookings}
      topViews={business.topViews}
      topRevenue={business.topRevenue}
      ownerEmail={business.ownerEmail}
      ownerPhone={business.ownerPhone}
      parisOne={business.parisOne}
      parisTwo={business.parisTwo}
      madridOne={business.madridOne}
      madridTwo={business.madridTwo}
    />
  )
}

