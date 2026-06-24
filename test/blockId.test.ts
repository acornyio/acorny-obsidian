import { describe, it, expect } from 'vitest'
import { blockId, extractSyncedIds } from '../src/blockId.js'

describe('blockId', () => {
  it('prefixes with acorny- and uses the full id', () => {
    expect(blockId('11111111-2222-3333-4444-555555555555'))
      .toBe('acorny-11111111-2222-3333-4444-555555555555')
  })
})

describe('extractSyncedIds', () => {
  it('finds all acorny block ids and strips the prefix', () => {
    const content = [
      '## Highlights',
      '- foo ^acorny-aaaa-1111',
      '- bar ^acorny-bbbb-2222',
      '- unrelated ^somethingElse',
    ].join('\n')
    expect(extractSyncedIds(content)).toEqual(new Set(['aaaa-1111', 'bbbb-2222']))
  })
  it('returns empty set when none', () => {
    expect(extractSyncedIds('no block ids here').size).toBe(0)
  })
})
