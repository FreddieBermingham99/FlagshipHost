import { notFound } from 'next/navigation'
import SignageOrderingLanding from '@/components/SignageOrderingLanding'
import { localeFromCountryCode } from '@/lib/landing-locale'
import { loadSignageHostBundle } from '@/lib/signage-ordering-server'
import { isStasherDbConfigured } from '@/lib/stasher-db'
import { listSignageCatalogItems } from '@/lib/submissions-db'

type PageProps = {
  params: { hostId: string }
}

export const dynamic = 'force-dynamic'

function resolveHostDefaultLocale(
  stashpoints: Array<{ country?: string }>
): ReturnType<typeof localeFromCountryCode> {
  if (stashpoints.length === 0) return 'en'
  const counts = new Map<string, number>()
  for (const sp of stashpoints) {
    const locale = localeFromCountryCode(sp.country)
    counts.set(locale, (counts.get(locale) ?? 0) + 1)
  }
  // Prefer a non-English dominant locale when available.
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const nonEnglishTop = ordered.find(([locale]) => locale !== 'en')
  return (nonEnglishTop?.[0] ?? ordered[0]?.[0] ?? 'en') as ReturnType<typeof localeFromCountryCode>
}

/** Host-level signage short URL: `/s/h/{hostId}` (one picker for all host stashpoints). */
export default async function SignageHostShortLinkPage({ params }: PageProps) {
  if (!isStasherDbConfigured()) {
    notFound()
  }

  const raw = decodeURIComponent(params.hostId?.trim() ?? '')
  if (!/^[0-9a-fA-F-]{1,64}$/i.test(raw)) {
    notFound()
  }

  const [bundle, items] = await Promise.all([
    loadSignageHostBundle(raw),
    listSignageCatalogItems(true),
  ])
  if (!bundle) {
    notFound()
  }

  const primary = bundle.primary
  const resolvedLocale = resolveHostDefaultLocale(bundle.stashpoints)
  return (
    <SignageOrderingLanding
      hostId={bundle.hostId}
      hostDisplayName={bundle.hostDisplayName}
      signageStashpoints={bundle.stashpoints}
      stashpointId={primary.stashpointId}
      businessName={primary.businessName}
      city={primary.city}
      country={primary.country}
      landmark={primary.landmark}
      postalCode={primary.postalCode}
      ownerEmail={primary.ownerEmail}
      ownerPhone={primary.ownerPhone}
      locale={resolvedLocale}
      items={items}
    />
  )
}
