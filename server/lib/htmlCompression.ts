/**
 * SSR HTML 压缩的纯逻辑 · Pure helpers for SSR HTML compression
 *
 * @module htmlCompression
 * @description 把「编码协商 / 是否压缩 / 响应头处理」从 Nitro 插件里抽成纯函数，便于单测覆盖
 *              q 值、大小写响应头、304/错误页、ETag/Vary 语义等边界，插件只负责 I/O。
 *
 *              Pure, testable helpers used by server/plugins/html-compression.ts.
 */

/** 支持的编码 · supported content encodings */
export type HtmlEncoding = 'br' | 'gzip'

/** 小于该体积不压缩（收益不足以抵 CPU）· skip tiny responses */
export const MIN_COMPRESS_BYTES = 1024

/**
 * 按 Accept-Encoding 协商编码 · negotiate encoding from Accept-Encoding
 * @description 解析 q 值（含 q=0 显式禁用与 `*` 通配），br 优先；无可用编码返回 null。
 *              修复点：旧实现用 `/\bbr\b/` 正则，会把 `br;q=0` 误判为可接受。
 */
export function negotiateEncoding(accept: string): HtmlEncoding | null {
  const entries = String(accept || '')
    .split(',')
    .map((part) => {
      const [name, ...params] = part.trim().split(';')
      let q = 1
      for (const param of params) {
        const match = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(param)
        if (match) {
          const parsed = Number(match[1])
          q = Number.isFinite(parsed) ? parsed : 0
        }
      }
      return { name: (name ?? '').trim().toLowerCase(), q }
    })
    .filter((entry) => entry.name !== '')

  const wildcard = entries.find((entry) => entry.name === '*')
  const quality = (name: HtmlEncoding): number => {
    const exact = entries.find((entry) => entry.name === name)
    if (exact) return exact.q
    return wildcard ? wildcard.q : 0
  }

  if (quality('br') > 0) return 'br'
  if (quality('gzip') > 0) return 'gzip'
  return null
}

/** 是否可压缩的判定上下文 · decision input */
export interface CompressionContext {
  statusCode?: number
  contentType?: string
  /** 已设置的 content-encoding（大小写不敏感由调用方处理）· already encoded upstream */
  contentEncoding?: string
  bodyLength: number
  /** 上游反代已压缩 / 显式关闭 · disabled by deployment */
  disabled?: boolean
  /** Nuxt 内部错误渲染路由（404/500）· Nuxt internal error render */
  errorRender?: boolean
}

/**
 * 解析真实响应状态 · resolve the effective status code
 * @description Nitro 的 404 / 500 错误页在 `render:response` 传入的 response 对象上常没有 statusCode，
 *              真实状态只写在 `event.node.res.statusCode`。任一来源为非 200 即按错误响应处理。
 *
 *              这不只是语义问题：错误页走的是另一条渲染路径，会把压缩后的 Buffer 当作字符串
 *              重新按 UTF-8 编码（非法字节被替换为 U+FFFD），客户端按 br 解压必然失败。
 *              Error pages travel a different render path that re-encodes the compressed Buffer as
 *              a UTF-8 string, corrupting the brotli stream — so they must never be compressed.
 */
export function resolveStatusCode(...candidates: Array<number | undefined>): number {
  for (const status of candidates) {
    if (status != null && status !== 200) return status
  }
  return 200
}

/**
 * 是否为 Nuxt 内部错误渲染路由 · whether this is Nuxt's internal error render
 * @description 404 / 500 由 `/__nuxt_error?...&statusCode=404` 渲染，`render:response` 触发时
 *              `response.statusCode` 与 `event.node.res.statusCode` **都还是 200**，真实状态只落在
 *              这个内部路径上，之后才由 Nitro 写回响应。该路径还会把 body 当作字符串重新编码，
 *              压缩后的二进制流会被 U+FFFD 替换字符破坏（客户端报 Decompression failed），
 *              因此必须显式识别并跳过，而不只是依赖状态码。
 */
export function isNuxtErrorRender(path: string): boolean {
  return String(path || '').split('?', 1)[0] === '/__nuxt_error'
}

/**
 * 是否可以压缩该响应 · whether this response may be compressed
 * @description 仅 200 + text/html + 字符串 body + 足够大 + 未被编码；
 *              304 / 错误页 / 非 HTML / 空 body 一律跳过（修复点：旧实现未检查 statusCode）。
 */
export function shouldCompress(ctx: CompressionContext): boolean {
  if (ctx.disabled) return false
  if (ctx.errorRender) return false
  if (ctx.statusCode != null && ctx.statusCode !== 200) return false
  if (!String(ctx.contentType ?? '').toLowerCase().includes('text/html')) return false
  if (ctx.contentEncoding) return false
  return ctx.bodyLength >= MIN_COMPRESS_BYTES
}

/**
 * 合并 Vary 值（去重、大小写不敏感）· append a Vary token once
 * @description 压缩与未压缩的 HTML 都必须声明 Vary，否则 CDN 可能把 br 版本发给只支持 gzip 的客户端。
 */
export function mergeVary(existing: string | undefined, value: string): string {
  const parts = String(existing ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (!parts.some((part) => part.toLowerCase() === value.toLowerCase())) parts.push(value)
  return parts.join(', ')
}

/** 大小写不敏感地读取响应头 · case-insensitive header lookup */
export function headerValue(
  headers: Record<string, string | undefined>,
  name: string
): string | undefined {
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase())
  return key ? headers[key] : undefined
}

/** 大小写不敏感地删除响应头 · case-insensitive header removal */
export function deleteHeader(headers: Record<string, string | undefined>, name: string): void {
  const lower = name.toLowerCase()
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) delete headers[key]
  }
}

/** 大小写不敏感地设置响应头（先删同名再写，避免重复）· case-insensitive header set */
export function setHeader(
  headers: Record<string, string | undefined>,
  name: string,
  value: string
): void {
  deleteHeader(headers, name)
  headers[name] = value
}
