export interface VaultGateway {
  exists(path: string): Promise<boolean>
  read(path: string): Promise<string>
  create(path: string, content: string): Promise<void>
  /** Atomic read-modify-write; fn receives current content, returns new content. */
  process(path: string, fn: (data: string) => string): Promise<void>
  /** List markdown note paths directly under a folder (non-recursive). */
  listFolderNotes(folder: string): Promise<string[]>
  /** Read `acorny-source-id` from a note's frontmatter, or null. */
  readSourceId(path: string): Promise<string | null>
  ensureFolder(folder: string): Promise<void>
}
