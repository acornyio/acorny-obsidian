import { describe, it, expect, vi } from 'vitest'
import {
  fetchFeedPage, AuthError, RateLimitError, FeedRequestError,
  type HttpRequest,
} from '../src/apiClient.js'

const ok = { highlights: [], nextCursor: 'c1', done: true }

describe('fetchFeedPage', () => {
  it('builds the URL with cursor+limit and Authorization header', async () => {
    const http = vi.fn<HttpRequest>().mockResolvedValue({ status: 200, json: ok, headers: {} })
    const res = await fetchFeedPage(http, { serverUrl: 'https://a.io/', token: 'acornyexp_x', cursor: 'abc', limit: 50 })
    expect(res).toEqual(ok)
    const arg = http.mock.calls[0][0]
    expect(arg.url).toBe('https://a.io/api/v1/exports/highlights/feed?limit=50&cursor=abc')
    expect(arg.headers.Authorization).toBe('Token acornyexp_x')
  })

  it('omits cursor param on first sync (null)', async () => {
    const http = vi.fn<HttpRequest>().mockResolvedValue({ status: 200, json: ok, headers: {} })
    await fetchFeedPage(http, { serverUrl: 'https://a.io', token: 't', cursor: null })
    expect(http.mock.calls[0][0].url).toBe('https://a.io/api/v1/exports/highlights/feed?limit=100')
  })

  it('throws AuthError on 401', async () => {
    const http = vi.fn<HttpRequest>().mockResolvedValue({ status: 401, json: {}, headers: {} })
    await expect(fetchFeedPage(http, { serverUrl: 'https://a.io', token: 't', cursor: null })).rejects.toBeInstanceOf(AuthError)
  })

  it('throws RateLimitError with retryAfter on 429', async () => {
    const http = vi.fn<HttpRequest>().mockResolvedValue({ status: 429, json: { retryAfter: 30 }, headers: { 'retry-after': '30' } })
    await expect(fetchFeedPage(http, { serverUrl: 'https://a.io', token: 't', cursor: null }))
      .rejects.toMatchObject({ name: 'RateLimitError', retryAfterSeconds: 30 })
  })

  it('throws FeedRequestError on 500', async () => {
    const http = vi.fn<HttpRequest>().mockResolvedValue({ status: 500, json: {}, headers: {} })
    await expect(fetchFeedPage(http, { serverUrl: 'https://a.io', token: 't', cursor: null })).rejects.toBeInstanceOf(FeedRequestError)
  })
})
