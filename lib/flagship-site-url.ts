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

/** Programme (tier selection) page URL. Always uses `/programme/{slug}`. */
export function programmePublicUrl(slug: string): string {
  const base = resolveFlagshipSiteBaseUrl()
  return `${base}/programme/${encodeURIComponent(slug.trim())}`
}
