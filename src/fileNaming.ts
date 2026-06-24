// Illegal filename characters on Windows/macOS/Linux
// Note: space is NOT illegal but trailing spaces are trimmed separately
const ILLEGAL = /[/\\:*?"<>|]/g

const RESERVED = new Set([
  'con', 'prn', 'aux', 'nul',
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
])

const MAX_LEN = 120

/**
 * 将标题转换为合法的文件基础名称（无扩展名、无路径）。
 * - 非空且 ≤ 120 字符
 * - NFC 标准化
 * - 不包含路径分隔符或非法字符
 * - 不是 Windows 保留名称
 */
export function sanitizeFileBaseName(title: string | null, sourceId: string): string {
  const idSuffix = sourceId.slice(0, 8)

  // 1. NFC normalize
  const nfc = (title ?? '').normalize('NFC')

  // 2. Strip trailing dots and spaces BEFORE replacing illegal chars
  //    This ensures 'café. ' becomes 'café' cleanly
  const stripped = nfc.replace(/[. ]+$/g, '').trim()

  // 3. Replace illegal characters with hyphens
  const sanitized = stripped.replace(ILLEGAL, '-')

  // 4. Strip any trailing hyphens/dots/spaces that may have been introduced
  const raw = sanitized.replace(/[-. ]+$/g, '').trim()

  // 5. Fallback for empty result
  if (raw.length === 0) {
    return `Untitled-${idSuffix}`
  }

  // 6. Windows reserved names get a suffix
  if (RESERVED.has(raw.toLowerCase())) {
    return `${raw}-${idSuffix}`
  }

  // 7. Truncate to MAX_LEN
  return raw.length > MAX_LEN ? raw.slice(0, MAX_LEN).replace(/[-. ]+$/g, '') : raw
}
