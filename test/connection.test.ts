import { describe, it, expect } from 'vitest'
import { connectionId } from '../src/connection.js'

describe('connectionId', () => {
  it('is stable across trailing-slash and host-case differences', () => {
    expect(connectionId('https://API.acorny.io/', 't')).toBe(connectionId('https://api.acorny.io', 't'))
  })
  it('differs when the token (account) differs', () => {
    expect(connectionId('https://api.acorny.io', 'a')).not.toBe(connectionId('https://api.acorny.io', 'b'))
  })
  it('differs when the server differs', () => {
    expect(connectionId('https://api.acorny.io', 't')).not.toBe(connectionId('https://other.acorny.io', 't'))
  })
  it('ignores surrounding whitespace', () => {
    expect(connectionId('  https://api.acorny.io  ', ' t ')).toBe(connectionId('https://api.acorny.io', 't'))
  })
  it('treats case-different URL paths as different connections (path is case-sensitive)', () => {
    expect(connectionId('https://host/API', 't')).not.toBe(connectionId('https://host/api', 't'))
  })
  it('does not embed the raw token (stored as a hash)', () => {
    const id = connectionId('https://api.acorny.io', 'acornyexp_supersecretvalue')
    expect(id).not.toContain('supersecretvalue')
    expect(id).not.toContain('acornyexp_')
  })
})
