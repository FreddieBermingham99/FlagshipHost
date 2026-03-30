import { notFound } from 'next/navigation'
import FlagshipLanding from '@/components/FlagshipLanding'
import {
  buildFlagshipPropsFromMetrics,
  findStashpointRowById,
  loadFlagshipDashboardOverrides,
  slugFromBusinessName,
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

  const raw = params.id?.trim() ?? ''
  if (!/^\d+$/.test(raw)) {
    notFound()
  }

  const row = await findStashpointRowById(raw)
  if (!row) {
    notFound()
  }

  const slug = slugFromBusinessName(row.business_name)
  const overrides = await loadFlagshipDashboardOverrides(slug)
  const pkg = buildFlagshipPropsFromMetrics(row, overrides)
  return <FlagshipLanding {...toFlagshipLandingProps(pkg)} />
}
