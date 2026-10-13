/**
 * POST /api/guestbook 外层 handler 单测 · guestbook publish handler
 *
 * @description 覆盖留言发布接口的 HTTP 层（此前仅 guestbook.test.ts 测库函数，HTTP 层缺断言）：
 *              必填字段校验（400）、邮箱格式（400）、正常内容入库（200 + id）、限流（429 + Retry-After）。
 *
 *              Covers the HTTP layer of the guestbook publish endpoint (previously only the lib was tested):
 *              required-field validation (400), email format (400), successful insert (200 + id), rate limit (429).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { createGuestbookMock, getClientIpMock, parseUserAgentMock, rateLimitMock } = vi.hoisted(() => ({
  createGuestbookMock: vi.fn(async () => 1),
  getClientIpMock: vi.fn(() => '203.0.113.9'),
  parseUserAgentMock: vi.fn(() => ({ browser: 'Chrome', os: 'macOS' })),
  rateLimitMock: vi.fn(() => ({ allowed: true, retryAfter: 0 }))
}))

vi.mock('../../server/lib/turso', () => ({ getTursoClient: () => ({ __client: true }) }))
vi.mock('../../server/lib/mappers', () => ({
  createGuestbookMessage: (...args: unknown[]) => createGuestbookMock(...args),
  getClientIp: (...args: unknown[]) => getClientIpMock(...args)
}))
vi.mock('../../server/lib/ua', () => ({
  parseUserAgent: (...args: unknown[]) => parseUserAgentMock(...args)
}))
vi.mock('../../server/lib/rateLimit', () => ({
  rateLimit: (...args: unknown[]) => rateLimitMock(...args)
}))

function fakeEvent(body: Record<string, unknown> = {}, ua: string | null = 'Mozilla') {
  const headers: Record<string, string> = {}
  return {
    __body: body,
    __headers: headers,
    __status: 200,
    __ua: ua,
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
  createGuestbookMock.mockReset()
  getClientIpMock.mockReset()
  parseUserAgentMock.mockReset()
  rateLimitMock.mockReset()
  createGuestbookMock.mockImplementation(async () => 1)
  getClientIpMock.mockImplementation(() => '203.0.113.9')
  parseUserAgentMock.mockImplementation(() => ({ browser: 'Chrome', os: 'macOS' }))
  rateLimitMock.mockImplementation(() => ({ allowed: true, retryAfter: 0 }))

  vi.stubGlobal('defineEventHandler', (h: unknown) => h)
  vi.stubGlobal('setResponseStatus', (event: any, status: number) => {
    event.__status = status
  })
  vi.stubGlobal('setResponseHeader', (event: any, name: string, value: string) => {
    event.__headers[String(name).toLowerCase()] = value
  })
  vi.stubGlobal('readBody', async (event: any) => event.__body)
  vi.stubGlobal('getRequestHeader', (event: any, name: string) => (name === 'user-agent' ? event.__ua : null))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function loadHandler(): Promise<(event: any) => Promise<unknown>> {
  vi.resetModules()
  const mod = await import('../../server/api/guestbook.post')
  return mod.default as (event: any) => Promise<unknown>
}

describe('POST /api/guestbook — 输入校验', () => {
  it('缺任意必填字段 → 400', async () => {
    const handler = await loadHandler()
    const cases: Record<string, unknown>[] = [{}, { nickname: 'n' }, { nickname: 'n', email: 'a@b.com' }]
    for (const body of cases) {
      const event = fakeEvent(body)
      const res = (await handler(event)) as { error?: string }
      expect(event.__status, `body=${JSON.stringify(body)}`).toBe(400)
      expect(res.error).toMatch(/required/i)
    }
  })

  it('邮箱格式非法 → 400', async () => {
    const handler = await loadHandler()
    const event = fakeEvent({ nickname: 'n', email: 'not-an-email', content: 'c' })
    const res = (await handler(event)) as { error?: string }
    expect(event.__status).toBe(400)
    expect(res.error).toMatch(/email/i)
  })

  it('字段超长 → 400', async () => {
    const handler = await loadHandler()
    const event = fakeEvent({ nickname: 'x'.repeat(41), email: 'a@b.com', content: 'c' })
    const res = (await handler(event)) as { error?: string }
    expect(event.__status).toBe(400)
    expect(res.error).toMatch(/length/i)
  })
})

describe('POST /api/guestbook — 正常发布', () => {
  it('合法内容 → 200 入库并返回 id', async () => {
    const handler = await loadHandler()
    const event = fakeEvent({ nickname: 'n', email: 'a@b.com', content: 'hello' })
    const res = (await handler(event)) as { id: number; ok: boolean }
    expect(event.__status).toBe(200)
    expect(res).toMatchObject({ id: 1, ok: true })
    expect(createGuestbookMock).toHaveBeenCalledTimes(1)
    // 服务端采集 UA / browser / os，绝不采信前端自报
    expect(parseUserAgentMock).toHaveBeenCalled()
    expect(createGuestbookMock.mock.calls[0][1]).toMatchObject({ browser: 'Chrome', os: 'macOS' })
  })
})

describe('POST /api/guestbook — 限流', () => {
  it('触发限流 → 429 + Retry-After，且不入库', async () => {
    rateLimitMock.mockImplementation(() => ({ allowed: false, retryAfter: 42 }))
    const handler = await loadHandler()
    const event = fakeEvent({ nickname: 'n', email: 'a@b.com', content: 'hello' })
    const res = (await handler(event)) as { retryAfter?: number }
    expect(event.__status).toBe(429)
    expect(event.__headers['retry-after']).toBe('42')
    expect(res.retryAfter).toBe(42)
    expect(createGuestbookMock).not.toHaveBeenCalled()
  })
})
