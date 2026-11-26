/**
 * SSR HTML 压缩纯逻辑单测 · htmlCompression helpers
 * @description 覆盖安全审查中针对 server/plugins/html-compression.ts 的实现边界：
 *              q 值协商、304/错误页、大小写响应头、统一 Vary、归一化强 ETag、
 *              If-None-Match 条件请求、原始哈希缓存键与 ETag 分离、有界 LRU 缓存、部署开关。
 */
import { describe, it, expect } from 'vitest'
import {
  MIN_COMPRESS_BYTES,
  negotiateEncoding,
  resolveStatusCode,
  isNuxtErrorRender,
  shouldCompress,
  mergeVary,
  headerValue,
  deleteHeader,
  setHeader,
  computeETag,
  computeContentKey,
  matchETag,
  createCompressionCache
} from '../../server/lib/htmlCompression'

describe('negotiateEncoding · Accept-Encoding 协商', () => {
  it('空 / identity / 不支持的编码返回 null', () => {
    expect(negotiateEncoding('')).toBeNull()
    expect(negotiateEncoding('identity')).toBeNull()
    expect(negotiateEncoding('deflate')).toBeNull()
  })

  it('br 优先于 gzip，且大小写不敏感', () => {
    expect(negotiateEncoding('gzip')).toBe('gzip')
    expect(negotiateEncoding('gzip, deflate, br')).toBe('br')
    expect(negotiateEncoding('BR;q=1, GZIP;q=0.5')).toBe('br')
  })

  it('q=0 显式禁用时不再选用该编码（旧正则实现会误判）', () => {
    expect(negotiateEncoding('br;q=0')).toBeNull()
    expect(negotiateEncoding('br;q=0, gzip;q=0')).toBeNull()
    expect(negotiateEncoding('br;q=0, gzip;q=0.8')).toBe('gzip')
  })

  it('支持 * 通配与 q 值排序', () => {
    expect(negotiateEncoding('*')).toBe('br')
    expect(negotiateEncoding('gzip;q=0, *;q=0.5')).toBe('br')
    expect(negotiateEncoding('br;q=0.2, gzip;q=0.9')).toBe('br') // br 仍可接受
  })
})

describe('shouldCompress · 压缩边界', () => {
  const base = { statusCode: 200, contentType: 'text/html; charset=utf-8', bodyLength: 10_000 }

  it('只对 200 + text/html + 足够大的字符串响应压缩', () => {
    expect(shouldCompress(base)).toBe(true)
    expect(shouldCompress({ ...base, statusCode: undefined })).toBe(true)
  })

  it('304 / 错误页 / 非 HTML / 小体积 / 已编码 / 开关关闭均跳过', () => {
    expect(shouldCompress({ ...base, statusCode: 304 })).toBe(false)
    expect(shouldCompress({ ...base, statusCode: 500 })).toBe(false)
    expect(shouldCompress({ ...base, contentType: 'application/json' })).toBe(false)
    expect(shouldCompress({ ...base, bodyLength: MIN_COMPRESS_BYTES - 1 })).toBe(false)
    expect(shouldCompress({ ...base, contentEncoding: 'br' })).toBe(false)
    expect(shouldCompress({ ...base, disabled: true })).toBe(false)
    expect(shouldCompress({ ...base, errorRender: true })).toBe(false)
  })

  it('content-type 大小写不敏感', () => {
    expect(shouldCompress({ ...base, contentType: 'TEXT/HTML' })).toBe(true)
  })
})

describe('resolveStatusCode · 真实状态解析（404 br 损坏回归）', () => {
  it('response 与 node res 均为 200 或为空时按 200 处理', () => {
    expect(resolveStatusCode(200, 200)).toBe(200)
    expect(resolveStatusCode(undefined, 200)).toBe(200)
    expect(resolveStatusCode(undefined, undefined)).toBe(200)
  })

  it('只写在 node res 上的 404 / 500 不能被当成 200', () => {
    expect(resolveStatusCode(undefined, 404)).toBe(404)
    expect(resolveStatusCode(200, 404)).toBe(404)
    expect(resolveStatusCode(undefined, 500)).toBe(500)
  })

  it('解析出错误状态后 shouldCompress 必须跳过', () => {
    const ctx = { contentType: 'text/html; charset=utf-8', bodyLength: 10_000 }
    expect(shouldCompress({ ...ctx, statusCode: resolveStatusCode(200, 404) })).toBe(false)
    expect(shouldCompress({ ...ctx, statusCode: resolveStatusCode(304, 200) })).toBe(false)
    expect(shouldCompress({ ...ctx, statusCode: resolveStatusCode(200, 200) })).toBe(true)
  })
})

describe('isNuxtErrorRender · Nuxt 内部错误渲染路由（br 损坏回归）', () => {
  it('普通页面路径不命中', () => {
    expect(isNuxtErrorRender('/')).toBe(false)
    expect(isNuxtErrorRender('/en')).toBe(false)
    expect(isNuxtErrorRender('/nonexistent-path')).toBe(false)
    expect(isNuxtErrorRender('')).toBe(false)
  })

  it('带 query 的 /__nuxt_error（404/500）必须命中', () => {
    expect(isNuxtErrorRender('/__nuxt_error?statusCode=404&url=%2Fmissing')).toBe(true)
    expect(isNuxtErrorRender('/__nuxt_error?error=true&statusCode=500')).toBe(true)
    expect(isNuxtErrorRender('/__nuxt_error')).toBe(true)
  })

  it('只匹配完整路径段，避免误伤相似前缀', () => {
    expect(isNuxtErrorRender('/__nuxt_error-page')).toBe(false)
    expect(isNuxtErrorRender('/foo/__nuxt_error')).toBe(false)
  })

  it('命中后即使状态码仍为 200 也不压缩', () => {
    const ctx = { contentType: 'text/html', bodyLength: 10_000, statusCode: 200 }
    expect(shouldCompress({ ...ctx, errorRender: isNuxtErrorRender('/__nuxt_error?statusCode=404') }))
      .toBe(false)
  })
})

describe('mergeVary · Vary 合并', () => {
  it('无现有值时补上 Accept-Encoding', () => {
    expect(mergeVary(undefined, 'Accept-Encoding')).toBe('Accept-Encoding')
    expect(mergeVary('', 'Accept-Encoding')).toBe('Accept-Encoding')
  })

  it('保留既有值，且不重复追加（大小写不敏感）', () => {
    expect(mergeVary('Origin', 'Accept-Encoding')).toBe('Origin, Accept-Encoding')
    expect(mergeVary('accept-encoding', 'Accept-Encoding')).toBe('accept-encoding')
    expect(mergeVary('Origin, accept-encoding, User-Agent', 'Accept-Encoding'))
      .toBe('Origin, accept-encoding, User-Agent')
  })
})

describe('响应头工具 · 大小写不敏感（H3/M6 回归）', () => {
  it('headerValue 能读到大写键', () => {
    expect(headerValue({ 'Content-Type': 'text/html', Vary: 'Origin' }, 'content-type')).toBe('text/html')
    expect(headerValue({ 'Content-Type': 'text/html' }, 'content-encoding')).toBeUndefined()
  })

  it('deleteHeader 能删掉 Content-Length / ETag 等大写键', () => {
    const headers: Record<string, string | undefined> = {
      'Content-Length': '248000',
      ETag: 'W/"abc"',
      'Last-Modified': 'Sat, 07 Nov 2026 00:00:00 GMT',
      'Content-Type': 'text/html'
    }
    deleteHeader(headers, 'content-length')
    deleteHeader(headers, 'etag')
    deleteHeader(headers, 'last-modified')
    expect(Object.keys(headers)).toEqual(['Content-Type'])
  })

  it('setHeader 先删同名再写，避免重复头', () => {
    const headers: Record<string, string | undefined> = {
      Vary: 'Origin',
      'CONTENT-ENCODING': 'gzip'
    }
    setHeader(headers, 'content-encoding', 'br')
    expect(headerValue(headers, 'Content-Encoding')).toBe('br')
    expect(Object.keys(headers).filter((k) => k.toLowerCase() === 'content-encoding')).toHaveLength(1)
  })
})

describe('computeETag / matchETag · 条件请求', () => {
  it('相同 HTML 得到同一强 ETag，内容变化后 ETag 变化', () => {
    const html = '<html>hello</html>'
    expect(computeETag(html)).toBe(computeETag(html))
    expect(computeETag(html)).not.toBe(computeETag('<html>world</html>'))
    expect(computeETag(html)).toMatch(/^"[0-9a-f]{24}"$/)
  })

  it('忽略 SSR 计时字段与毫秒时间戳，但原始数据变化仍改变缓存键', () => {
    const a = '<html>{"timeSsrStart":147},1795624665012</html>'
    const b = '<html>{"timeSsrStart":147},1795624665102</html>'
    expect(computeETag(a)).toBe(computeETag(b))
    expect(computeContentKey(a)).not.toBe(computeContentKey(b))
    expect(computeETag('<html>changed</html>')).not.toBe(computeETag(a))
  })

  it('If-None-Match 支持列表、弱比较与通配符', () => {
    const etag = '"abc123"'
    expect(matchETag('"abc123"', etag)).toBe(true)
    expect(matchETag('W/"abc123", "other"', etag)).toBe(true)
    expect(matchETag('*', etag)).toBe(true)
    expect(matchETag('"different"', etag)).toBe(false)
    expect(matchETag(undefined, etag)).toBe(false)
  })
})

describe('createCompressionCache · 有界缓存', () => {
  it('命中返回同一条目，超出上限淘汰最久未访问项', () => {
    const cache = createCompressionCache(2)
    const entry = (id: string) => ({
      etag: id,
      br: Buffer.from(`br-${id}`),
      gzip: Buffer.from(`gz-${id}`)
    })
    cache.set('a', entry('a'))
    cache.set('b', entry('b'))
    expect(cache.get('a')?.etag).toBe('a')
    cache.set('c', entry('c'))
    expect(cache.size).toBe(2)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')?.etag).toBe('a')
    expect(cache.get('c')?.etag).toBe('c')
  })
})
