import 'server-only'

export type ParsedReviewLinkRow = {
  stashpoint_id: string
  review_link: string | null
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let current = ''
  let i = 0
  let inQuotes = false
  while (i < line.length) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 2
        continue
      }
      inQuotes = !inQuotes
      i += 1
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(current.trim())
      current = ''
      i += 1
      continue
    }
    current += ch
    i += 1
  }
  out.push(current.trim())
  return out
}

function findHeaderIndex(headers: string[], wanted: string): number {
  const normalizedWanted = wanted.trim().toLowerCase()
  return headers.findIndex((h) => h.trim().toLowerCase() === normalizedWanted)
}

export function parseReviewLinksCsv(csvText: string): ParsedReviewLinkRow[] {
  const lines = String(csvText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return []
  const headers = parseCsvLine(lines[0] || '')
  const storeCodeIdx = findHeaderIndex(headers, 'Store Code')
  const reviewLinkIdx = findHeaderIndex(headers, 'Review Link')
  if (storeCodeIdx < 0 || reviewLinkIdx < 0) {
    throw new Error('CSV must include "Store Code" and "Review Link" headers')
  }

  const rows: ParsedReviewLinkRow[] = []
  for (const rawLine of lines.slice(1)) {
    const cols = parseCsvLine(rawLine)
    const stashpointId = String(cols[storeCodeIdx] || '').trim()
    if (!stashpointId) continue
    const reviewLink = String(cols[reviewLinkIdx] || '').trim()
    if (reviewLink) {
      let parsed: URL
      try {
        parsed = new URL(reviewLink)
      } catch {
        throw new Error(`Invalid Review Link URL for Store Code ${stashpointId}`)
      }
      if (!/^https?:$/i.test(parsed.protocol)) {
        throw new Error(`Review Link must be http(s) for Store Code ${stashpointId}`)
      }
    }
    rows.push({
      stashpoint_id: stashpointId,
      review_link: reviewLink || null,
    })
  }
  return rows
}
