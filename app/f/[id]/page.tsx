import { notFound } from 'next/navigation'
import FlagshipLanding from '@/components/FlagshipLanding'
import {
  buildFlagshipPropsFromMetrics,
  findStashpointRowById,
  resolvePublicFlagshipOverrides,
  toFlagshipLandingProps,
} from '@/lib/flagship-business'
import { isStasherDbConfigured } from '@/lib/stasher-db'

type PageProps = {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

/** Short public URL: `/f/{stashpointId}` — same page as `/flagship/{slug}`. */
export default async function FlagshipShortLinkPage({ params }: PageProps) {
  if (!isStasherDbConfigured()) {
    notFound()
  }

  const raw = decodeURIComponent(params.id?.trim() ?? '')
  // Match DB `s.id::text`: decimal int, UUID, hex-style ids (not only digits).
  if (!/^[0-9a-fA-F-]{1,64}$/i.test(raw)) {
    notFound()
  }

  const row = await findStashpointRowById(raw)
  if (!row) {
    notFound()
  }

  const overrides = await resolvePublicFlagshipOverrides(row.city)
  const pkg = buildFlagshipPropsFromMetrics(row, overrides)
  return <FlagshipLanding {...toFlagshipLandingProps(pkg)} stashpointId={String(row.stashpoint_id)} />
}
