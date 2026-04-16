import {
  insertSubmission,
  isSubmissionsDbConfigured,
  listSignageCatalogItems,
  upsertSignageOrder,
  type SignageOrderItemInsert,
} from '@/lib/submissions-db'
import { catalogNameForPickerId } from '@/lib/signage-picker-mapping'
import { findStashpointRowById } from '@/lib/flagship-business'

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const { formAction, ...data } = body as { formAction?: string; [key: string]: unknown };

    // Save to our submissions database (best-effort — don't block the upstream call)
    if (isSubmissionsDbConfigured()) {
      try {
        const name = String(data.name ?? '')
        const email = String(data.email ?? '')
        const businessName = String(data.business ?? data.business_name ?? '')
        const city = String(data.city ?? '')

        if (name && email && businessName) {
          let signs: string[] = []
          try {
            const raw = data.selectedSigns
            if (typeof raw === 'string') signs = JSON.parse(raw)
            else if (Array.isArray(raw)) signs = raw as string[]
          } catch {}

          const source = String(data.source ?? 'flagship')
          const selectedTier = data.selectedTier ? String(data.selectedTier) : null

          await insertSubmission({
            source,
            stashpoint_id: data.stashpointId ? String(data.stashpointId) : null,
            business_name: businessName,
            city,
            country: data.country ? String(data.country) : null,
            name,
            role: data.role ? String(data.role) : null,
            email,
            phone: data.phone ? String(data.phone) : null,
            notes: data.notes ? String(data.notes) : null,
            selected_tier: selectedTier,
            selected_signs: signs,
          })

          // Mirror flagship + programme-pro signage selections into the
          // signage_orders table so ALL signage orders live in one dashboard.
          const shouldMirrorSignage =
            signs.length > 0 &&
            (source === 'flagship' ||
              (source === 'programme' && selectedTier === 'pro'))

          if (shouldMirrorSignage) {
            try {
              await mirrorSignageOrderFromSubmission({
                source,
                selectedTier,
                businessName,
                city,
                name,
                email,
                phone: data.phone ? String(data.phone) : null,
                notes: data.notes ? String(data.notes) : null,
                stashpointId: data.stashpointId ? String(data.stashpointId) : null,
                country: data.country ? String(data.country) : null,
                pickerIds: signs,
              })
            } catch (sigErr) {
              console.error(
                '[submit] Failed to mirror signage order (non-blocking):',
                sigErr
              )
            }
          }
        }
      } catch (dbErr) {
        console.error('[submit] DB save failed (non-blocking):', dbErr)
      }
    }

    // Proxy to the upstream webhook for flagship submissions only
    const source = String(data.source ?? 'flagship')
    if (source !== 'programme' && formAction && typeof formAction === 'string') {
      const upstream = await fetch(formAction, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!upstream.ok) {
        const text = await upstream.text().catch(() => '');
        return new Response(`Upstream error: ${upstream.status} ${upstream.statusText}\n${text}`, { status: 502 });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response('Unexpected error', { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
}

/**
 * Builds a signage_orders row + signage_order_items from a flagship or
 * programme-pro form submission. Picker IDs are mapped to catalog item names;
 * we try to link catalog_item_id when a match exists, and fall back to just a
 * name snapshot otherwise. Address is best-effort: pulled from the stashpoint
 * record when available, otherwise left null (fields were made nullable).
 */
async function mirrorSignageOrderFromSubmission(args: MirrorArgs): Promise<void> {
  const normalizedSource =
    args.source === 'programme' ? 'programme_pro' : 'flagship'

  // Look up catalog items by name so we can attach catalog_item_id.
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

  // Best-effort shipping details from the stashpoint read-only DB.
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
    items,
  })
}
