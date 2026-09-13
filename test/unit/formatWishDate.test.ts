/**
 * formatWishDate 单元测试 · Unit tests for formatWishDate
 * @description 验证水合安全的固定绝对日期输出（YYYY.MM.DD、补零、不可解析回退空串）。
 *              Verifies the hydration-safe absolute date output (YYYY.MM.DD, zero-padding, '' on bad input).
 */
import { describe, it, expect } from 'vitest'
import { formatWishDate } from '../../app/utils/index'

describe('formatWishDate — 固定的绝对日期（水合安全）', () => {
  it('输出 YYYY.MM.DD', () => {
    expect(formatWishDate('2026-08-31T12:34:56Z')).toBe('2026.08.31')
  })

  it('个位数月/日补零', () => {
    expect(formatWishDate('2026-01-05T00:00:00Z')).toBe('2026.01.05')
  })

  it('无法解析时返回空串', () => {
    expect(formatWishDate('not-a-date')).toBe('')
  })

  it('不含空格/UTC 偏移，SSR 与客户端输出一致', () => {
    // 关键：不依赖 Date.now() 与 toLocaleDateString，避免 hydration 不一致
    const a = formatWishDate('2026-08-31T15:00:00+08:00')
    const b = formatWishDate('2026-08-31T15:00:00+08:00')
    expect(a).toBe(b)
    expect(a).not.toContain(' ')
  })
})
