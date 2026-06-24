const PREFIX = 'acorny-'
// Obsidian block ids allow alphanumerics and hyphens; capture our acorny-<uuid> ids.
const BLOCK_ID_RE = /\^acorny-([A-Za-z0-9-]+)/g

export function blockId(highlightId: string): string {
  return `${PREFIX}${highlightId}`
}

export function extractSyncedIds(content: string): Set<string> {
  const ids = new Set<string>()
  for (const match of content.matchAll(BLOCK_ID_RE)) {
    ids.add(match[1])
  }
  return ids
}
