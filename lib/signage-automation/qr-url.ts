import 'server-only'

import { findStashpointRowById } from '@/lib/flagship-business'
import { flagshipPublicUrl } from '@/lib/flagship-site-url'
import { shortenUrl } from '@/lib/short-link'
import type { SignageAutomationSettings } from '@/lib/submissions-db'

/**
 * Stasher public stashpoint listing URL, matching `listStashpointsFromDb` SQL:
 * `'https://stasher.com/luggage-storage' || s.canonical_url || '/stashpoints/' || s.id`
 */
function stasherListingBaseFromRow(stashpointId: string, canonicalUrl: string | null | undefined): string {
  const canonical = canonicalUrl ?? ''
  return `https://stasher.com/luggage-storage${canonical}/stashpoints/${stashpointId}`
}

export async function buildQrUrl(params: {
  stashpointId: string
  slug: string
  signageType: string
  settings: SignageAutomationSettings
}): Promise<string> {
  const template = String(params.settings.qr_url_template || '').trim()
  const signageTypeSlug = params.signageType
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  let baseWithoutQuery: string
  if (template.length > 0) {
    baseWithoutQuery = template
      .replace(/\[(stashpointid|stashpoint_id)\]/gi, encodeURIComponent(params.stashpointId))
      .replace(/\[(signagetype|signage_type)\]/gi, encodeURIComponent(signageTypeSlug))
  } else {
    try {
      const row = await findStashpointRowById(params.stashpointId)
      if (row) {
        baseWithoutQuery = stasherListingBaseFromRow(params.stashpointId, row.canonical_url)
      } else {
        baseWithoutQuery = flagshipPublicUrl(params.slug || params.stashpointId, {
          stashpointId: params.stashpointId,
        })
      }
    } catch (error) {
      // Asset generation should still proceed when Stasher DB is temporarily unreachable.
      console.warn('[signage automation] failed to load stashpoint row for QR URL; using fallback URL', {
        stashpointId: params.stashpointId,
        error: error instanceof Error ? error.message : String(error),
      })
      baseWithoutQuery = flagshipPublicUrl(params.slug || params.stashpointId, {
        stashpointId: params.stashpointId,
      })
    }
  }

  const url = new URL(baseWithoutQuery)
  const src = String(params.settings.utm_source || '').trim()
  const campaign = String(params.settings.utm_campaign || '').trim()
  if (src) url.searchParams.set('utm_source', src)
  url.searchParams.set('utm_medium', 'QR')
  if (campaign) url.searchParams.set('utm_campaign', campaign)

  const longUrl = url.toString()
  if (!params.settings.use_short_links) return longUrl
  return shortenUrl(longUrl, `sign-${params.stashpointId}`)
}
