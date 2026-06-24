import { describe, it, expect, vi } from 'vitest'
import { SyncEngine } from '../src/syncEngine.js'
import { AuthError, RateLimitError } from '../src/apiClient.js'
import type { ExportFeedHighlight, ExportFeedResponse, PluginState } from '../src/types.js'

const source = { id: 'src1', title: 'B', author: null, canonicalUrl: 'https://x', type: 'url' }
function hl(id: string): ExportFeedHighlight {
  return { id, quote: id, quoteMarkdown: null, note: null, tags: [], updatedAt: '', source }
}

function makeEngine(pages: ExportFeedResponse[], over: Partial<ConstructorParameters<typeof SyncEngine>[0]> = {}) {
  let state: PluginState = { lastCursor: null, sourceIndex: {} }
  const saveState = vi.fn(async (s: PluginState) => { state = s })
  const writeSource = vi.fn(async () => ({ path: 'p', added: 1 }))
  const onStatus = vi.fn()
  let call = 0
  const fetchPage = vi.fn(async () => pages[call++])
  const engine = new SyncEngine({
    getSettings: () => ({ serverUrl: 's', exportToken: 't', folderPath: 'Acorny', syncOnStartup: false, pollIntervalMinutes: 0 }),
    loadState: async () => state,
    saveState,
    fetchPage,
    writeSource,
    onStatus,
    ...over,
  })
  return { engine, saveState, writeSource, onStatus, fetchPage, getState: () => state }
}

describe('SyncEngine.sync', () => {
  it('drains pages, writes grouped sources, persists cursor only when done', async () => {
    const { engine, saveState, writeSource } = makeEngine([
      { highlights: [hl('a'), hl('b')], nextCursor: 'c1', done: false },
      { highlights: [hl('c')], nextCursor: 'c2', done: true },
    ])
    const res = await engine.sync()
    expect(res).toMatchObject({ status: 'completed', pages: 2 })
    expect(writeSource).toHaveBeenCalledTimes(2) // one per page (single source each)
    expect(saveState).toHaveBeenCalledTimes(1)
    expect(saveState.mock.calls[0][0].lastCursor).toBe('c2')
  })

  it('is single-flight: a concurrent call returns skipped', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => { release = r })
    const { engine } = makeEngine([{ highlights: [], nextCursor: 'c', done: true }], {
      fetchPage: vi.fn(async () => { await gate; return { highlights: [], nextCursor: 'c', done: true } }),
    })
    const first = engine.sync()
    const second = await engine.sync()
    expect(second).toEqual({ status: 'skipped' })
    release()
    expect(await first).toMatchObject({ status: 'completed' })
  })

  it('on 401 sets auth_failed and does not persist cursor', async () => {
    const { engine, saveState, onStatus } = makeEngine([], {
      fetchPage: vi.fn(async () => { throw new AuthError() }),
    })
    expect(await engine.sync()).toEqual({ status: 'auth_failed' })
    expect(saveState).not.toHaveBeenCalled()
    expect(onStatus).toHaveBeenCalledWith('auth_failed', expect.anything())
  })

  it('on 429 sets backoff with retryAfter and does not persist cursor', async () => {
    const { engine, saveState } = makeEngine([], {
      fetchPage: vi.fn(async () => { throw new RateLimitError(42) }),
    })
    expect(await engine.sync()).toEqual({ status: 'backoff', retryAfterSeconds: 42 })
    expect(saveState).not.toHaveBeenCalled()
  })
})
