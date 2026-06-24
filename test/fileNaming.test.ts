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
})
