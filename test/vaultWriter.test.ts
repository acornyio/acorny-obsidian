import { describe, it, expect } from 'vitest'
import type { VaultGateway } from '../src/vaultGateway.js'
import { writeSourceNote, resolveNotePath } from '../src/vaultWriter.js'
import type { ExportFeedHighlight, ExportFeedSource } from '../src/types.js'

function fakeGateway(initial: Record<string, string> = {}): VaultGateway & { files: Record<string, string> } {
  const files = { ...initial }
  return {
    files,
    async exists(p) { return p in files },
    async read(p) { return files[p] },
    async create(p, c) { files[p] = c },
    async process(p, fn) { files[p] = fn(files[p]) },
    async listFolderNotes(folder) {
      return Object.keys(files).filter((p) => p.startsWith(`${folder}/`) && p.endsWith('.md'))
    },
    async readSourceId(p) {
      // Tolerate both quoted ("src1") and js-yaml's unquoted (src1) frontmatter.
      const m = files[p]?.match(/^acorny-source-id:\s*(.+?)\s*$/m)
      return m ? m[1].replace(/^"(.*)"$/, '$1') : null
    },
    async ensureFolder() {},
  }
}

const source: ExportFeedSource = { id: 'src1', title: 'Book', author: null, canonicalUrl: 'https://x', type: 'url' }
function hl(id: string): ExportFeedHighlight {
  return { id, quote: `q-${id}`, quoteMarkdown: null, note: null, tags: [], updatedAt: '', source }
}

describe('writeSourceNote', () => {
  it('creates a new note with all highlights when none exists', async () => {
    const g = fakeGateway()
    const index: Record<string, string> = {}
    const res = await writeSourceNote(g, 'Acorny', source, [hl('a'), hl('b')], index)
    expect(res.path).toBe('Acorny/Book.md')
    expect(res.added).toBe(2)
    expect(g.files['Acorny/Book.md']).toContain('^acorny-a')
    expect(index['src1']).toBe('Acorny/Book.md')
  })

  it('appends only not-yet-present highlights, preserving user edits', async () => {
    const g = fakeGateway({
      'Acorny/Book.md': '---\nacorny-source-id: "src1"\n---\n\n## Highlights\n- q-a ^acorny-a\n- MY EDIT\n',
    })
    const index = { src1: 'Acorny/Book.md' }
    const res = await writeSourceNote(g, 'Acorny', source, [hl('a'), hl('b')], index)
    expect(res.added).toBe(1) // only 'b' is new
    const content = g.files['Acorny/Book.md']
    expect(content).toContain('MY EDIT') // user line untouched
    expect(content).toContain('^acorny-b')
    expect((content.match(/\^acorny-a/g) ?? []).length).toBe(1) // no duplicate of 'a'
  })

  it('reuses the existing note after the source is renamed (anchor on source.id)', async () => {
    const g = fakeGateway({
      'Acorny/OldName.md': '---\nacorny-source-id: "src1"\n---\n\n## Highlights\n- q-a ^acorny-a\n',
    })
    const index: Record<string, string> = {} // index lost; must rebuild from frontmatter
    const renamed: ExportFeedSource = { ...source, title: 'New Name' }
    const res = await writeSourceNote(g, 'Acorny', renamed, [hl('a'), hl('b')], index)
    expect(res.path).toBe('Acorny/OldName.md') // reused, not a new New Name.md
    expect(Object.keys(g.files)).toEqual(['Acorny/OldName.md'])
  })

  it('disambiguates different sources that sanitize to the same name', async () => {
    const g = fakeGateway({
      'Acorny/Book.md': '---\nacorny-source-id: "OTHER"\n---\n\n## Highlights\n',
    })
    const index: Record<string, string> = {}
    const path = await resolveNotePath(g, 'Acorny', source, index)
    expect(path).toBe('Acorny/Book-src1.md')
  })

  it('disambiguates case-insensitively (book.md vs Book.md collide)', async () => {
    const g = fakeGateway({
      'Acorny/book.md': '---\nacorny-source-id: "OTHER"\n---\n\n## Highlights\n',
    })
    const path = await resolveNotePath(g, 'Acorny', source, {})
    expect(path).toBe('Acorny/Book-src1.md')
  })

  it('ignores a stale index entry that points at a note for a different source', async () => {
    const g = fakeGateway({
      // index says src1 -> Wrong.md, but Wrong.md actually anchors a DIFFERENT source
      'Acorny/Wrong.md': '---\nacorny-source-id: "OTHER"\n---\n\n## Highlights\n',
      'Acorny/Right.md': '---\nacorny-source-id: "src1"\n---\n\n## Highlights\n- q-a ^acorny-a\n',
    })
    const index = { src1: 'Acorny/Wrong.md' } // poisoned cache
    const res = await writeSourceNote(g, 'Acorny', source, [hl('a'), hl('b')], index)
    expect(res.path).toBe('Acorny/Right.md') // re-anchored by frontmatter, not the stale cache
    expect(g.files['Acorny/Wrong.md']).not.toContain('^acorny-b') // wrong file untouched
  })

  it('appends into the ## Highlights section, not after later user sections', async () => {
    const g = fakeGateway({
      'Acorny/Book.md': [
        '---', 'acorny-source-id: "src1"', '---', '',
        '## Highlights', '- q-a ^acorny-a', '',
        '## My Notes', 'user prose here', '',
      ].join('\n'),
    })
    const index = { src1: 'Acorny/Book.md' }
    await writeSourceNote(g, 'Acorny', source, [hl('a'), hl('b')], index)
    const content = g.files['Acorny/Book.md']
    // new item sits inside Highlights, before "## My Notes"
    expect(content.indexOf('^acorny-b')).toBeLessThan(content.indexOf('## My Notes'))
    expect(content).toContain('user prose here')
  })
})
