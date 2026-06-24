/** Mirror of server /exports/highlights/feed response (acorny-server shared types). */
export interface ExportFeedSource {
  id: string
  title: string
  author: string | null
  canonicalUrl: string
  type: string
}

export interface ExportFeedHighlight {
  id: string
  quote: string
  quoteMarkdown: string | null
  note: string | null
  tags: string[]
  updatedAt: string
  source: ExportFeedSource
}

export interface ExportFeedResponse {
  highlights: ExportFeedHighlight[]
  nextCursor: string
  done: boolean
}

export interface AcornySettings {
  serverUrl: string // e.g. https://api.acorny.io
  exportToken: string // acornyexp_...
  folderPath: string // vault-relative folder for synced notes
  syncOnStartup: boolean
  pollIntervalMinutes: number // 0 = disabled
}

export interface PluginState {
  lastCursor: string | null
  /** sourceId -> vault-relative note path (cache of the frontmatter anchor). */
  sourceIndex: Record<string, string>
}

export type SyncStatus = 'idle' | 'syncing' | 'backoff' | 'auth_failed'
