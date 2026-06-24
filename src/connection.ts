/**
 * Stable identity of an Acorny connection: normalized server URL + token.
 *
 * Persisted alongside the sync cursor so a cursor minted for one server/account
 * is never replayed against a different one (which could silently skip data).
 *
 * The return value contains the token and is for in-memory comparison only.
 * Never log it, surface it in a Notice, or put it in an error object.
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
  // A space cannot appear in a normalized URL or an Acorny token, so the two
  // parts can never collide on the delimiter.
  return `${normalizedUrl} ${token.trim()}`
}
