/**
 * GET /api/data 外层 handler —— 缓存层健壮性与响应缓存策略回归
 *
 * @description 覆盖两个生产环境特有、跑 dev 的 E2E 抓不到的问题：
 *
 *  1. **304 条件请求崩溃**：`cachedShared` 命中 If-None-Match / If-Modified-Since 时，
 *     Nitro 自行写入 304 并结束响应后返回 **undefined**（nitropack cache.mjs 的
 *     `if (handleCacheHeaders(...)) { return }`），外层不判空则 `shared.data` 抛 TypeError。
 *
 *  2. **共享缓存串用户**：内层缓存条目自带 `cache-control: s-maxage=3600`，且 Nitro 在
 *     **缓存命中**时同样会把该头复制到同一个 event 的响应上；而外层响应含按 IP 的
 *     `liked`。若不覆盖，CDN / 边缘 / nginx 会把它缓存 1 小时并把某人的点赞态发给其他人。
 *
 *     本用例的桩会忠实模拟「内层先写上 s-maxage」，再断言外层写入的 `private, no-store`
 *     最终生效（同一个响应对象上后写覆盖前写）。
 *
 *     Nitro / h3 的自动导入是编译期裸标识符，这里桩到全局后动态加载**真实 handler**。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  getClientIpMock,
  fetchLikedConcertIdsMock,
  likedIds,
  innerResultRef
} = vi.hoisted(() => ({
  getClientIpMock: vi.fn(() => '203.0.113.9'),
  fetchLikedConcertIdsMock: vi.fn(async () => new Set<number>([2])),
  likedIds: new Set<number>([2]),
  /** 内层共享层的返回值：按用例注入 · injected per test */
  innerResultRef: { value: undefined as unknown }
}))

vi.mock('../../server/lib/turso', () => ({
  getTursoClient: () => ({ __client: true })
}))

vi.mock('../../server/lib/mappers', () => ({
  getClientIp: (...args: unknown[]) => getClientIpMock(...args),
  fetchLikedConcertIds: (...args: unknown[]) => fetchLikedConcertIdsMock(...args),
  fetchAllConcerts: vi.fn(),
  fetchSiteSeo: vi.fn(),
  fetchFriendLinks: vi.fn(),
  parseI18n: (v: string) => JSON.parse(v),
  LOCALES: ['zh-CN', 'en', 'zh-Hant']
}))

/** 内层缓存条目自带的 cache-control（与 nitropack cache.mjs 生成的一致）· header emitted by Nitro */
const NITRO_CACHE_CONTROL = 's-maxage=3600, stale-while-revalidate'

/** 记录 `defineCachedEventHandler` 收到的选项，用于断言走的是生产缓存分支 */
let cachedOptions: Record<string, unknown> | null = null

/** 构造带可写响应头的假 event · fake event carrying writable response headers */
function fakeEvent() {
  const headers: Record<string, string> = {}
  return {
    __headers: headers,
    node: {
      res: {
        headersSent: false,
        writableEnded: false,
        setHeader(name: string, value: string) {
          headers[String(name).toLowerCase()] = value
          return this
        },
        getHeader(name: string) {
          return headers[String(name).toLowerCase()]
        },
        getHeaders() {
          return headers
        }
      }
    }
  }
}

beforeEach(() => {
  cachedOptions = null
  fetchLikedConcertIdsMock.mockClear()
  getClientIpMock.mockClear()
  fetchLikedConcertIdsMock.mockImplementation(async () => likedIds)

  // Nitro / h3 自动导入：业务源码以裸标识符使用，单测里桩到全局。
  vi.stubGlobal('defineEventHandler', (h: unknown) => h)
  vi.stubGlobal('defineCachedEventHandler', (_h: unknown, opts: Record<string, unknown>) => {
    cachedOptions = opts
    // 忠实模拟内层行为：命中缓存时把条目的 headers 写到同一个 event 上再返回 body
    return async (event: ReturnType<typeof fakeEvent>) => {
      event.node.res.setHeader('cache-control', NITRO_CACHE_CONTROL)
      event.node.res.setHeader('etag', 'W/"deadbeef"')
      event.node.res.setHeader('last-modified', 'Mon, 01 Jan 2024 00:00:00 GMT')
      return innerResultRef.value
    }
  })
  // 与 h3 一致：小写化 header 名后写入 node res
  vi.stubGlobal('setResponseHeader', (event: ReturnType<typeof fakeEvent>, name: string, value: string) => {
    event.node.res.setHeader(name, value)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** 重新加载真实 handler（reload so it picks up the current global stubs） */
async function loadHandler(): Promise<(event: unknown) => Promise<unknown>> {
  vi.resetModules()
  const mod = await import('../../server/api/data.get')
  return mod.default as (event: unknown) => Promise<unknown>
}

/** 构造一份正常的共享层响应体 · build a normal shared-layer payload */
function sharedBody() {
  return {
    data: {
      concerts: [{ id: 1, artist: 'A' }, { id: 2, artist: 'B' }],
      cities: [],
      wishes: [],
      stats: { totalConcerts: 2, totalArtists: 2, totalCities: 0, totalWishes: 0 },
      locale: null,
      generatedAt: 'T0'
    },
    generatedAt: 'T0'
  }
}

describe('GET /api/data 外层 handler · 生产缓存分支', () => {
  it('确实走的是生产缓存分支（maxAge/swr），与 bug 场景一致', async () => {
    await loadHandler()
    expect(cachedOptions).toMatchObject({ maxAge: 3600, swr: true, name: 'all-data' })
  })
})

describe('GET /api/data 外层 handler · 304 条件请求', () => {
  it('内层返回 undefined 时：不抛错、不查点赞、返回值也是 undefined', async () => {
    innerResultRef.value = undefined
    const handler = await loadHandler()

    await expect(handler(fakeEvent())).resolves.toBeUndefined()
    // 提前返回，避免处理已结束的响应、也避免一次无意义的按 IP 查询
    expect(getClientIpMock).not.toHaveBeenCalled()
    expect(fetchLikedConcertIdsMock).not.toHaveBeenCalled()
  })

  it('304 分支不再写任何响应头（响应已由内层结束）', async () => {
    innerResultRef.value = undefined
    const handler = await loadHandler()
    const event = fakeEvent()

    await handler(event)
    // cache-control 只剩内层写入的值，外层没有再动它
    expect(event.__headers['cache-control']).toBe(NITRO_CACHE_CONTROL)
  })

  it('响应体畸形（缺 data）时同样安全返回，不解引用崩溃', async () => {
    innerResultRef.value = {} as unknown
    const handler = await loadHandler()

    await expect(handler(fakeEvent())).resolves.toBeUndefined()
    expect(fetchLikedConcertIdsMock).not.toHaveBeenCalled()
  })
})

describe('GET /api/data 外层 handler · 个人态不可被共享缓存', () => {
  it('覆盖内层泄漏的 s-maxage，最终为 private, no-store', async () => {
    innerResultRef.value = sharedBody()
    const handler = await loadHandler()
    const event = fakeEvent()

    await handler(event)

    expect(event.__headers['cache-control']).toBe('private, no-store')
    expect(event.__headers['cache-control']).not.toContain('s-maxage')
  })

  it('保留 etag / last-modified 以维持条件请求（304）能力', async () => {
    innerResultRef.value = sharedBody()
    const handler = await loadHandler()
    const event = fakeEvent()

    await handler(event)

    expect(event.__headers.etag).toBe('W/"deadbeef"')
    expect(event.__headers['last-modified']).toBe('Mon, 01 Jan 2024 00:00:00 GMT')
  })

  it('正常命中缓存时按当前 IP 合并 liked，其余字段原样透传', async () => {
    innerResultRef.value = sharedBody()
    const handler = await loadHandler()

    const res = (await handler(fakeEvent())) as {
      data: { concerts: { id: number; liked: boolean }[]; stats: { totalConcerts: number } }
      generatedAt: string
    }

    expect(res.data.concerts.map((c) => [c.id, c.liked])).toEqual([[1, false], [2, true]])
    expect(res.data.stats.totalConcerts).toBe(2)
    expect(res.generatedAt).toBe('T0')
    expect(getClientIpMock).toHaveBeenCalledTimes(1)
    expect(fetchLikedConcertIdsMock).toHaveBeenCalledTimes(1)
  })
})
