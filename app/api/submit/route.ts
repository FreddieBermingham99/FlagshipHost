import { isSubmissionsDbConfigured, insertSubmission } from '@/lib/submissions-db'

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
            else if (Array.isArray(raw)) signs = raw
          } catch {}

          await insertSubmission({
            source: String(data.source ?? 'flagship'),
            stashpoint_id: data.stashpointId ? String(data.stashpointId) : null,
            business_name: businessName,
            city,
            country: data.country ? String(data.country) : null,
            name,
            role: data.role ? String(data.role) : null,
            email,
            phone: data.phone ? String(data.phone) : null,
            notes: data.notes ? String(data.notes) : null,
            selected_tier: data.selectedTier ? String(data.selectedTier) : null,
            selected_signs: signs,
          })
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
