import { App, normalizePath } from 'obsidian'
import type { VaultGateway } from './vaultGateway.js'

// Read `acorny-source-id` straight from the note's frontmatter text. We parse the
// file content rather than metadataCache because the cache is populated
// asynchronously and lags right after startup / external writes.
const SOURCE_ID_RE = /^acorny-source-id:\s*(.+?)\s*$/m

/**
 * Vault gateway backed by `vault.adapter` (the on-disk filesystem) rather than
 * Obsidian's in-memory file index. The index (`getAbstractFileByPath`,
 * `metadataCache`) lags behind disk after startup and external changes, which made
 * `exists()` mis-report and the writer crash with "file already exists" on re-sync.
 * The adapter reflects disk truth, so create/append decisions are reliable.
 */
export function createObsidianVaultGateway(app: App): VaultGateway {
  const adapter = app.vault.adapter

  // Create every segment of a folder path. We do NOT gate on adapter.exists() —
  // after an external folder delete it can report a stale "exists", which would
  // skip mkdir and make the subsequent write fail with ENOENT. Instead we attempt
  // mkdir for each segment and swallow the "already exists" error.
  const ensureDir = async (dir: string): Promise<void> => {
    const parts = normalizePath(dir).split('/').filter(Boolean)
    let current = ''
    for (const part of parts) {
      current = current ? `${current}/${part}` : part
      try {
        await adapter.mkdir(current)
      } catch {
        // already exists (or a concurrent create) — fine.
      }
    }
  }

  const parentOf = (path: string): string => {
    const normalized = normalizePath(path)
    const idx = normalized.lastIndexOf('/')
    return idx > 0 ? normalized.slice(0, idx) : ''
  }

  return {
    async exists(path) {
      return adapter.exists(normalizePath(path))
    },
    async read(path) {
      return adapter.read(normalizePath(path))
    },
    async create(path, content) {
      // Guarantee the parent folder exists right before writing (defends against a
      // stale ensureFolder / externally deleted folder → ENOENT).
      const parent = parentOf(path)
      if (parent) await ensureDir(parent)
      await adapter.write(normalizePath(path), content)
    },
    async process(path, fn) {
      // Read-modify-write on disk. writeSourceNote only appends, so a non-atomic
      // RMW here is safe; single-flight in the engine prevents concurrent writers.
      const normalized = normalizePath(path)
      const current = await adapter.read(normalized)
      await adapter.write(normalized, fn(current))
    },
    async listFolderNotes(folder) {
      const normalized = normalizePath(folder)
      if (!(await adapter.exists(normalized))) return []
      const { files } = await adapter.list(normalized)
      return files.filter((f) => f.endsWith('.md'))
    },
    async readSourceId(path) {
      const normalized = normalizePath(path)
      if (!(await adapter.exists(normalized))) return null
      const content = await adapter.read(normalized)
      const match = content.match(SOURCE_ID_RE)
      return match ? match[1].replace(/^"(.*)"$/, '$1') : null
    },
    async ensureFolder(folder) {
      await ensureDir(folder)
    },
  }
}
