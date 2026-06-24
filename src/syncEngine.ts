import type {
  AcornySettings, ExportFeedHighlight, ExportFeedResponse, ExportFeedSource, PluginState, SyncStatus,
} from './types.js'
import { AuthError, RateLimitError } from './apiClient.js'

export type SyncResult =
  | { status: 'completed'; pages: number; added: number }
  | { status: 'skipped' }
  | { status: 'auth_failed' }
  | { status: 'backoff'; retryAfterSeconds: number }

export interface SyncEngineDeps {
  getSettings: () => AcornySettings
  loadState: () => Promise<PluginState>
  saveState: (state: PluginState) => Promise<void>
  fetchPage: (cursor: string | null) => Promise<ExportFeedResponse>
  writeSource: (
    source: ExportFeedSource,
    highlights: ExportFeedHighlight[],
    index: Record<string, string>,
  ) => Promise<{ path: string; added: number }>
  onStatus: (status: SyncStatus, detail?: string) => void
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
      const state = await this.deps.loadState()
      const index = { ...state.sourceIndex }
      let cursor = state.lastCursor
      let pages = 0
      let added = 0

      for (;;) {
        const page = await this.deps.fetchPage(cursor)
        pages += 1
        for (const [, group] of groupBySource(page.highlights)) {
          const result = await this.deps.writeSource(group.source, group.highlights, index)
          added += result.added
        }
        cursor = page.nextCursor
        if (page.done) break
        if (pages >= MAX_PAGES) break
      }

      await this.deps.saveState({ lastCursor: cursor, sourceIndex: index })
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
