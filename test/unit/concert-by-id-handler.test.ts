/**
 * GET /api/concerts/:id 外层 handler 单测 · per-concert detail handler
 *
 * @description 覆盖单场接口此前缺的单元测试：400（非法 id）/ 404（不存在）、
 *              按请求 IP 合并 liked、private,no-store 响应头、?lang 本地化、304 条件请求安全。
 *              内层 buildShared 由 defineCachedEventHandler 桩驱动（真实执行，仅绕过真实缓存），
 *              从而同步覆盖输入校验与本地化分支。
 *
 *              Tests previously uncovered: 400/404, per-IP liked merge, private header,
 *              ?lang localization, and 304 safety. The inner layer runs for real behind a
 *              defineCachedEventHandler stub (caching bypassed), covering validation + localization.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  fetchConcertMock,
  isConcertLikedMock,
  getClientIpMock,
  localizeConcertMock,
  concertRef,
  cacheUndefinedRef
} = vi.hoisted(() => ({
  fetchConcertMock: vi.fn(async () => null),
  isConcertLikedMock: vi.fn(async () => false),
  getClientIpMock: vi.fn(() => '203.0.113.9'),
  localizeConcertMock: vi.fn((c: Record<string, unknown>, locale: string) => ({ ...c, _locale: locale })),
  concertRef: { value: undefined as Record<string, unknown> | null },
  cacheUndefinedRef: { value: false }
}))

vi.mock('../../server/lib/turso', () => ({ getTursoClient: () => ({ __client: true }) }))
vi.mock('../../server/lib/mappers', () => ({
  getClientIp: (...args: unknown[]) => getClientIpMock(...args),
  isConcertLiked: (...args: unknown[]) => isConcertLikedMock(...args),
  fetchConcert: (...args: unknown[]) => fetchConcertMock(...args),
  LOCALES: ['zh-CN', 'en', 'zh-Hant']
}))
// localizeConcert 由 concert-by-id 直接从 app/utils 导入 · imported directly from app/utils by the handler
vi.mock('../../app/utils', () => ({
  localizeConcert: (...args: unknown[]) => localizeConcertMock(...args)
}))

let cachedOptions: Record<string, unknown> | null = null

/** 带可写响应头 / params / query 的假 event · fake event with writable headers/params/query */
function fakeEvent(params: Record<string, string> = {}, query: Record<string, string> = {}) {
  const headers: Record<string, string> = {}
  return {
    __headers: headers,
    __status: 200,
    __params: params,
    __query: query,
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
  concertRef.value = null
  cacheUndefinedRef.value = false
  fetchConcertMock.mockReset()
  isConcertLikedMock.mockReset()
  getClientIpMock.mockReset()
  localizeConcertMock.mockReset()
  fetchConcertMock.mockImplementation(async () => concertRef.value)
  isConcertLikedMock.mockImplementation(async () => true)
  getClientIpMock.mockImplementation(() => '203.0.113.9')

  vi.stubGlobal('defineEventHandler', (h: unknown) => h)
  // 内层真实执行，仅绕过真实缓存；cacheUndefinedRef 用于模拟缓存命中（304 返回 undefined）
  vi.stubGlobal('defineCachedEventHandler', (h: (e: any) => any, opts: Record<string, unknown>) => {
    cachedOptions = opts
    return async (event: any) => (cacheUndefinedRef.value ? undefined : h(event))
  })
  vi.stubGlobal('setResponseStatus', (event: any, status: number) => {
    event.__status = status
  })
  vi.stubGlobal('setResponseHeader', (event: any, name: string, value: string) => {
    event.__headers[String(name).toLowerCase()] = value
  })
  vi.stubGlobal('getRouterParam', (event: any, key: string) => event.__params[key])
  vi.stubGlobal('getQuery', (event: any) => event.__query)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** 重新加载真实 handler（reload so it picks up the current global stubs） */
async function loadHandler(): Promise<(event: any) => Promise<unknown>> {
  vi.resetModules()
  const mod = await import('../../server/api/concerts/[id].get')
  return mod.default as (event: any) => Promise<unknown>
}

const baseConcert = (id: number) => ({
  id,
  artist: 'Artist',
  concertName: 'C',
  liked: false,
  likes: 5,
  theme: 'T',
  date: '2024-05-01',
  poster: '/p.jpg'
})

describe('GET /api/concerts/:id — 输入校验', () => {
  it('非正整数 id → 400', async () => {
    const handler = await loadHandler()
    const event = fakeEvent({ id: 'abc' })
    const res = (await handler(event)) as { error?: string }
    expect(event.__status).toBe(400)
    expect(res.error).toMatch(/invalid/i)
  })

  it('演唱会不存在 → 404，且不含 id（不会被外层当作 concert 合并）', async () => {
    concertRef.value = null
    const handler = await loadHandler()
    const event = fakeEvent({ id: '1' })
    const res = (await handler(event)) as Record<string, unknown>
    expect(event.__status).toBe(404)
    expect(res).not.toHaveProperty('id')
  })
})

describe('GET /api/concerts/:id — 正常命中', () => {
  it('按请求 IP 合并 liked，并写 private, no-store 头', async () => {
    concertRef.value = baseConcert(1)
    isConcertLikedMock.mockImplementation(async () => true)
    const handler = await loadHandler()
    const event = fakeEvent({ id: '1' })
    const res = (await handler(event)) as { id: number; liked: boolean }
    expect(event.__status).toBe(200)
    expect(res.id).toBe(1)
    expect(res.liked).toBe(true)
    expect(event.__headers['cache-control']).toBe('private, no-store')
  })

  it('确实走生产缓存分支（maxAge/swr/name）', async () => {
    concertRef.value = baseConcert(1)
    await loadHandler()
    expect(cachedOptions).toMatchObject({ maxAge: 3600, swr: true, name: 'concert-by-id' })
  })

  it('?lang=zh-CN 时返回本地化结果', async () => {
    concertRef.value = baseConcert(1)
    const handler = await loadHandler()
    const event = fakeEvent({ id: '1' }, { lang: 'zh-CN' })
    const res = (await handler(event)) as { _locale?: string }
    expect(res._locale).toBe('zh-CN')
  })
})

describe('GET /api/concerts/:id — 304 条件请求安全', () => {
  it('内层缓存命中返回 undefined 时：不抛错、不写 private 头', async () => {
    cacheUndefinedRef.value = true
    const handler = await loadHandler()
    const event = fakeEvent({ id: '1' })
    const res = await handler(event)
    expect(res).toBeUndefined()
    expect(event.__headers['cache-control']).toBeUndefined()
  })
})
