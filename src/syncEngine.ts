import type {
  AcornySettings, ExportFeedHighlight, ExportFeedResponse, ExportFeedSource, PluginState, SyncStatus,
} from './types.js'
import { AuthError, RateLimitError } from './apiClient.js'
import { connectionId } from './connection.js'

export type SyncResult =
  | { status: 'completed'; pages: number; added: number }
  | { status: 'skipped' }
  | { status: 'auth_failed' }
  | { status: 'backoff'; retryAfterSeconds: number }

export interface SyncEngineDeps {
  getSettings: () => AcornySettings
  loadState: () => Promise<PluginState>
  saveState: (state: PluginState) => Promise<void>
  fetchPage: (req: { serverUrl: string; token: string; cursor: string | null }) => Promise<ExportFeedResponse>
  writeSource: (
    source: ExportFeedSource,
    highlights: ExportFeedHighlight[],
    index: Record<string, string>,
  ) => Promise<{ path: string; added: number }>
  onStatus: (status: SyncStatus, detail?: string) => void
  /**
   * Optional lifecycle check. When it returns true (e.g. the plugin was disabled
   * or reloaded), the drain stops before the next fetch/write and the run does NOT
   * persist state — so a stale instance can never clobber a fresh one's data.
   */
  isAborted?: () => boolean
}

const MAX_PAGES = 10_000 // safety guard against a server bug looping forever

export class SyncEngine {
  private running = false
  constructor(private readonly deps: SyncEngineDeps) {}

  async sync(): Promise<SyncResult> {
    if (this.running) return { status: 'skipped' }
    this.running = true
    this.deps.onStatus('syncing')
    try {
      // Snapshot the connection ONCE at sync start so every page of this drain uses
      // the same server/token even if the user edits Settings mid-sync.
      const settings = this.deps.getSettings()
      const { serverUrl, exportToken: token } = settings
      const conn = connectionId(serverUrl, token)

      const aborted = this.deps.isAborted ?? (() => false)

      const state = await this.deps.loadState()
      // If the persisted cursor/index belong to a different server or account,
      // discard them — replaying a foreign cursor can silently skip data.
      const sameConnection = state.connectionId === conn
      const index = sameConnection ? { ...state.sourceIndex } : {}
      let cursor = sameConnection ? state.lastCursor : null
      let pages = 0
      let added = 0

      for (;;) {
        if (aborted()) return { status: 'skipped' }
        const page = await this.deps.fetchPage({ serverUrl, token, cursor })
        pages += 1
        for (const [, group] of groupBySource(page.highlights)) {
          if (aborted()) return { status: 'skipped' }
          const result = await this.deps.writeSource(group.source, group.highlights, index)
          added += result.added
        }
        cursor = page.nextCursor
        if (page.done) break
        if (pages >= MAX_PAGES) break
      }

      // Never persist on behalf of a disposed instance — it would overwrite the
      // live instance's state with a stale snapshot.
      if (aborted()) return { status: 'skipped' }
      await this.deps.saveState({ lastCursor: cursor, sourceIndex: index, connectionId: conn })
      this.deps.onStatus('idle')
      return { status: 'completed', pages, added }
    } catch (error) {
      if (error instanceof AuthError) {
        this.deps.onStatus('auth_failed', 'Export token rejected — check Settings.')
        return { status: 'auth_failed' }
      }
      if (error instanceof RateLimitError) {
        this.deps.onStatus('backoff', `Rate limited, retry in ${error.retryAfterSeconds}s`)
        return { status: 'backoff', retryAfterSeconds: error.retryAfterSeconds }
      }
      this.deps.onStatus('backoff', error instanceof Error ? error.message : 'Sync failed')
      return { status: 'backoff', retryAfterSeconds: 60 }
    } finally {
      this.running = false
    }
  }
}

function groupBySource(
  highlights: ExportFeedHighlight[],
): Map<string, { source: ExportFeedSource; highlights: ExportFeedHighlight[] }> {
  const groups = new Map<string, { source: ExportFeedSource; highlights: ExportFeedHighlight[] }>()
  for (const h of highlights) {
    const existing = groups.get(h.source.id)
    if (existing) existing.highlights.push(h)
    else groups.set(h.source.id, { source: h.source, highlights: [h] })
  }
  return groups
}
