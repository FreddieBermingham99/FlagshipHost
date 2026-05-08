import 'server-only'

import { fetchHostCommonName, listStashpointsFromDb } from '@/lib/stasher-db'

export type SignageHostStashpointSummary = {
  stashpointId: string
  businessName: string
  city: string
  country?: string
  landmark?: string
  postalCode?: string
  ownerEmail?: string
  ownerPhone?: string
}

/**
 * Active stashpoints under one host for host-level signage ordering (`/s/h/{hostId}`).
 */
export async function loadSignageHostBundle(hostId: string): Promise<{
  primary: SignageHostStashpointSummary
  stashpoints: SignageHostStashpointSummary[]
  hostDisplayName?: string
  hostId: string
} | null> {
  const hid = String(hostId).trim()
  if (!hid) return null
  const [rows, hostDisplayName] = await Promise.all([
    listStashpointsFromDb({ hostId: hid }),
    fetchHostCommonName(hid),
  ])
  if (rows.length === 0) return null
  const stashpoints: SignageHostStashpointSummary[] = rows.map((r) => ({
    stashpointId: String(r.stashpoint_id),
    businessName: r.business_name,
    city: r.city,
    country: r.country_code ?? undefined,
    landmark: r.poi ?? undefined,
    postalCode: r.postal_code ?? undefined,
    ownerEmail: r.owner_email ?? undefined,
    ownerPhone: r.owner_phone ?? undefined,
  }))
  return {
    primary: stashpoints[0],
    stashpoints,
    hostDisplayName: hostDisplayName ?? undefined,
    hostId: hid,
  }
}
