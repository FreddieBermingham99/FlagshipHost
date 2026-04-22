import { randomUUID } from 'crypto'
import {
  insertSubmission,
  isSubmissionsDbConfigured,
  listSignageCatalogItems,
  upsertSignageOrder,
  type SignageOrderItemInsert,
} from '@/lib/submissions-db'
import { catalogNameForPickerId } from '@/lib/signage-picker-mapping'
import { findStashpointRowById } from '@/lib/flagship-business'
import { isStasherDbConfigured, listStashpointsFromDb } from '@/lib/stasher-db'

type ProgrammeSubmitSlot = {
  stashpoint_id: string | null
  business_name: string
  city: string
  country: string | null
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}))
    const { formAction, ...data } = body as { formAction?: string; [key: string]: unknown }

    if (isSubmissionsDbConfigured()) {
      try {
        const name = String(data.name ?? '')
        const email = String(data.email ?? '')
        const businessName = String(data.business ?? data.business_name ?? '')
        const city = String(data.city ?? '')
        const source = String(data.source ?? 'flagship')
        const hostId = data.hostId ? String(data.hostId).trim() : ''

        let signs: string[] = []
        try {
          const raw = data.selectedSigns
          if (typeof raw === 'string') signs = JSON.parse(raw)
          else if (Array.isArray(raw)) signs = raw as string[]
        } catch {
          signs = []
        }

        const selectedTier = data.selectedTier ? String(data.selectedTier) : null

        const slots = await resolveProgrammeSubmitSlots({
          source,
          hostId,
          stashpointId: data.stashpointId ? String(data.stashpointId) : '',
          businessName,
          city,
          country: data.country ? String(data.country) : null,
        })

        const hasBusiness = slots.some((s) => s.business_name.trim().length > 0)
        if (name && email && hasBusiness) {
          const batchId =
            source === 'programme' && hostId && slots.length > 1 ? randomUUID() : null

          const shouldMirrorSignage =
            signs.length > 0 &&
            (source === 'flagship' || (source === 'programme' && selectedTier === 'pro'))

          for (const slot of slots) {
            if (!slot.business_name.trim()) continue

            await insertSubmission({
              source,
              stashpoint_id: slot.stashpoint_id,
              business_name: slot.business_name,
              city: slot.city,
              country: slot.country ?? (data.country ? String(data.country) : null),
              name,
              role: data.role ? String(data.role) : null,
              email,
              phone: data.phone ? String(data.phone) : null,
              notes: data.notes ? String(data.notes) : null,
              selected_tier: selectedTier,
              selected_signs: signs,
              host_id: hostId || null,
              submission_batch_id: batchId,
            })

            if (shouldMirrorSignage && slot.stashpoint_id) {
              try {
                await mirrorSignageOrderFromSubmission({
                  source,
                  selectedTier,
                  businessName: slot.business_name,
                  city: slot.city,
                  name,
                  email,
                  phone: data.phone ? String(data.phone) : null,
                  notes: data.notes ? String(data.notes) : null,
                  stashpointId: slot.stashpoint_id,
                  country: slot.country,
                  pickerIds: signs,
                  submissionBatchId: batchId,
                  hostId: hostId || null,
                })
              } catch (sigErr) {
                console.error('[submit] Failed to mirror signage order (non-blocking):', sigErr)
              }
            }
          }
        }
      } catch (dbErr) {
        console.error('[submit] DB save failed (non-blocking):', dbErr)
      }
    }

    const source = String(data.source ?? 'flagship')
    if (source !== 'programme' && formAction && typeof formAction === 'string') {
      const upstream = await fetch(formAction, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!upstream.ok) {
        const text = await upstream.text().catch(() => '')
        return new Response(`Upstream error: ${upstream.status} ${upstream.statusText}\n${text}`, {
          status: 502,
        })
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response('Unexpected error', { status: 500 })
  }
}

async function resolveProgrammeSubmitSlots(args: {
  source: string
  hostId: string
  stashpointId: string
  businessName: string
  city: string
  country: string | null
}): Promise<ProgrammeSubmitSlot[]> {
  if (args.source === 'programme' && args.hostId && isStasherDbConfigured()) {
    try {
      const rows = await listStashpointsFromDb({ hostId: args.hostId })
      if (rows.length > 0) {
        return rows.map((r) => ({
          stashpoint_id: String(r.stashpoint_id),
          business_name: r.business_name,
          city: r.city,
          country: r.country_code != null ? String(r.country_code) : null,
        }))
      }
    } catch (e) {
      console.error('[submit] Could not expand programme submit by host', e)
    }
  }

  return [
    {
      stashpoint_id: args.stashpointId.trim() || null,
      business_name: args.businessName,
      city: args.city,
      country: args.country,
    },
  ]
}

type MirrorArgs = {
  source: string
  selectedTier: string | null
  businessName: string
  city: string
  name: string
  email: string
  phone: string | null
  notes: string | null
  stashpointId: string | null
  country: string | null
  pickerIds: string[]
  submissionBatchId: string | null
  hostId: string | null
}

async function mirrorSignageOrderFromSubmission(args: MirrorArgs): Promise<void> {
  const normalizedSource = args.source === 'programme' ? 'programme_pro' : 'flagship'

  const catalog = await listSignageCatalogItems(false).catch(() => [])
  const byName = new Map<string, number>()
  for (const c of catalog) {
    byName.set(c.name.trim().toLowerCase(), c.id)
  }

  const items: SignageOrderItemInsert[] = args.pickerIds.map((id) => {
    const canonicalName = catalogNameForPickerId(id)
    const catalogId = byName.get(canonicalName.trim().toLowerCase()) ?? null
    return {
      catalog_item_id: catalogId,
      item_name_snapshot: canonicalName,
      quantity: 1,
      selected_options: {},
    }
  })

  if (items.length === 0) return

  let addressLine1: string | null = null
  let addressCity: string | null = args.city || null
  let addressPostcode: string | null = null
  let addressCountry: string | null = args.country
  if (args.stashpointId) {
    try {
      const row = await findStashpointRowById(args.stashpointId)
      if (row) {
        addressLine1 = row.address ?? null
        addressCity = addressCity || row.city || null
        addressPostcode = row.postal_code ?? null
        addressCountry = addressCountry || row.country_code || null
      }
    } catch {
      // Non-fatal — we'll store the order without shipping address.
    }
  }

  await upsertSignageOrder({
    stashpoint_id: args.stashpointId,
    business_name: args.businessName,
    city: args.city || null,
    country: addressCountry,
    contact_name: args.name,
    contact_email: args.email,
    contact_phone: args.phone,
    address_line_1: addressLine1,
    address_line_2: null,
    address_city: addressCity,
    address_region: null,
    address_postcode: addressPostcode,
    address_country: addressCountry,
    notes: args.notes,
    source: normalizedSource,
    selected_tier: args.selectedTier,
    host_id: args.hostId,
    submission_batch_id: args.submissionBatchId,
    items,
  })
}
