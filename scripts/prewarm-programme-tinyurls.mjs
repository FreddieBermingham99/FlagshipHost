import fs from 'node:fs'
import path from 'node:path'
import { Pool } from 'pg'

function parseDotEnv(content) {
  const out = {}
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const k = trimmed.slice(0, eq).trim()
    let v = trimmed.slice(eq + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
}

function loadEnvFromLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const parsed = parseDotEnv(fs.readFileSync(envPath, 'utf8'))
  for (const [k, v] of Object.entries(parsed)) {
    if (!(k in process.env)) process.env[k] = v
  }
}

function normalizeConnString(raw) {
  try {
    const u = new URL(raw)
    u.searchParams.delete('sslmode')
    return u.toString()
  } catch {
    return raw
  }
}

function sanitizeAliasPrefix(raw, fallback) {
  const v = String(raw ?? '')
    .trim()
    .replace(/[^a-z0-9-]+/gi, '')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return v || fallback
}

async function tinyurl(longUrl, alias) {
  const api = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}&alias=${encodeURIComponent(alias)}`
  const res = await fetch(api, { method: 'GET' })
  if (!res.ok) return null
  const text = (await res.text()).trim()
  if (!/^https?:\/\//i.test(text)) return null
  return text
}

async function main() {
  loadEnvFromLocal()

  const stasherUrl =
    process.env.STASHER_DATABASE_READ_URL || process.env.STASHER_DATABASE_URL
  const submissionsUrl = process.env.SUBMISSIONS_DATABASE_URL
  const baseUrl = (() => {
    const explicit =
      (process.env.FLAGSHIP_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim()
    if (explicit) return explicit.replace(/\/$/, '')
    const vercel = (process.env.VERCEL_URL || '').trim()
    if (vercel) {
      const host = vercel.replace(/^https?:\/\//i, '').replace(/\/$/, '')
      return `https://${host}`
    }
    return 'https://flagship-host.vercel.app'
  })()
  const programmePrefix = sanitizeAliasPrefix(
    process.env.PROGRAMME_SHORT_LINK_ALIAS_PREFIX,
    'prog'
  )

  if (!stasherUrl) throw new Error('Missing STASHER_DATABASE_READ_URL / STASHER_DATABASE_URL')
  if (!submissionsUrl) throw new Error('Missing SUBMISSIONS_DATABASE_URL')

  const stasher = new Pool({
    connectionString: normalizeConnString(stasherUrl),
    ssl: { rejectUnauthorized: false },
  })
  const submissions = new Pool({
    connectionString: normalizeConnString(submissionsUrl),
    ssl: { rejectUnauthorized: false },
  })

  try {
    const hostRows = await stasher.query(`
WITH active_stashpoints AS (
  SELECT s.host_id
  FROM stashpoints s
  WHERE s.deactivated_at IS NULL
    AND s.activated_at < CURRENT_DATE
    AND s.new_type NOT LIKE '%locker%'
  GROUP BY s.host_id
)
SELECT h.id::text AS host_id
FROM hosts h
JOIN active_stashpoints s ON s.host_id = h.id
ORDER BY h.id::text
`)

    const hosts = hostRows.rows.map((r) => String(r.host_id).trim()).filter(Boolean)
    let created = 0
    let cached = 0
    let failed = 0
    let longFallback = 0

    for (const hostIdRaw of hosts) {
      const hostHex = hostIdRaw.replace(/-/g, '').toLowerCase()
      const alias = `${programmePrefix}-${hostHex}`.slice(0, 40)
      const longUrl = `${baseUrl}/p/h/${encodeURIComponent(hostIdRaw)}`

      const existing = await submissions.query(
        'SELECT short_url FROM short_link_cache WHERE long_url = $1 LIMIT 1',
        [longUrl]
      )
      if (existing.rows[0]?.short_url) {
        cached += 1
        continue
      }

      const short = await tinyurl(longUrl, alias)
      if (!short) {
        // Keep deterministic behavior: no random aliases.
        failed += 1
        longFallback += 1
        continue
      }

      await submissions.query(
        `INSERT INTO short_link_cache (long_url, short_url, provider)
         VALUES ($1, $2, 'tinyurl')
         ON CONFLICT (long_url) DO NOTHING`,
        [longUrl, short]
      )
      created += 1
    }

    console.log(
      JSON.stringify(
        {
          totalHosts: hosts.length,
          created,
          alreadyCached: cached,
          failedAliasOrTinyUrl: failed,
          longUrlFallback: longFallback,
          aliasPattern: `${programmePrefix}-{hostHex}`,
        },
        null,
        2
      )
    )
  } finally {
    await Promise.allSettled([stasher.end(), submissions.end()])
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
