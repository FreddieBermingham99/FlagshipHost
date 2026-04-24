import 'server-only'

import {
  cacheShortLink,
  getCachedShortLinks,
  isSubmissionsDbConfigured,
} from './submissions-db'

/**
 * Shortens URLs via TinyURL (no auth required) and caches the result in
 * `short_link_cache` so subsequent calls are instant.
 *
 * Supports optional custom aliases so links like
 * `https://tinyurl.com/stasherflagship-<stashpointId>` can be produced for
 * branded, human-readable short URLs.
 *
 * Falls back to the original long URL if:
 *  - the submissions DB is not configured (no cache available),
 *  - TinyURL returns an error / times out,
 *  - `SHORT_LINKS_DISABLED` env var is truthy.
 */

const TINYURL_ENDPOINT = 'https://tinyurl.com/api-create.php'
const SHORTEN_TIMEOUT_MS = 4000

function isDisabled(): boolean {
  const v = process.env.SHORT_LINKS_DISABLED?.toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

/**
 * TinyURL aliases must be alphanumeric (dashes accepted), >=5 chars, reasonably
 * short. We strip anything unsafe and truncate to 40 chars max.
 */
function sanitizeAlias(alias: string): string {
  const cleaned = alias
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return cleaned
}

async function callTinyUrl(longUrl: string, alias?: string): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SHORTEN_TIMEOUT_MS)
  try {
    const aliasParam = alias ? `&alias=${encodeURIComponent(alias)}` : ''
    const res = await fetch(
      `${TINYURL_ENDPOINT}?url=${encodeURIComponent(longUrl)}${aliasParam}`,
      { method: 'GET', signal: controller.signal, cache: 'no-store' }
    )
    if (!res.ok) return null
    const text = (await res.text()).trim()
    if (!/^https?:\/\//i.test(text)) return null
    return text
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchShortFromTinyUrl(longUrl: string, rawAlias?: string): Promise<string | null> {
  const cleanAlias = rawAlias ? sanitizeAlias(rawAlias) : ''

  // Try custom alias first when provided and valid.
  if (cleanAlias && cleanAlias.length >= 5) {
    const withAlias = await callTinyUrl(longUrl, cleanAlias)
    if (withAlias) return withAlias
    // If alias was taken/rejected, strip dashes (some TinyURL paths reject them)
    // and try once more before falling back to auto.
    const noDashes = cleanAlias.replace(/-/g, '')
    if (noDashes !== cleanAlias && noDashes.length >= 5) {
      const retry = await callTinyUrl(longUrl, noDashes)
      if (retry) return retry
    }
    // Deterministic campaign slugs: when a custom alias was requested but is
    // unavailable (taken/rejected), do NOT silently switch to random TinyURL.
    // Callers will fall back to the long URL instead.
    return null
  }

  // Fall back to auto-generated slug.
  return callTinyUrl(longUrl)
}

export async function shortenUrl(longUrl: string, alias?: string): Promise<string> {
  if (!longUrl || isDisabled()) return longUrl

  if (isSubmissionsDbConfigured()) {
    const cached = await getCachedShortLinks([longUrl])
    if (cached[longUrl]) return cached[longUrl]
  }

  const short = await fetchShortFromTinyUrl(longUrl, alias)
  if (!short) return longUrl

  if (isSubmissionsDbConfigured()) {
    try {
      await cacheShortLink(longUrl, short)
    } catch {
      // Non-fatal: shortening still works, just not cached.
    }
  }

  return short
}

export type ShortenRequest = { longUrl: string; alias?: string }
type ShortenInput = string | ShortenRequest

function normalize(input: ShortenInput): ShortenRequest {
  return typeof input === 'string' ? { longUrl: input } : input
}

/**
 * Shortens many URLs, batching uncached ones through TinyURL in parallel.
 * Returns a map keyed by long URL → short URL. Duplicates (same long URL) are
 * de-duplicated; the alias from the first occurrence wins.
 */
export async function shortenManyUrls(
  inputs: ShortenInput[]
): Promise<Record<string, string>> {
  const normalized = inputs.map(normalize).filter((x) => x.longUrl)
  const out: Record<string, string> = {}
  if (normalized.length === 0) return out
  if (isDisabled()) {
    for (const { longUrl } of normalized) out[longUrl] = longUrl
    return out
  }

  // Dedupe by longUrl, keep first alias seen
  const aliasByUrl = new Map<string, string | undefined>()
  for (const { longUrl, alias } of normalized) {
    if (!aliasByUrl.has(longUrl)) aliasByUrl.set(longUrl, alias)
  }
  const uniqueUrls = Array.from(aliasByUrl.keys())

  const cached = isSubmissionsDbConfigured() ? await getCachedShortLinks(uniqueUrls) : {}
  const needsFetch: string[] = []
  for (const u of uniqueUrls) {
    if (cached[u]) {
      out[u] = cached[u]
    } else {
      needsFetch.push(u)
    }
  }

  if (needsFetch.length === 0) return out

  const CONCURRENCY = 8
  let i = 0
  async function worker() {
    while (i < needsFetch.length) {
      const idx = i++
      const longUrl = needsFetch[idx]
      const alias = aliasByUrl.get(longUrl)
      const short = await fetchShortFromTinyUrl(longUrl, alias)
      if (short) {
        out[longUrl] = short
        if (isSubmissionsDbConfigured()) {
          cacheShortLink(longUrl, short).catch(() => {})
        }
      } else {
        out[longUrl] = longUrl
      }
    }
  }
  const workers = Array.from(
    { length: Math.min(CONCURRENCY, needsFetch.length) },
    () => worker()
  )
  await Promise.all(workers)
  return out
}
