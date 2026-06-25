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
 * 把控制字符（C0 区 0x00–0x1F 及 DEL 0x7F，含换行/回车/制表符）替换为空格。
 * 文件名中含换行符会被操作系统拒绝（Windows 上报 ENOENT），所以标题里的硬换行
 * 必须在落盘前清掉。用逐码点判断，避免在源码里写 \u 转义。
 */
function stripControlChars(input: string): string {
  let out = ''
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0
    out += code <= 0x1f || code === 0x7f ? ' ' : ch
  }
  return out
}

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
 * - 不含控制字符/换行、路径分隔符或其它非法字符
 * - 不是 Windows 保留名称
 */
export function sanitizeFileBaseName(title: string | null, sourceId: string): string {
  const idSuffix = sourceId.slice(0, 8)

  const cleaned = stripControlChars((title ?? '').normalize('NFC'))
    .replace(ILLEGAL, '-') // path-illegal ASCII → hyphen
    .replace(/\s+/g, ' ') // collapse whitespace runs (incl. the spaces just inserted)
    .trim()
    .replace(/[-. ]+$/g, '') // strip trailing hyphen/dot/space
    .trim()

  if (cleaned.length === 0) {
    return `Untitled-${idSuffix}`
  }
  if (RESERVED.has(cleaned.toLowerCase())) {
    return `${cleaned}-${idSuffix}`
  }

  // Truncate on code-point boundaries within the char + byte budget, then re-trim
  // any trailing separator/dot/space the cut may have exposed.
  const truncated = truncate(cleaned, MAX_LEN, MAX_BYTES)
  return truncated.length < cleaned.length ? truncated.replace(/[-. ]+$/g, '') : truncated
}
