import { notFound } from 'next/navigation'
import TierLanding from '@/components/TierLanding'
import {
  findStashpointRowBySlug,
  getAllFlagshipSlugs,
  resolvePublicFlagshipOverrides,
} from '@/lib/flagship-business'
import { localeFromCountryCode, normalizeLandingLocale } from '@/lib/landing-locale'
import { isStasherDbConfigured } from '@/lib/stasher-db'
import { getBusinessBySlug, fetchSheetRows } from '@/lib/sheets'

type PageProps = {
  params: {
    slug: string
  }
}

export const dynamic = 'force-dynamic'
export const dynamicParams = true

export async function generateStaticParams() {
  try {
    if (isStasherDbConfigured()) {
      const slugs = await getAllFlagshipSlugs()
      return slugs.map((slug) => ({ slug }))
    }
    const rows = await fetchSheetRows()
    return rows.filter((row) => row.slug).map((row) => ({ slug: row.slug }))
  } catch {
    return []
  }
}

export default async function ProgrammePage({ params }: PageProps) {
  if (isStasherDbConfigured()) {
    const row = await findStashpointRowBySlug(params.slug)
    if (!row) notFound()

    const overrides = await resolvePublicFlagshipOverrides(row.city)
    const resolvedLocale =
      normalizeLandingLocale(overrides.locale) ?? localeFromCountryCode(row.country_code)

    return (
      <TierLanding
        businessName={row.business_name}
        city={row.city}
        landmark={row.poi ?? undefined}
        contact={{
          email: overrides.contactEmail,
          phone: overrides.contactPhone,
        }}
        formAction={overrides.formAction}
        stashpointId={String(row.stashpoint_id)}
        locale={resolvedLocale}
        currency={overrides.currency}
        ownerEmail={row.owner_email ?? undefined}
        ownerPhone={row.owner_phone ?? undefined}
      />
    )
  }

  const business = await getBusinessBySlug(params.slug)
  if (!business) notFound()

  return (
    <TierLanding
      businessName={business.businessName}
      city={business.city}
      landmark={business.landmark}
      contact={{
        email: business.contactEmail,
        phone: business.contactPhone,
      }}
      formAction={business.formAction}
      locale={business.locale}
      currency={business.currency}
      ownerEmail={business.ownerEmail}
      ownerPhone={business.ownerPhone}
    />
  )
}
