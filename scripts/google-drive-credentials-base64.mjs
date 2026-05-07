#!/usr/bin/env node
/**
 * Prints base64 of a Google service account JSON file for GOOGLE_SIGNAGE_DRIVE_CREDENTIALS_BASE64.
 * Usage: npm run drive-credentials-base64 -- path/to/service-account.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const rel = process.argv[2]
if (!rel) {
  console.error('Usage: npm run drive-credentials-base64 -- <path-to-service-account.json>')
  process.exit(1)
}

const abs = path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel)
let buf
try {
  buf = fs.readFileSync(abs)
} catch (e) {
  if (e && e.code === 'ENOENT') {
    console.error(`File not found: ${abs}`)
    console.error(
      'Use the real path to your GCP service account JSON (filename usually ends in .json). ' +
        'If you saved it as secrets/google-signage-credentials without an extension, rename it to google-signage-credentials.json.'
    )
    process.exit(1)
  }
  throw e
}
process.stdout.write(buf.toString('base64'))
process.stdout.write('\n')
