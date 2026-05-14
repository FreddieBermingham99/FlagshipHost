import 'server-only'

/** Human-readable line label including variation choices (language, design, etc.). */
export function buildItemSnapshotLabel(
  catalogName: string,
  selected: Record<string, string | string[]>
): string {
  const base = catalogName.trim() || 'Signage'
  const pieces: string[] = []
  for (const k of Object.keys(selected).sort()) {
    if (k.startsWith('_')) continue
    const raw = selected[k]
    const v = Array.isArray(raw) ? raw[0] : raw
    if (v != null && String(v).trim()) pieces.push(String(v).trim())
  }
  if (pieces.length === 0) return base
  return `${base} (${pieces.join(', ')})`
}

/** If snapshot is like "Flag (English, A4)", return "English, A4" for compact sub-lines when it starts with catalog name. */
export function variantSubtitleLabel(fullSnapshot: string, catalogName: string): string {
  const snap = fullSnapshot.trim()
  const name = catalogName.trim()
  if (!name) return snap
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^\\s*${esc}\\s*\\(\\s*(.+)\\s*\\)\\s*$`, 'i')
  const m = snap.match(re)
  return m ? m[1].trim() : snap
}
