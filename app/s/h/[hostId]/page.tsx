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
      locale={localeFromCountryCode(primary.country)}
      items={items}
    />
  )
}
