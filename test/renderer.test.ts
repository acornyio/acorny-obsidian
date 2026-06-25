import { describe, it, expect } from 'vitest'
import { load } from 'js-yaml'
import { renderHighlightItem, renderNewNote, toFrontmatter } from '../src/renderer.js'
import type { ExportFeedHighlight, ExportFeedSource } from '../src/types.js'

const source: ExportFeedSource = {
  id: 'src1', title: 'How to Read', author: 'Adler', canonicalUrl: 'https://x', type: 'url',
}
function hl(over: Partial<ExportFeedHighlight> = {}): ExportFeedHighlight {
  return { id: 'h1', quote: 'plain', quoteMarkdown: null, note: null, tags: [], updatedAt: '', source, ...over }
}

describe('renderHighlightItem', () => {
  it('prefers quoteMarkdown and appends full block id', () => {
    const out = renderHighlightItem(hl({ quoteMarkdown: 'with **bold**', id: 'abc-1' }))
    expect(out).toBe('- with **bold** ^acorny-abc-1')
  })
  it('falls back to quote when quoteMarkdown is null', () => {
    expect(renderHighlightItem(hl({ quote: 'plain text', id: 'x' }))).toBe('- plain text ^acorny-x')
  })
  it('collapses internal newlines so the block id stays on one line', () => {
    expect(renderHighlightItem(hl({ quote: 'line1\nline2', id: 'x' }))).toBe('- line1 line2 ^acorny-x')
  })
  it('adds a note sub-item only when note is present', () => {
    expect(renderHighlightItem(hl({ note: 'my note', id: 'x' })))
      .toBe('- plain ^acorny-x\n    - note: my note')
    expect(renderHighlightItem(hl({ note: null, id: 'x' }))).toBe('- plain ^acorny-x')
  })
})

describe('toFrontmatter', () => {
  it('is valid YAML parseable back to the same fields (round-trip)', () => {
    const fm = toFrontmatter(source, ['learning', 'reading'])
    expect(fm.startsWith('---\n')).toBe(true)
    expect(fm.endsWith('\n---')).toBe(true)
    const body = fm.replace(/^---\n/, '').replace(/\n---$/, '')
    const parsed = load(body) as Record<string, unknown>
    expect(parsed).toEqual({
      title: 'How to Read', author: 'Adler', source: 'https://x',
      tags: ['learning', 'reading'], 'acorny-source-id': 'src1',
    })
  })
  it('omits author when null', () => {
    const body = toFrontmatter({ ...source, author: null }).replace(/^---\n/, '').replace(/\n---$/, '')
    expect(load(body)).not.toHaveProperty('author')
  })
  it('derives source from the author host when canonicalUrl is an internal source:// URI (matches web app)', () => {
    const body = toFrontmatter({
      ...source, type: 'document', canonicalUrl: 'source://document/abc', author: 'zh.wikipedia.org',
    }).replace(/^---\n/, '').replace(/\n---$/, '')
    expect((load(body) as Record<string, unknown>).source).toBe('https://zh.wikipedia.org')
  })
  it('omits source when no usable link can be derived (no dead source:// link)', () => {
    const body = toFrontmatter({
      ...source, type: 'document', canonicalUrl: 'source://document/abc', author: null,
    }).replace(/^---\n/, '').replace(/\n---$/, '')
    expect(load(body)).not.toHaveProperty('source')
  })
  it('safely serializes titles with YAML-hostile characters (colon, quote, newline, brackets)', () => {
    for (const title of ['a: b', 'a "q" b', 'line1\nline2', '[bracketed]']) {
      const body = toFrontmatter({ ...source, title }).replace(/^---\n/, '').replace(/\n---$/, '')
      expect((load(body) as { title: string }).title).toBe(title)
    }
  })
})

describe('renderNewNote', () => {
  it('emits frontmatter + Highlights heading + items', () => {
    const note = renderNewNote(source, [hl({ id: 'h1' }), hl({ id: 'h2' })])
    expect(note).toMatch(/^---\n/)
    expect(note).toContain('## Highlights')
    expect(note).toContain('^acorny-h1')
    expect(note).toContain('^acorny-h2')
  })
})
