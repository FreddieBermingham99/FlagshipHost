import { notFound } from 'next/navigation'
import SignageOrderingLanding from '@/components/SignageOrderingLanding'
import { findStashpointRowById } from '@/lib/flagship-business'
import { localeFromCountryCode } from '@/lib/landing-locale'
import { isStasherDbConfigured } from '@/lib/stasher-db'
import { listSignageCatalogItems } from '@/lib/submissions-db'

type PageProps = {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

export default async function SignageShortLinkPage({ params }: PageProps) {
  const raw = decodeURIComponent(params.id?.trim() ?? '')
  if (!/^[0-9a-fA-F-]{1,64}$/i.test(raw)) {
    notFound()
  }

  const items = await listSignageCatalogItems(true)
  if (!isStasherDbConfigured()) {
    return (
      <SignageOrderingLanding
        stashpointId={raw}
        businessName="Your business"
        items={items}
      />
    )
  }

  const row = await findStashpointRowById(raw)
  if (!row) notFound()

  return (
    <SignageOrderingLanding
      stashpointId={String(row.stashpoint_id)}
      businessName={row.business_name}
      city={row.city}
      country={row.country_code ?? undefined}
      landmark={row.poi ?? undefined}
      postalCode={row.postal_code ?? undefined}
      ownerEmail={row.owner_email ?? undefined}
      ownerPhone={row.owner_phone ?? undefined}
      locale={localeFromCountryCode(row.country_code)}
      items={items}
    />
  )
}
