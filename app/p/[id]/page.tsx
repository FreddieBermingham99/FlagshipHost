import { notFound } from 'next/navigation'
import TierLanding from '@/components/TierLanding'
import {
  findStashpointRowById,
  resolvePublicFlagshipOverrides,
} from '@/lib/flagship-business'
import { loadProgrammeHostBundle } from '@/lib/programme-tier-landing-server'
import { localeFromCountryCode, normalizeLandingLocale } from '@/lib/landing-locale'
import { isStasherDbConfigured } from '@/lib/stasher-db'

type PageProps = {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

/** Legacy programme short URL: `/p/{stashpointId}` (prefer `/p/h/{hostId}` from dashboard). */
export default async function ProgrammeShortLinkPage({ params }: PageProps) {
  if (!isStasherDbConfigured()) {
    notFound()
  }

  const raw = decodeURIComponent(params.id?.trim() ?? '')
  if (!/^[0-9a-fA-F-]{1,64}$/i.test(raw)) {
    notFound()
  }

  const row = await findStashpointRowById(raw)
  if (!row) {
    notFound()
  }

  const overrides = await resolvePublicFlagshipOverrides(row.city)
  const resolvedLocale =
    normalizeLandingLocale(overrides.locale) ?? localeFromCountryCode(row.country_code)

  const hostBundle = row.host_id ? await loadProgrammeHostBundle(row.host_id) : null

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
      hostId={hostBundle?.hostId}
      hostDisplayName={hostBundle?.hostDisplayName}
      programmeStashpoints={hostBundle?.programmeStashpoints}
      locale={resolvedLocale}
      currency={overrides.currency}
      ownerEmail={row.owner_email ?? undefined}
      ownerPhone={row.owner_phone ?? undefined}
    />
  )
}
