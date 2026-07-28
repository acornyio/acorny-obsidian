import { describe, it, expect, vi } from 'vitest'
import { SyncEngine } from '../src/syncEngine.js'
import { AuthError, RateLimitError } from '../src/apiClient.js'
import type { ExportFeedHighlight, ExportFeedResponse, PluginState } from '../src/types.js'

const source = { id: 'src1', title: 'B', author: null, canonicalUrl: 'https://x', type: 'url' }
function hl(id: string): ExportFeedHighlight {
  return { id, quote: id, quoteMarkdown: null, note: null, tags: [], updatedAt: '', source }
}

function makeEngine(pages: ExportFeedResponse[], over: Partial<ConstructorParameters<typeof SyncEngine>[0]> = {}) {
  let state: PluginState = { lastCursor: null, sourceIndex: {}, connectionId: null }
  const saveState = vi.fn(async (s: PluginState) => { state = s })
  const writeSource = vi.fn(async () => ({ path: 'p', added: 1 }))
  const onStatus = vi.fn()
  let call = 0
  const fetchPage = vi.fn(async () => pages[call++])
  const engine = new SyncEngine({
    getSettings: () => ({ exportToken: 't', folderPath: 'Acorny', syncOnStartup: false, pollIntervalMinutes: 0 }),
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

  it('discards a cursor/index that belong to a different connection', async () => {
    // Persisted state was minted for a DIFFERENT server/account.
    let state: PluginState = { lastCursor: 'old-cursor', sourceIndex: { s1: 'stale.md' }, connectionId: 'other-conn' }
    const seenCursors: (string | null)[] = []
    const fetchPage = vi.fn(async (req: { serverUrl: string; token: string; cursor: string | null }) => {
      seenCursors.push(req.cursor)
      return { highlights: [], nextCursor: 'fresh', done: true } as ExportFeedResponse
    })
    const saveState = vi.fn(async (s: PluginState) => { state = s })
    const engine = new SyncEngine({
      getSettings: () => ({ exportToken: 't', folderPath: 'Acorny', syncOnStartup: false, pollIntervalMinutes: 0 }),
      loadState: async () => state,
      saveState,
      fetchPage,
      writeSource: vi.fn(async () => ({ path: 'p', added: 0 })),
      onStatus: vi.fn(),
    })

    await engine.sync()

    expect(seenCursors[0]).toBeNull() // foreign cursor discarded; first page fetched fresh
    expect(saveState.mock.calls[0][0].sourceIndex).toEqual({}) // stale index cleared
    expect(saveState.mock.calls[0][0].connectionId).not.toBe('other-conn') // re-stamped to current
  })

  it('aborts the in-flight drain and does NOT persist when disposed mid-sync', async () => {
    // The lifecycle flips to "disposed" while the first page is being fetched.
    let disposed = false
    const pages: ExportFeedResponse[] = [
      { highlights: [hl('a')], nextCursor: 'c1', done: false },
      { highlights: [hl('b')], nextCursor: 'c2', done: true },
    ]
    let call = 0
    const saveState = vi.fn(async () => {})
    const engine = new SyncEngine({
      getSettings: () => ({ exportToken: 't', folderPath: 'Acorny', syncOnStartup: false, pollIntervalMinutes: 0 }),
      loadState: async () => ({ lastCursor: null, sourceIndex: {}, connectionId: null }),
      saveState,
      fetchPage: vi.fn(async () => { const p = pages[call++]; disposed = true; return p }),
      writeSource: vi.fn(async () => ({ path: 'p', added: 1 })),
      onStatus: vi.fn(),
      isAborted: () => disposed,
    })

    const res = await engine.sync()

    expect(res).toEqual({ status: 'skipped' }) // bailed without completing
    expect(saveState).not.toHaveBeenCalled() // stale instance must not clobber persisted state
    expect(call).toBe(1) // stopped after the first page; did not fetch page 2
  })

  it('keeps the cursor when the connection is unchanged', async () => {
    // connectionId matches what the engine computes for the built-in server + token 't'.
    const { connectionId } = await import('../src/connection.js')
    const { ACORNY_API_BASE_URL } = await import('../src/apiClient.js')
    const conn = connectionId(ACORNY_API_BASE_URL, 't')
    let state: PluginState = { lastCursor: 'keep-me', sourceIndex: { s1: 'note.md' }, connectionId: conn }
    const seenCursors: (string | null)[] = []
    const fetchPage = vi.fn(async (req: { cursor: string | null }) => {
      seenCursors.push(req.cursor)
      return { highlights: [], nextCursor: 'next', done: true } as ExportFeedResponse
    })
    const engine = new SyncEngine({
      getSettings: () => ({ exportToken: 't', folderPath: 'Acorny', syncOnStartup: false, pollIntervalMinutes: 0 }),
      loadState: async () => state,
      saveState: vi.fn(async (s: PluginState) => { state = s }),
      fetchPage: fetchPage as never,
      writeSource: vi.fn(async () => ({ path: 'p', added: 0 })),
      onStatus: vi.fn(),
    })

    await engine.sync()

    expect(seenCursors[0]).toBe('keep-me') // existing cursor replayed for the same connection
  })
})
