import 'server-only'

import { getSignageAutomationSettings } from '@/lib/submissions-db'

export async function getAutomationConfig() {
  const settings = await getSignageAutomationSettings()
  const recipients = [
    process.env.SIGNAGE_DIGEST_PRIMARY_EMAIL?.trim() || '',
    ...settings.digest_recipients,
  ].filter(Boolean)
  return {
    ...settings,
    digest_recipients: [...new Set(recipients.map((r) => r.toLowerCase()))],
    google_drive_folder_id:
      settings.google_drive_folder_id || process.env.GOOGLE_SIGNAGE_DRIVE_FOLDER_ID?.trim() || '',
  }
}
