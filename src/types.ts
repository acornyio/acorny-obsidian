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
  exportToken: string // acornyexp_...
  folderPath: string // vault-relative folder for synced notes
  syncOnStartup: boolean
  pollIntervalMinutes: number // 0 = disabled
}

export interface PluginState {
  lastCursor: string | null
  /** sourceId -> vault-relative note path (cache of the frontmatter anchor). */
  sourceIndex: Record<string, string>
  /**
   * Identity of the connection (server + account) the cursor/index belong to.
   * When the current connection differs, the cursor and index are discarded so a
   * cursor minted for one account is never replayed against another. `null` for
   * fresh installs and pre-upgrade state (forces a one-time full re-sync).
   */
  connectionId: string | null
}

export type SyncStatus = 'idle' | 'syncing' | 'backoff' | 'auth_failed'
