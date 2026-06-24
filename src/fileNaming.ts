// Illegal filename characters on Windows/macOS/Linux
// Note: space is NOT illegal but trailing spaces are trimmed separately
const ILLEGAL = /[/\\:*?"<>|]/g

const RESERVED = new Set([
  'con', 'prn', 'aux', 'nul',
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
])

const MAX_LEN = 120
// Many filesystems (ext4, most Android storage) cap a single filename at 255 BYTES,
// not characters. 120 CJK chars ≈ 360 UTF-8 bytes would overflow. Truncate to a
// conservative byte budget that still leaves room for the ".md" extension and a
// "-<id8>" disambiguation suffix added by the caller.
const MAX_BYTES = 180

const encoder = new TextEncoder()

/**
 * 在不超过字节预算、且不切断 Unicode 码点（含代理对）的前提下截断字符串。
 * 同时受 maxChars（码点数）上限约束。
 */
function truncate(input: string, maxChars: number, maxBytes: number): string {
  if (input.length <= maxChars && encoder.encode(input).length <= maxBytes) {
    return input
  }
  let out = ''
  let chars = 0
  let bytes = 0
  // `for...of` iterates by code point, so an astral character (emoji) is never split.
  for (const ch of input) {
    const chBytes = encoder.encode(ch).length
    if (chars + 1 > maxChars || bytes + chBytes > maxBytes) break
    out += ch
    chars += 1
    bytes += chBytes
  }
  return out
}

/**
 * 将标题转换为合法的文件基础名称（无扩展名、无路径）。
 * - 非空且 ≤ 120 码点、≤ 180 UTF-8 字节
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

  // 7. Truncate to the char + byte budget on code-point boundaries, then re-trim
  //    any trailing separator/dot/space the cut may have exposed.
  const truncated = truncate(raw, MAX_LEN, MAX_BYTES)
  return truncated.length < raw.length ? truncated.replace(/[-. ]+$/g, '') : truncated
}
