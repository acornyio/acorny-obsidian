import type { VaultGateway } from './vaultGateway.js'
import type { ExportFeedHighlight, ExportFeedSource } from './types.js'
import { sanitizeFileBaseName } from './fileNaming.js'
import { renderNewNote, renderHighlightItems } from './renderer.js'
import { extractSyncedIds } from './blockId.js'

/** Find an existing note for this source by scanning folder frontmatter for acorny-source-id. */
async function findBySourceId(gateway: VaultGateway, folder: string, sourceId: string): Promise<string | null> {
  for (const path of await gateway.listFolderNotes(folder)) {
    if ((await gateway.readSourceId(path)) === sourceId) return path
  }
  return null
}

export async function resolveNotePath(
  gateway: VaultGateway,
  folder: string,
  source: ExportFeedSource,
  index: Record<string, string>,
): Promise<string> {
  // 1) cached index — verify the file still exists AND still anchors THIS source.id
  //    (a stale/poisoned cache must not append to a different source's note).
  const cached = index[source.id]
  if (cached && (await gateway.exists(cached)) && (await gateway.readSourceId(cached)) === source.id) {
    return cached
  }

  // 2) scan folder frontmatter (survives index loss / source rename / stale cache)
  const found = await findBySourceId(gateway, folder, source.id)
  if (found) {
    index[source.id] = found
    return found
  }

  // 3) fresh, unique name (case-insensitive comparison for case-insensitive filesystems)
  const base = sanitizeFileBaseName(source.title, source.id)
  const taken = new Set((await gateway.listFolderNotes(folder)).map((p) => p.toLowerCase()))
  const candidates = [`${folder}/${base}.md`, `${folder}/${base}-${source.id.slice(0, 8)}.md`]
  for (const candidate of candidates) {
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  for (let n = 2; ; n += 1) {
    const candidate = `${folder}/${base}-${source.id.slice(0, 8)}-${n}.md`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
}

export async function writeSourceNote(
  gateway: VaultGateway,
  folder: string,
  source: ExportFeedSource,
  highlights: ExportFeedHighlight[],
  index: Record<string, string>,
): Promise<{ path: string; added: number }> {
  await gateway.ensureFolder(folder)
  const path = await resolveNotePath(gateway, folder, source, index)

  if (!(await gateway.exists(path))) {
    await gateway.create(path, renderNewNote(source, highlights))
    index[source.id] = path
    return { path, added: highlights.length }
  }

  // read-check-write atomically; append only ids not already present
  let added = 0
  await gateway.process(path, (data) => {
    const present = extractSyncedIds(data)
    const fresh = highlights.filter((h) => !present.has(h.id))
    added = fresh.length
    if (fresh.length === 0) return data
    return appendToHighlightsSection(data, renderHighlightItems(fresh))
  })
  index[source.id] = path
  return { path, added }
}

/** Insert new items at the end of the `## Highlights` section (before the next heading / EOF). */
function appendToHighlightsSection(data: string, itemsBlock: string): string {
  const lines = data.split('\n')
  const headingIdx = lines.findIndex((l) => /^##\s+Highlights\s*$/.test(l))
  if (headingIdx === -1) {
    // user removed the section heading — conservative fallback: append at EOF
    const sep = data.endsWith('\n') ? '' : '\n'
    return `${data}${sep}${itemsBlock}\n`
  }
  // section ends at the next level-1/2 heading, else EOF
  let end = lines.length
  for (let i = headingIdx + 1; i < lines.length; i += 1) {
    if (/^#{1,2}\s+/.test(lines[i])) { end = i; break }
  }
  // skip back over trailing blank lines so items attach to the last content line
  let insertAt = end
  while (insertAt > headingIdx + 1 && lines[insertAt - 1].trim() === '') insertAt -= 1
  const next = [...lines.slice(0, insertAt), ...itemsBlock.split('\n'), ...lines.slice(insertAt)]
  return next.join('\n')
}
