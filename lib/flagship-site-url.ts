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

/** Full share URL (UTM query string). */
export function flagshipPublicUrl(slug: string): string {
  const base = resolveFlagshipSiteBaseUrl()
  const s = slug.trim()
  const q = new URLSearchParams({
    source: 'website',
    medium: 'email',
    campaign: s,
  })
  return `${base}/flagship/${encodeURIComponent(s)}?${q.toString()}`
}
