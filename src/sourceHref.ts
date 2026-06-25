// Ported verbatim from the Acorny web app (packages/web apiService.resolveSourceHref)
// so the note's `source` frontmatter link matches what the web app shows as "From".
// The web app does NOT render a synthetic `source://…` canonicalUrl as a link; for
// non-url sources it falls back to the author field when that looks like a host.

export function isHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function toHostHref(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  if (isHttpUrl(trimmed)) return trimmed
  const hostLike = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:\/.*)?$/i.test(trimmed)
  if (!hostLike) return undefined
  return `https://${trimmed}`
}

/**
 * Resolve the link to put in a note's `source` frontmatter, mirroring the web app:
 * 1. http(s) canonicalUrl → use it;
 * 2. type 'url' without a real http URL → no link;
 * 3. otherwise → derive from the author field when it looks like a host.
 */
export function resolveSourceHref(
  sourceType: string,
  canonicalUrl: string | null | undefined,
  sourceAuthor: string | null | undefined,
): string | undefined {
  if (isHttpUrl(canonicalUrl)) return canonicalUrl ?? undefined
  if (sourceType === 'url') return undefined
  return toHostHref(sourceAuthor)
}
