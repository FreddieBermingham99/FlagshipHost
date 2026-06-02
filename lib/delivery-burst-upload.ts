import 'server-only'

import { Readable } from 'stream'
import { ensureDriveSubfolder, getDriveClient } from '@/lib/signage-automation/drive-upload'

export async function uploadDeliveryBurstPhoto(params: {
  fileNameBase: string
  buffer: Buffer
  mimeType: string
  campaignSlug: string
}): Promise<{ fileId: string; webViewLink: string }> {
  const rootFolder =
    process.env.DELIVERY_BURST_DRIVE_FOLDER_ID?.trim() ||
    process.env.GOOGLE_SIGNAGE_DRIVE_FOLDER_ID?.trim() ||
    ''

  if (!rootFolder) {
    throw new Error(
      'No Drive folder configured. Set DELIVERY_BURST_DRIVE_FOLDER_ID or GOOGLE_SIGNAGE_DRIVE_FOLDER_ID.'
    )
  }

  const sub = await ensureDriveSubfolder({
    parentFolderId: rootFolder,
    folderName: `delivery-burst-${params.campaignSlug}`,
  })

  const drive = getDriveClient()
  const ext = params.mimeType.includes('png') ? 'png' : 'jpg'
  const name = `${params.fileNameBase}.${ext}`.replace(/[^a-zA-Z0-9._-]+/g, '-')

  const created = await drive.files.create({
    requestBody: {
      name,
      parents: [sub.folderId],
      mimeType: params.mimeType,
    },
    media: { mimeType: params.mimeType, body: Readable.from(params.buffer) },
    fields: 'id,webViewLink',
    supportsAllDrives: true,
  })

  return {
    fileId: created.data.id || '',
    webViewLink: created.data.webViewLink || '',
  }
}
