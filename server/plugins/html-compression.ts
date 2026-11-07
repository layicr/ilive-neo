/**
 * SSR HTML 响应压缩 · SSR HTML compression (Nitro)
 *
 * @module html-compression
 * @description `nitro.compressPublicAssets` 只处理 public/ 下的静态文件，动态 SSR HTML 仍是明文；
 *              首页 HTML 约 248 KB（含约 121 KB Nuxt payload），是慢网下最大的传输瓶颈。
 *              此处按 Accept-Encoding 对 text/html 做 brotli（优先）/ gzip 压缩，实测 46 KB / 63 KB。
 *
 *              纯逻辑（编码协商 / 是否压缩 / 响应头）位于 server/lib/htmlCompression.ts，
 *              由 test/unit/htmlCompression.test.ts 覆盖；插件只做 I/O。
 *
 * 安全审查修复要点：
 *  - 响应头一律大小写不敏感读写（旧实现只认小写键，Content-Length 删不掉会截断响应）
 *  - 压缩与未压缩的 HTML 统一声明 Vary；压缩后删除 etag / last-modified / content-length，
 *    避免 CDN 把 br 版本复用给仅支持 gzip 的客户端
 *  - 只压 200 且未被编码的 text/html；解析 q 值；异步压缩不阻塞事件循环
 *
 * 开关 Switch：部署在已开启压缩的反代 / CDN 之后，设 NUXT_DISABLE_HTML_COMPRESSION=1 关闭压缩。
 */
import { brotliCompress, constants, gzip } from 'node:zlib'
import { defineNitroPlugin } from '#imports'
import {
  deleteHeader,
  headerValue,
  isNuxtErrorRender,
  mergeVary,
  negotiateEncoding,
  resolveStatusCode,
  setHeader,
  shouldCompress,
  type HtmlEncoding
} from '../lib/htmlCompression'

/** 异步压缩，避免同步 zlib 调用阻塞事件循环 · async compression keeps the event loop free */
function compressAsync(raw: Buffer, encoding: HtmlEncoding): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const done = (err: Error | null, data?: Buffer) =>
      err ? reject(err) : resolve(data ?? Buffer.alloc(0))
    if (encoding === 'br') {
      brotliCompress(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }, done)
    } else {
      gzip(raw, { level: 6 }, done)
    }
  })
}

export default defineNitroPlugin((nitroApp) => {
  // hook 参数：response = { body, headers, statusCode }，event 为当前 H3Event
  nitroApp.hooks.hook('render:response', async (response, { event }) => {
    const headers = response.headers as Record<string, string | undefined>
    const contentType = headerValue(headers, 'content-type') ?? ''
    const isHtml = contentType.toLowerCase().includes('text/html')

    // 无论是否压缩，HTML 的多种表示都必须带 Vary（H3：否则未压缩响应可能被 CDN 错误复用）
    if (isHtml) {
      setHeader(headers, 'vary', mergeVary(headerValue(headers, 'vary'), 'Accept-Encoding'))
    }

    const accept = String(event.node.req.headers['accept-encoding'] ?? '')
    const encoding = negotiateEncoding(accept)
    if (!encoding || !isHtml) return
    if (typeof response.body !== 'string' || !response.body) return

    if (
      !shouldCompress({
        statusCode: resolveStatusCode(response.statusCode, event.node.res.statusCode),
        // Nuxt 的 404/500 走内部 /__nuxt_error 路由：hook 时两个状态码都还是 200，
        // 且该路径会把压缩 Buffer 当字符串重新编码 → 必须按路径显式跳过
        errorRender: isNuxtErrorRender(event.path),
        contentType,
        contentEncoding: headerValue(headers, 'content-encoding'),
        bodyLength: Buffer.byteLength(response.body, 'utf8'),
        disabled: process.env.NUXT_DISABLE_HTML_COMPRESSION === '1'
      })
    ) return

    const raw = Buffer.from(response.body, 'utf8')
    const encoded = await compressAsync(raw, encoding)

    // Nitro 最终把 body 交给 res.end()，Buffer 可原样写出（已由生产构建响应实测验证）
    response.body = encoded as unknown as string
    setHeader(headers, 'content-encoding', encoding)
    // 表示已变化：去掉共享校验头与旧长度，防止缓存串编码 / 响应被截断
    deleteHeader(headers, 'etag')
    deleteHeader(headers, 'last-modified')
    deleteHeader(headers, 'content-length')
  })
})
