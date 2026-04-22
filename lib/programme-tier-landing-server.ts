import 'server-only'

import type { ProgrammeStashpointSummary } from '@/lib/programme-tier-types'
import {
  fetchHostCommonName,
  listStashpointsFromDb,
  type StashpointBusinessMetricsRow,
} from '@/lib/stasher-db'

/**
 * Active stashpoints for a host + `hosts.common_name` for the programme (Tier) landing form.
 */
export async function loadProgrammeHostBundle(hostId: string): Promise<{
  primary: StashpointBusinessMetricsRow
  programmeStashpoints: ProgrammeStashpointSummary[]
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
  return {
    primary: rows[0],
    programmeStashpoints: rows.map((r) => ({
      stashpointId: String(r.stashpoint_id),
      businessName: r.business_name,
      city: r.city,
    })),
    hostDisplayName: hostDisplayName ?? undefined,
    hostId: hid,
  }
}
