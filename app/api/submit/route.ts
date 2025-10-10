export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const { formAction, ...data } = body as { formAction?: string; [key: string]: unknown };

    if (!formAction || typeof formAction !== 'string') {
      return new Response('Missing formAction', { status: 400 });
    }

    const upstream = await fetch(formAction, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return new Response(`Upstream error: ${upstream.status} ${upstream.statusText}\n${text}`, { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response('Unexpected error', { status: 500 });
  }
}


