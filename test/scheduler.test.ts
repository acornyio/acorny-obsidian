import { describe, it, expect } from 'vitest'
import { nextAutoDelayMs } from '../src/scheduler.js'

describe('nextAutoDelayMs', () => {
  it('resumes normal cadence after completed (interval enabled)', () => {
    expect(nextAutoDelayMs({ status: 'completed', pages: 1, added: 0 }, 60)).toBe(60 * 60_000)
  })
  it('returns null after completed when interval disabled (manual-only)', () => {
    expect(nextAutoDelayMs({ status: 'completed', pages: 1, added: 0 }, 0)).toBeNull()
  })
  it('pauses auto-trigger after auth_failed regardless of interval', () => {
    expect(nextAutoDelayMs({ status: 'auth_failed' }, 60)).toBeNull()
  })
  it('schedules a near retry after backoff using retryAfterSeconds', () => {
    expect(nextAutoDelayMs({ status: 'backoff', retryAfterSeconds: 42 }, 60)).toBe(42_000)
  })
  it('keeps existing cadence on skipped (no reschedule signal)', () => {
    expect(nextAutoDelayMs({ status: 'skipped' }, 60)).toBe(60 * 60_000)
  })
})
