/**
 * Public origin for `/flagship/...` links (email, dashboard). No DB — safe to import from server-only entrypoints.
 *
 * Priority:
 * 1. `FLAGSHIP_PUBLIC_BASE_URL` — use for production custom domain
 * 2. `NEXT_PUBLIC_SITE_URL` — optional public site URL
 * 3. `VERCEL_URL` — auto on Vercel (preview + production hostname)
 * 4. `http://localhost:${PORT||3000}` in development
 * 5. Legacy placeholder
 */
export function resolveFlagshipSiteBaseUrl(): string {
  const explicit = process.env.FLAGSHIP_PUBLIC_BASE_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  const nextPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (nextPublic) return nextPublic.replace(/\/$/, '')

  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, '')
    return `https://${host.replace(/\/$/, '')}`
  }

  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || '3000'
    return `http://localhost:${port}`
  }

  return 'https://flagship-host.vercel.app'
}

export type FlagshipPublicUrlOptions = {
  /**
   * When set (DB mode), links use the short path `/f/{id}` instead of a long `/flagship/{slug}`.
   */
  stashpointId?: number | string | null
}

/**
 * Public share URL for emails and the dashboard.
 * Prefers `/f/{stashpointId}` when an id is available (short, readable); otherwise `/flagship/{slug}`.
 * No query string — keeps links clean; long slugs previously duplicated tracking params and looked spammy.
 */
export function flagshipPublicUrl(slug: string, options?: FlagshipPublicUrlOptions): string {
  const base = resolveFlagshipSiteBaseUrl()
  const id = options?.stashpointId
  if (id !== null && id !== undefined && String(id).trim() !== '') {
    return `${base}/f/${encodeURIComponent(String(id).trim())}`
  }
  const s = slug.trim()
  return `${base}/flagship/${encodeURIComponent(s)}`
}

export type ProgrammePublicUrlOptions = {
  /**
   * When set (DB mode), links use `/p/h/{hostId}` so one owner email / host maps to one programme URL.
   */
  hostId?: number | string | null
  /**
   * Legacy stashpoint-based programme short link; used only when `hostId` is unavailable.
   */
  stashpointId?: number | string | null
}

/**
 * Programme (tier selection) page URL.
 * Prefers `/p/h/{hostId}` when a host id is known; otherwise `/p/{stashpointId}`; otherwise slug path.
 */
export function programmePublicUrl(slug: string, options?: ProgrammePublicUrlOptions): string {
  const base = resolveFlagshipSiteBaseUrl()
  const hostId = options?.hostId
  if (hostId !== null && hostId !== undefined && String(hostId).trim() !== '') {
    return `${base}/p/h/${encodeURIComponent(String(hostId).trim())}`
  }
  const spId = options?.stashpointId
  if (spId !== null && spId !== undefined && String(spId).trim() !== '') {
    return `${base}/p/${encodeURIComponent(String(spId).trim())}`
  }
  return `${base}/programme/${encodeURIComponent(slug.trim())}`
}

/** Host id segment from a programme public URL (`…/p/h/{hostId}`), for TinyURL aliases when `hostId` isn’t on the row. */
export function parseHostIdFromProgrammePublicUrl(url: string): string | null {
  const s = String(url ?? '').trim()
  if (!s) return null
  const m = s.match(/\/p\/h\/([^/?#]+)/)
  if (!m?.[1]) return null
  try {
    return decodeURIComponent(m[1]).trim() || null
  } catch {
    return m[1].trim() || null
  }
}

export type SignagePublicUrlOptions = {
  /**
   * When set, signage links use `/s/h/{hostId}` so one owner link can cover
   * all active stashpoints under that host.
   */
  hostId?: number | string | null
}

/** Delivery burst field app URL (`/delivery/{slug}`). */
export function deliveryBurstPublicUrl(slug: string): string {
  const base = resolveFlagshipSiteBaseUrl()
  return `${base}/delivery/${encodeURIComponent(slug.trim())}`
}

/** Signage ordering page URL (`/s/{stashpointId}` or host-level `/s/h/{hostId}`). */
export function signagePublicUrl(
  stashpointId: number | string,
  options?: SignagePublicUrlOptions
): string {
  const base = resolveFlagshipSiteBaseUrl()
  const hostId = options?.hostId
  if (hostId !== null && hostId !== undefined && String(hostId).trim() !== '') {
    return `${base}/s/h/${encodeURIComponent(String(hostId).trim())}`
  }
  return `${base}/s/${encodeURIComponent(String(stashpointId).trim())}`
}
