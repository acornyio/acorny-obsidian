/**
 * cyrb53 — a fast, synchronous, non-cryptographic 53-bit string hash. Good enough
 * to detect "did the connection change?"; not used for any security decision.
 */
function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)
}

/**
 * Stable identity of an Acorny connection: a hash of the normalized server URL +
 * token. Persisted alongside the sync cursor so a cursor minted for one
 * server/account is never replayed against another (which could silently skip data).
 *
 * It is HASHED, not the raw value, so the token is never stored a second time in
 * plugin state (it already lives in settings). The hash is only compared for equality.
 */
export function connectionId(serverUrl: string, token: string): string {
  const trimmed = serverUrl.trim()
  let normalizedUrl: string
  try {
    // The URL constructor lower-cases the (case-insensitive) scheme and host but
    // preserves the path/query, which ARE case-sensitive — so two endpoints that
    // differ only by path case stay distinct connections.
    normalizedUrl = new URL(trimmed).toString().replace(/\/+$/, '')
  } catch {
    // Not a parseable absolute URL: keep the raw value (only trailing slashes
    // trimmed) so the identity is still stable run-to-run.
    normalizedUrl = trimmed.replace(/\/+$/, '')
  }
  // A space cannot appear in a normalized URL or an Acorny token, so it is a safe
  // delimiter between the two parts of the hash input.
  return cyrb53(`${normalizedUrl} ${token.trim()}`)
}
