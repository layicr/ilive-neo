/**
 * 单元测试：客户端 IP 解析的信任策略 · Client-IP trust policy
 *
 * @description 安全回归：历史实现无条件采信 `X-Forwarded-For` 最左值，直连部署下可被任意伪造 IP，
 *              从而无限刷赞 / 污染热门排序。修复后仅当 `NUXT_TRUST_PROXY === 'true'`
 *              （显式声明位于可信反代 / CDN 之后）才采信 XFF，否则使用不可伪造的 socket 地址。
 *              本文件同时覆盖 `resolveClientIp` 的归一化边界。
 *
 *              Security regression: XFF must only be trusted when NUXT_TRUST_PROXY=true; otherwise
 *              the (non-forgeable) socket address is used. Also covers resolveClientIp normalization.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('h3', () => ({
  getRequestIP: vi.fn(() => '203.0.113.9')
}))

import { getRequestIP } from 'h3'
import { resolveClientIp, getClientIp } from '../../server/lib/concertLikes'

const ORIGINAL_TRUST_PROXY = process.env.NUXT_TRUST_PROXY

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.NUXT_TRUST_PROXY
})

afterEach(() => {
  if (ORIGINAL_TRUST_PROXY === undefined) delete process.env.NUXT_TRUST_PROXY
  else process.env.NUXT_TRUST_PROXY = ORIGINAL_TRUST_PROXY
})

describe('resolveClientIp — 归一化边界', () => {
  it('null / undefined / 空串 / 纯空白 → unknown（点赞仍可用）', () => {
    expect(resolveClientIp(null)).toBe('unknown')
    expect(resolveClientIp(undefined)).toBe('unknown')
    expect(resolveClientIp('')).toBe('unknown')
    expect(resolveClientIp(' \t ')).toBe('unknown')
  })

  it('IPv4 / IPv6 两端空白被 trim', () => {
    expect(resolveClientIp(' 203.0.113.7 ')).toBe('203.0.113.7')
    expect(resolveClientIp('\t2001:db8::1\n')).toBe('2001:db8::1')
  })

  it('恰好 64 字符不截断，超过则截断到 64', () => {
    const exact = 'b'.repeat(64)
    expect(resolveClientIp(exact)).toBe(exact)
    expect(resolveClientIp('a'.repeat(200))).toHaveLength(64)
  })
})

describe('getClientIp — 仅在显式声明可信反代时采信 X-Forwarded-For', () => {
  it('默认（未设置 NUXT_TRUST_PROXY）→ getRequestIP 传 xForwardedFor=false', () => {
    expect(getClientIp({} as never)).toBe('203.0.113.9')
    expect(vi.mocked(getRequestIP)).toHaveBeenCalledWith(expect.anything(), { xForwardedFor: false })
  })

  it('NUXT_TRUST_PROXY=true → 传 xForwardedFor=true', () => {
    process.env.NUXT_TRUST_PROXY = 'true'
    expect(getClientIp({} as never)).toBe('203.0.113.9')
    expect(vi.mocked(getRequestIP)).toHaveBeenCalledWith(expect.anything(), { xForwardedFor: true })
  })

  it('非 "true" 取值（1 / TRUE / false）均不开启信任，避免误配放行伪造 IP', () => {
    for (const value of ['1', 'TRUE', 'yes', 'false', '']) {
      process.env.NUXT_TRUST_PROXY = value
      vi.mocked(getRequestIP).mockClear()
      getClientIp({} as never)
      expect(vi.mocked(getRequestIP)).toHaveBeenCalledWith(expect.anything(), { xForwardedFor: false })
    }
  })

  it('取不到 IP 时兜底 unknown，不抛错', () => {
    vi.mocked(getRequestIP).mockReturnValueOnce(null as unknown as string)
    expect(getClientIp({} as never)).toBe('unknown')
  })
})
