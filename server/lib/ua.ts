/**
 * 服务端 User-Agent 解析 · Server-side User-Agent parsing
 *
 * @module server/lib/ua
 * @description 从原始 UA 字符串解析出「浏览器」与「操作系统」，供留言/回复写操作时采集。
 *              相比参考页在前端用 `navigator.userAgent` 解析，服务端解析更可靠（不受前端伪造/缺失影响），
 *              且与 IP 一样属于「服务端采集、不信任前端自报」的安全基线。
 *              覆盖主流浏览器（Edge/Opera/Firefox/Chrome/Safari）与系统
 *              （Windows 10-11/Windows/macOS/Android/iOS/Linux）；命中未知时回退 'Unknown'。
 *
 *              Parse browser + OS from a raw UA string for guestbook write-time capture.
 *              Server-side parsing is more reliable than the reference's client-side navigator.userAgent,
 *              and (like the IP) is "server-collected, never client-claimed". Covers mainstream
 *              browsers/OSes; falls back to 'Unknown' on no match.
 */

/** 解析结果 · Parsed result */
export interface ParsedUA {
  /** 浏览器 · browser */
  browser: string
  /** 操作系统 · operating system */
  os: string
}

/**
 * 解析 UA 得到浏览器与操作系统 · Parse a UA into browser + OS
 * @param ua 原始 UA 字符串（可能为 null/空）· raw UA (may be null/empty)
 */
export function parseUserAgent(ua: string | null | undefined): ParsedUA {
  const s = (ua ?? '').trim()
  if (!s) return { browser: 'Unknown', os: 'Unknown' }

  // 浏览器 · browser（顺序敏感：Edge/Opera 含 Chrome 字样，须先判定）
  // order matters: Edge/Opera contain "Chrome"; detect them before Chrome
  let browser = 'Unknown Browser'
  if (/Edg\//.test(s)) browser = 'Edge'
  else if (/OPR\/|Opera/.test(s)) browser = 'Opera'
  else if (/Firefox\//.test(s)) browser = 'Firefox'
  else if (/Chrome\//.test(s)) browser = 'Chrome'
  else if (/Safari\//.test(s) && !/Chrome/.test(s)) browser = 'Safari'

  // 操作系统 · operating system
  let os = 'Unknown OS'
  if (/Windows NT 10/.test(s)) os = 'Windows 10/11'
  else if (/Windows NT/.test(s)) os = 'Windows'
  else if (/Mac OS X/.test(s)) os = 'macOS'
  else if (/Android/.test(s)) os = 'Android'
  else if (/iPhone|iPad|iPod/.test(s)) os = 'iOS'
  else if (/Linux/.test(s)) os = 'Linux'

  return { browser, os }
}
