import 'server-only'

import fs from 'fs'
import path from 'path'
import { google } from 'googleapis'
import { Readable } from 'stream'

/** Convention: drop the GCP service account JSON here (gitignored). No env var needed locally. */
export const DEFAULT_LOCAL_CREDENTIALS_REL = 'secrets/google-signage-credentials.json'

/** Find gitignored credentials when cwd is repo root or a subfolder (e.g. Next.js sometimes differs). */
function findLocalCredentialsFile(): string | null {
  let dir = process.cwd()
  for (let depth = 0; depth < 6; depth++) {
    const candidate = path.join(dir, DEFAULT_LOCAL_CREDENTIALS_REL)
    if (fs.existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

/** Read key file as UTF-8; handle UTF-8 BOM and UTF-16 LE (some Windows editors). */
function readCredentialsFile(abs: string): string {
  const buf = fs.readFileSync(abs)
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.subarray(2).toString('utf16le')
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf8')
  }
  return buf.toString('utf8')
}

function loadCredentialsRaw(): string {
  const filePath = process.env.GOOGLE_SIGNAGE_DRIVE_CREDENTIALS_PATH?.trim()
  if (filePath) {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)
    try {
      return readCredentialsFile(abs)
    } catch (e) {
      throw new Error(
        `Could not read Google Drive credentials file at ${abs}: ${e instanceof Error ? e.message : String(e)}. ` +
          `If the path has spaces, wrap it in double quotes in .env.local.`
      )
    }
  }

  const b64 = process.env.GOOGLE_SIGNAGE_DRIVE_CREDENTIALS_BASE64?.trim()
  if (b64) {
    try {
      return Buffer.from(b64, 'base64').toString('utf8')
    } catch {
      throw new Error('GOOGLE_SIGNAGE_DRIVE_CREDENTIALS_BASE64 is not valid base64')
    }
  }

  const localPath = findLocalCredentialsFile()
  if (localPath) {
    try {
      return readCredentialsFile(localPath)
    } catch (e) {
      throw new Error(
        `Could not read ${localPath}: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  const inline = process.env.GOOGLE_SIGNAGE_DRIVE_CREDENTIALS?.trim()
  if (inline) return inline

  const defaultGuess = path.join(process.cwd(), DEFAULT_LOCAL_CREDENTIALS_REL)
  const onVercel = Boolean(process.env.VERCEL)

  if (onVercel) {
    throw new Error(
      'Google Drive credentials are not set for this deployment. Gitignored files (secrets/) are not uploaded to Vercel. ' +
        'In Vercel → Project → Settings → Environment Variables, add GOOGLE_SIGNAGE_DRIVE_CREDENTIALS_BASE64 ' +
        '(run `npm run drive-credentials-base64 -- secrets/google-signage-credentials.json` locally and paste the output). ' +
        'Also set GOOGLE_SIGNAGE_DRIVE_FOLDER_ID or configure the folder in Dashboard → Signage automation. Redeploy after saving env vars.'
    )
  }

  throw new Error(
    'Google Drive credentials not configured.\n' +
      `• Looked for ${DEFAULT_LOCAL_CREDENTIALS_REL} starting from cwd ${process.cwd()} (also searched parent folders).\n` +
      `• Expected at ${defaultGuess} — exists: ${fs.existsSync(defaultGuess)}\n` +
      '• Add the key file, or set GOOGLE_SIGNAGE_DRIVE_CREDENTIALS_PATH to an absolute path, or GOOGLE_SIGNAGE_DRIVE_CREDENTIALS_BASE64.\n' +
      'Restart `npm run dev` after editing .env.local. Share the Drive folder with the service account email (Editor).'
  )
}

function explainJsonParseFailure(s: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const t = s.replace(/^\uFEFF/, '').trimStart()
  let hint = ''
  if (t.startsWith('{') && t.length > 1) {
    const next = t[1]
    if (next === "'" || next === '`') {
      hint =
        ' Keys/strings must use double quotes ("). You likely pasted Python-style or corrupted quotes. '
    } else if (next !== '"' && !/\s/.test(next)) {
      hint = ` Invalid character after "{": expected a double-quoted key. `
    }
  }
  if (!hint && t.startsWith('{') && !t.includes('"type"') && t.length < 80) {
    hint = ' JSON looks truncated — inline .env values cannot span lines. '
  }
  return `${msg}.${hint}Remove GOOGLE_SIGNAGE_DRIVE_CREDENTIALS from .env.local if you use PATH or BASE64. Run: npm run drive-credentials-base64 -- path/to/key.json`
}

function parseServiceAccountJson(rawInput: string): { client_email: string; private_key: string } {
  let s = rawInput.replace(/^\uFEFF/, '').trim()
  // Whole value wrapped in quotes from copy/paste
  if (
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith('"') && s.endsWith('"') && s.length > 1)
  ) {
    s = s.slice(1, -1).trim()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(s)
  } catch (e) {
    throw new Error(
      `${explainJsonParseFailure(s, e)} Fix: set GOOGLE_SIGNAGE_DRIVE_CREDENTIALS_PATH to the downloaded .json file (quoted path if it contains spaces), ` +
        `or run \`npm run drive-credentials-base64 -- ./key.json\` and put the output in GOOGLE_SIGNAGE_DRIVE_CREDENTIALS_BASE64= (single line).`
    )
  }

  const o = parsed as Record<string, unknown>
  const client_email = typeof o.client_email === 'string' ? o.client_email : ''
  const private_key = typeof o.private_key === 'string' ? o.private_key : ''
  if (!client_email || !private_key) {
    throw new Error(
      'Service account JSON must include client_email and private_key. Prefer GOOGLE_SIGNAGE_DRIVE_CREDENTIALS_PATH.'
    )
  }
  return { client_email, private_key }
}

let cachedDriveAuth: InstanceType<typeof google.auth.JWT> | null = null
let cachedDriveClient: ReturnType<typeof google.drive> | null = null

function getDriveAuth() {
  if (cachedDriveAuth) return cachedDriveAuth
  const raw = loadCredentialsRaw()
  const creds = parseServiceAccountJson(raw)
  cachedDriveAuth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  return cachedDriveAuth
}

function getDriveClient() {
  if (cachedDriveClient) return cachedDriveClient
  cachedDriveClient = google.drive({ version: 'v3', auth: getDriveAuth() })
  return cachedDriveClient
}

function sanitizeFileName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

const FOLDER_MIME = 'application/vnd.google-apps.folder'

/**
 * Find or create a folder under `parentFolderId`. Use for per-batch dated uploads (YYYY-MM-DD).
 */
export async function ensureDriveSubfolder(params: {
  parentFolderId: string
  folderName: string
}): Promise<{ folderId: string; webViewLink: string }> {
  const drive = getDriveClient()
  const rawName = params.folderName.trim()
  const safeName = rawName.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const searchRes = await drive.files.list({
    q: `name='${safeName}' and '${params.parentFolderId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`,
    fields: 'files(id,webViewLink)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const existing = searchRes.data.files?.[0]
  if (existing?.id) {
    const meta = await drive.files.get({
      fileId: existing.id,
      fields: 'id,webViewLink',
      supportsAllDrives: true,
    })
    return { folderId: existing.id, webViewLink: meta.data.webViewLink || '' }
  }
  const created = await drive.files.create({
    requestBody: {
      name: rawName,
      parents: [params.parentFolderId],
      mimeType: FOLDER_MIME,
    },
    fields: 'id,webViewLink',
    supportsAllDrives: true,
  })
  const id = created.data.id || ''
  let link = created.data.webViewLink || ''
  if (id && !link) {
    const meta = await drive.files.get({
      fileId: id,
      fields: 'webViewLink',
      supportsAllDrives: true,
    })
    link = meta.data.webViewLink || ''
  }
  return { folderId: id, webViewLink: link }
}

export async function uploadSignagePngToDrive(params: {
  fileNameBase: string
  pngBuffer: Buffer
  folderId: string
}): Promise<{ fileId: string; webViewLink: string }> {
  const drive = getDriveClient()
  const name = `${sanitizeFileName(params.fileNameBase)}.png`
  const searchRes = await drive.files.list({
    q: `name='${name.replace(/'/g, "\\'")}' and '${params.folderId}' in parents and trashed=false`,
    fields: 'files(id,name,webViewLink)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const existing = searchRes.data.files?.[0]
  if (existing?.id) {
    const updated = await drive.files.update({
      fileId: existing.id,
      media: { mimeType: 'image/png', body: Readable.from(params.pngBuffer) },
      fields: 'id,webViewLink',
      supportsAllDrives: true,
    })
    return { fileId: updated.data.id || existing.id, webViewLink: updated.data.webViewLink || '' }
  }
  const created = await drive.files.create({
    requestBody: { name, parents: [params.folderId], mimeType: 'image/png' },
    media: { mimeType: 'image/png', body: Readable.from(params.pngBuffer) },
    fields: 'id,webViewLink',
    supportsAllDrives: true,
  })
  return { fileId: created.data.id || '', webViewLink: created.data.webViewLink || '' }
}
