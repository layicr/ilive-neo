/**
 * 单元测试：server/lib/rateLimit.ts — 固定窗口内存限流器
 *
 * @description 覆盖：放行/计数、达上限拦截、retryAfter 计算、窗口过期恢复、
 *              部分过期（滑动窗口语义）、键隔离、自定义 windowMs/max、空桶清理。
 *              每个用例使用唯一 key，避免模块级 buckets 跨用例串扰。
 *
 *              Covers allow/deny, retryAfter, window expiry (full & partial), key isolation,
 *              custom window/max. Each case uses a unique key to avoid cross-test pollution.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rateLimit } from '../../server/lib/rateLimit'

const T0 = new Date('2026-09-13T00:00:00Z')

let seq = 0
/** 每个用例独立的限流键 · per-case unique key */
const key = () => `rl-test-${Date.now()}-${seq++}`

describe('rateLimit — 默认窗口（60s / 10 次）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('首次请求放行，remaining = max - 1', () => {
    const r = rateLimit(key())
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(9)
    expect(r.retryAfter).toBe(0)
  })

  it('连续 10 次全部放行，最后一次 remaining 归零', () => {
    const k = key()
    const results = Array.from({ length: 10 }, () => rateLimit(k))
    expect(results.every((r) => r.allowed)).toBe(true)
    expect(results.map((r) => r.remaining)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0])
  })

  it('第 11 次被拦截：allowed=false / remaining=0 / retryAfter 在 1~60 秒', () => {
    const k = key()
    for (let i = 0; i < 10; i++) rateLimit(k)
    const blocked = rateLimit(k)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfter).toBeGreaterThanOrEqual(1)
    expect(blocked.retryAfter).toBeLessThanOrEqual(60)
  })

  it('同窗口内刚达上限时 retryAfter = 整数秒（不出现 0 或小数）', () => {
    const k = key()
    for (let i = 0; i < 10; i++) rateLimit(k)
    const blocked = rateLimit(k)
    expect(Number.isInteger(blocked.retryAfter)).toBe(true)
    expect(blocked.retryAfter).toBe(60)
  })

  it('窗口整体过期后恢复放行', () => {
    const k = key()
    for (let i = 0; i < 10; i++) rateLimit(k)
    expect(rateLimit(k).allowed).toBe(false)

    vi.advanceTimersByTime(60_000)
    const after = rateLimit(k)
    expect(after.allowed).toBe(true)
    expect(after.remaining).toBe(9)
  })

  it('部分过期：仅窗口外的旧记录被清理（滑动语义）', () => {
    const k = key()
    expect(rateLimit(k, { windowMs: 10_000, max: 2 }).allowed).toBe(true) // t0
    vi.advanceTimersByTime(5_000)
    expect(rateLimit(k, { windowMs: 10_000, max: 2 }).allowed).toBe(true) // t5
    expect(rateLimit(k, { windowMs: 10_000, max: 2 }).allowed).toBe(false) // t5 第三次 → 拦截

    vi.advanceTimersByTime(5_001) // t=10.001s，t0 的记录已过期，t5 的仍在窗口内
    const after = rateLimit(k, { windowMs: 10_000, max: 2 })
    expect(after.allowed).toBe(true)
    expect(after.remaining).toBe(0)
  })
})

describe('rateLimit — 键隔离与参数', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('不同 key 的计数互不影响', () => {
    const a = key()
    const b = key()
    for (let i = 0; i < 10; i++) rateLimit(a)
    expect(rateLimit(a).allowed).toBe(false)
    expect(rateLimit(b).allowed).toBe(true)
    expect(rateLimit(b).remaining).toBe(8)
  })

  it('自定义 max：max=2 时第 3 次拦截', () => {
    const k = key()
    expect(rateLimit(k, { max: 2 }).allowed).toBe(true)
    expect(rateLimit(k, { max: 2 }).allowed).toBe(true)
    const third = rateLimit(k, { max: 2 })
    expect(third.allowed).toBe(false)
    expect(third.remaining).toBe(0)
  })

  it('自定义 windowMs：窗口越小恢复越快', () => {
    const k = key()
    rateLimit(k, { windowMs: 1_000, max: 1 })
    expect(rateLimit(k, { windowMs: 1_000, max: 1 }).allowed).toBe(false)
    vi.advanceTimersByTime(1_000)
    expect(rateLimit(k, { windowMs: 1_000, max: 1 }).allowed).toBe(true)
  })

  it('返回结构完整（allowed / remaining / retryAfter 均为预期类型）', () => {
    const r = rateLimit(key())
    expect(typeof r.allowed).toBe('boolean')
    expect(typeof r.remaining).toBe('number')
    expect(typeof r.retryAfter).toBe('number')
  })
})
