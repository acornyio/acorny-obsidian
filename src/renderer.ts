import { stringifyYaml } from 'obsidian'
import type { ExportFeedHighlight, ExportFeedSource } from './types.js'
import { blockId } from './blockId.js'
import { resolveSourceHref } from './sourceHref.js'

export function toFrontmatter(source: ExportFeedSource, tags: string[] = []): string {
  // Build an ordered object and let Obsidian's YAML serializer handle all escaping
  // (colons, quotes, newlines, brackets). Using the built-in avoids bundling js-yaml.
  const data: Record<string, unknown> = { title: source.title }
  if (source.author) data.author = source.author
  // Match the web app's "From" link: prefer an http(s) canonicalUrl, else derive
  // from the author host; omit `source` entirely when no usable link exists
  // (rather than writing a dead `source://…` internal URI).
  const sourceHref = resolveSourceHref(source.type, source.canonicalUrl, source.author)
  if (sourceHref) data.source = sourceHref
  if (tags.length > 0) data.tags = tags
  data['acorny-source-id'] = source.id

  const body = stringifyYaml(data).replace(/\n+$/, '')
  return `---\n${body}\n---`
}

export function renderHighlightItem(h: ExportFeedHighlight): string {
  const text = (h.quoteMarkdown ?? h.quote).replace(/\s*\n\s*/g, ' ').trim()
  let item = `- ${text} ^${blockId(h.id)}`
  if (h.note && h.note.trim().length > 0) {
    item += `\n    - note: ${h.note.replace(/\s*\n\s*/g, ' ').trim()}`
  }
  return item
}

export function renderHighlightItems(hs: ExportFeedHighlight[]): string {
  return hs.map(renderHighlightItem).join('\n')
}

/** Union of tags across the source's highlights, stable-sorted, for the note frontmatter. */
function collectTags(hs: ExportFeedHighlight[]): string[] {
  const set = new Set<string>()
  for (const h of hs) for (const t of h.tags) set.add(t)
  return [...set].sort((a, b) => a.localeCompare(b))
}

export function renderNewNote(source: ExportFeedSource, hs: ExportFeedHighlight[]): string {
  return [
    toFrontmatter(source, collectTags(hs)),
    '',
    '## Highlights',
    renderHighlightItems(hs),
    '',
  ].join('\n')
}
