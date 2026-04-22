import { notFound } from 'next/navigation'
import TierLanding from '@/components/TierLanding'
import { resolvePublicFlagshipOverrides } from '@/lib/flagship-business'
import { loadProgrammeHostBundle } from '@/lib/programme-tier-landing-server'
import { localeFromCountryCode, normalizeLandingLocale } from '@/lib/landing-locale'
import { isStasherDbConfigured } from '@/lib/stasher-db'

type PageProps = {
  params: { hostId: string }
}

export const dynamic = 'force-dynamic'

/** Programme short URL by Stasher host id: `/p/h/{hostId}` (one link per host / owner). */
export default async function ProgrammeHostShortLinkPage({ params }: PageProps) {
  if (!isStasherDbConfigured()) {
    notFound()
  }

  const raw = decodeURIComponent(params.hostId?.trim() ?? '')
  if (!/^[0-9a-fA-F-]{1,64}$/i.test(raw)) {
    notFound()
  }

  const bundle = await loadProgrammeHostBundle(raw)
  if (!bundle) {
    notFound()
  }

  const row = bundle.primary
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
      hostId={bundle.hostId}
      hostDisplayName={bundle.hostDisplayName}
      programmeStashpoints={bundle.programmeStashpoints}
      locale={resolvedLocale}
      currency={overrides.currency}
      ownerEmail={row.owner_email ?? undefined}
      ownerPhone={row.owner_phone ?? undefined}
    />
  )
}
