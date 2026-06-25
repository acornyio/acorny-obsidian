import { describe, it, expect } from 'vitest'
import { isHttpUrl, toHostHref, resolveSourceHref } from '../src/sourceHref.js'

describe('isHttpUrl', () => {
  it('accepts http/https only', () => {
    expect(isHttpUrl('https://a.com')).toBe(true)
    expect(isHttpUrl('http://a.com')).toBe(true)
    expect(isHttpUrl('source://document/abc')).toBe(false)
    expect(isHttpUrl(null)).toBe(false)
    expect(isHttpUrl('not a url')).toBe(false)
  })
})

describe('toHostHref', () => {
  it('passes through http(s) and prefixes bare hosts', () => {
    expect(toHostHref('https://a.com')).toBe('https://a.com')
    expect(toHostHref('zh.wikipedia.org')).toBe('https://zh.wikipedia.org')
    expect(toHostHref('example.co.uk/path')).toBe('https://example.co.uk/path')
  })
  it('returns undefined for non-host text', () => {
    expect(toHostHref('Cal Newport')).toBeUndefined()
    expect(toHostHref('')).toBeUndefined()
    expect(toHostHref(null)).toBeUndefined()
  })
})

describe('resolveSourceHref (mirrors web apiService.resolveSourceHref)', () => {
  it('uses canonicalUrl when it is http(s)', () => {
    expect(resolveSourceHref('url', 'https://example.com/a', 'Author')).toBe('https://example.com/a')
    expect(resolveSourceHref('document', 'http://x.com', null)).toBe('http://x.com')
  })
  it('returns undefined for type=url without a real http canonicalUrl', () => {
    expect(resolveSourceHref('url', 'source://url/abc', 'Author')).toBeUndefined()
  })
  it('falls back to author host for non-url sources with an internal canonicalUrl', () => {
    // The 李白 case: type=document, synthetic canonicalUrl, author holds the domain.
    expect(resolveSourceHref('document', 'source://document/abc', 'zh.wikipedia.org')).toBe('https://zh.wikipedia.org')
  })
  it('returns undefined when no usable link can be derived', () => {
    expect(resolveSourceHref('document', 'source://document/abc', 'Cal Newport')).toBeUndefined()
    expect(resolveSourceHref('document', 'source://document/abc', null)).toBeUndefined()
  })
})
