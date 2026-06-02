import 'server-only'

import { google } from 'googleapis'
import type { DeliveryBurstCampaignRow, DeliveryBurstStashpointRow } from '@/lib/delivery-burst-db'
import { getDriveAuth } from '@/lib/signage-automation/drive-upload'

function getSheetsClient() {
  const auth = getDriveAuth()
  return google.sheets({ version: 'v4', auth })
}

export async function exportDeliveryBurstToGoogleSheet(params: {
  campaign: DeliveryBurstCampaignRow
  stashpoints: DeliveryBurstStashpointRow[]
}): Promise<{ spreadsheetUrl: string; spreadsheetId: string }> {
  const { campaign, stashpoints } = params
  const sheets = getSheetsClient()

  const title = `${campaign.city} — Delivery burst (${campaign.slug.slice(0, 8)})`
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [{ properties: { title: 'Results' } }],
    },
  })

  const spreadsheetId = createRes.data.spreadsheetId
  if (!spreadsheetId) {
    throw new Error('Failed to create Google Sheet')
  }

  const signageTypes = campaign.signage_types
  const headers = [
    'Stashpoint ID',
    'Business name',
    'Host name',
    'Address',
    'City',
    'Flagship (manual)',
    'Flagship (submission)',
    'Bookings (30d)',
    'Google review left',
    'Pavement sign ordered',
    ...signageTypes.map((t) => `Delivered: ${t}`),
    'Feedback / notes',
    'Completed at',
    'Storefront photo',
    'Signage photos',
  ]

  const rows = stashpoints.map((sp) => {
    const isFlagship = sp.is_flagship_manual || sp.is_flagship_submission
    void isFlagship
    return [
      sp.stashpoint_id,
      sp.business_name,
      sp.host_name ?? '',
      sp.address ?? '',
      sp.city,
      sp.is_flagship_manual ? 'Yes' : 'No',
      sp.is_flagship_submission ? 'Yes' : 'No',
      sp.bookings_last_30_days ?? '',
      sp.google_review_left === true ? 'Yes' : sp.google_review_left === false ? 'No' : '',
      sp.pavement_sign_ordered ? 'Yes' : 'No',
      ...signageTypes.map((t) => (sp.delivered_signage[t] ? 'Yes' : 'No')),
      sp.feedback_notes ?? '',
      sp.completed_at ? new Date(sp.completed_at).toISOString() : '',
      sp.photo_storefront_url ?? '',
      sp.photo_signage_urls.join(', '),
    ]
  })

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Results!A1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [headers, ...rows],
    },
  })

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
  return { spreadsheetUrl, spreadsheetId }
}
