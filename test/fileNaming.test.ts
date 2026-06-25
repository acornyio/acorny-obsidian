import { describe, it, expect } from 'vitest'
import { sanitizeFileBaseName } from '../src/fileNaming.js'

describe('sanitizeFileBaseName', () => {
  it('strips path separators and illegal characters', () => {
    expect(sanitizeFileBaseName('a/b\\c:d*e?f"g<h>i|j', 'src12345')).toBe('a-b-c-d-e-f-g-h-i-j')
  })
  it('falls back to Untitled-<id8> for empty/whitespace titles', () => {
    expect(sanitizeFileBaseName('   ', 'src12345678')).toBe('Untitled-src12345')
    expect(sanitizeFileBaseName(null, 'src12345678')).toBe('Untitled-src12345')
  })
  it('escapes Windows reserved names', () => {
    expect(sanitizeFileBaseName('CON', 'src12345678')).toBe('CON-src12345')
    expect(sanitizeFileBaseName('lpt1', 'src12345678')).toBe('lpt1-src12345')
  })
  it('NFC-normalizes and trims trailing dots/spaces', () => {
    expect(sanitizeFileBaseName('café. ', 'src1')).toBe('café'.normalize('NFC'))
  })
  it('truncates very long titles to 120 chars', () => {
    const long = 'x'.repeat(300)
    expect(sanitizeFileBaseName(long, 'src1').length).toBeLessThanOrEqual(120)
  })
  it('truncates long CJK titles within the filesystem byte budget', () => {
    // 120 CJK chars are ~360 UTF-8 bytes, which exceeds the 255-byte single-name
    // limit on ext4/Android. The result must fit a conservative byte budget.
    const long = '中'.repeat(300)
    const out = sanitizeFileBaseName(long, 'src1')
    expect(new TextEncoder().encode(out).length).toBeLessThanOrEqual(180)
    expect(out.length).toBeLessThanOrEqual(120)
    expect(out.length).toBeGreaterThan(0)
  })
  it('does not split a surrogate pair when truncating emoji titles', () => {
    const long = '😀'.repeat(200) // each: 2 UTF-16 units, 4 UTF-8 bytes
    const out = sanitizeFileBaseName(long, 'src1')
    expect(new TextEncoder().encode(out).length).toBeLessThanOrEqual(180)
    // no lone surrogate left behind by a mid-pair cut
    const hasLoneSurrogate = [...out].some(
      (ch) => ch.length === 1 && ch.charCodeAt(0) >= 0xd800 && ch.charCodeAt(0) <= 0xdfff,
    )
    expect(hasLoneSurrogate).toBe(false)
  })
  it('strips newlines/control chars from the title (would be ENOENT on Windows)', () => {
    const NL = String.fromCharCode(10)
    const CRLF = String.fromCharCode(13, 10)
    const TAB = String.fromCharCode(9)
    // the real-world case: a hard line break inside the source title
    expect(sanitizeFileBaseName(`专栏${NL} - 博客中国`, 'src1')).toBe('专栏 - 博客中国')
    expect(sanitizeFileBaseName(`a${TAB}b${CRLF}c`, 'src1')).toBe('a b c')
    // no control character survives into the result
    const out = sanitizeFileBaseName(`x${String.fromCharCode(0, 7)}y`, 'src1')
    expect([...out].every((ch) => (ch.codePointAt(0) ?? 0) > 0x1f)).toBe(true)
  })
})
