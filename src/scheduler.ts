import type { SyncResult } from './syncEngine.js'

/**
 * Decide when (if ever) the next AUTOMATIC sync should run.
 * - auth_failed → null (pause until a manual sync re-enables auto)
 * - backoff     → retryAfterSeconds (one near retry; normal cadence resumes on success)
 * - completed/skipped → normal interval (or null if interval polling is disabled)
 */
export function nextAutoDelayMs(result: SyncResult, pollIntervalMinutes: number): number | null {
  const interval = pollIntervalMinutes > 0 ? pollIntervalMinutes * 60_000 : null
  switch (result.status) {
    case 'auth_failed':
      return null
    case 'backoff':
      return result.retryAfterSeconds * 1000
    case 'completed':
    case 'skipped':
      return interval
  }
}
