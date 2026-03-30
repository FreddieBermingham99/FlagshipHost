/**
 * Edge-compatible session verification for middleware (Web Crypto only).
 */

function base64UrlToString(b64url: string): string {
  const pad = b64url.length % 4 === 0 ? '' : '='.repeat(4 - (b64url.length % 4))
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + pad
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export async function verifyDashboardSessionTokenEdge(
  token: string,
  secret: string
): Promise<boolean> {
  const lastDot = token.lastIndexOf('.')
  if (lastDot <= 0) return false
  const body = token.slice(0, lastDot)
  const sigHex = token.slice(lastDot + 1)
  if (!/^[0-9a-f]{64}$/i.test(sigHex)) return false

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  const expectedHex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  if (sigHex.length !== expectedHex.length) return false
  let diff = 0
  for (let i = 0; i < sigHex.length; i++) {
    diff |= sigHex.charCodeAt(i) ^ expectedHex.charCodeAt(i)
  }
  if (diff !== 0) return false

  try {
    const json = JSON.parse(base64UrlToString(body)) as { exp?: number }
    return typeof json.exp === 'number' && json.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}
