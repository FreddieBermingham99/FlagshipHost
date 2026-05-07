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
const buf = fs.readFileSync(abs)
process.stdout.write(buf.toString('base64'))
process.stdout.write('\n')
