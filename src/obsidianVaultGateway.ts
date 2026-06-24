import { App, TFile, TFolder, normalizePath } from 'obsidian'
import type { VaultGateway } from './vaultGateway.js'

export function createObsidianVaultGateway(app: App): VaultGateway {
  const fileAt = (path: string): TFile | null => {
    const f = app.vault.getAbstractFileByPath(normalizePath(path))
    return f instanceof TFile ? f : null
  }

  return {
    async exists(path) {
      return fileAt(path) !== null
    },
    async read(path) {
      const file = fileAt(path)
      if (!file) throw new Error(`File not found: ${path}`)
      return app.vault.read(file)
    },
    async create(path, content) {
      await app.vault.create(normalizePath(path), content)
    },
    async process(path, fn) {
      const file = fileAt(path)
      if (!file) throw new Error(`File not found: ${path}`)
      await app.vault.process(file, fn)
    },
    async listFolderNotes(folder) {
      const normalized = normalizePath(folder)
      const dir = app.vault.getAbstractFileByPath(normalized)
      if (!(dir instanceof TFolder)) return []
      return dir.children
        .filter((c): c is TFile => c instanceof TFile && c.extension === 'md')
        .map((f) => f.path)
    },
    async readSourceId(path) {
      const file = fileAt(path)
      if (!file) return null
      const cache = app.metadataCache.getFileCache(file)
      const value = cache?.frontmatter?.['acorny-source-id']
      return typeof value === 'string' ? value : null
    },
    async ensureFolder(folder) {
      const normalized = normalizePath(folder)
      if (!app.vault.getAbstractFileByPath(normalized)) {
        await app.vault.createFolder(normalized)
      }
    },
  }
}
