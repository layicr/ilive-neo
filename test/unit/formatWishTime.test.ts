/**
 * formatWishTime 单元测试 · Unit tests for formatWishTime
 * @description 验证相对时间格式化（刚刚 / 分钟前 / 小时前 / 天前）与超过一周后的语言相关绝对日期回退。
 *              Verifies relative-time formatting (just now / min / hours / days) and the locale-aware
 *              absolute-date fallback beyond one week.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatWishTime } from '../../app/utils/index'

describe('formatWishTime — 许愿时间格式化', () => {
  const NOW = new Date('2026-08-22T12:00:00Z').getTime()

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function at(now: string) {
    vi.setSystemTime(new Date(now))
  }

  it('一分钟内显示"刚刚"', () => {
    at('2026-08-22T12:00:00Z')
    expect(formatWishTime(new Date(NOW - 30 * 1000).toISOString(), 'zh-CN')).toBe('刚刚')
    expect(formatWishTime(new Date(NOW - 30 * 1000).toISOString(), 'en')).toBe('Just now')
  })

  it('一小时内显示"N 分钟前"', () => {
    at('2026-08-22T12:00:00Z')
    expect(formatWishTime(new Date(NOW - 5 * 60 * 1000).toISOString(), 'zh-CN')).toBe('5分钟前')
    expect(formatWishTime(new Date(NOW - 5 * 60 * 1000).toISOString(), 'en')).toBe('5 min ago')
  })

  it('一天内显示"N 小时前"', () => {
    at('2026-08-22T12:00:00Z')
    expect(formatWishTime(new Date(NOW - 3 * 60 * 60 * 1000).toISOString(), 'zh-CN')).toBe('3小时前')
    expect(formatWishTime(new Date(NOW - 3 * 60 * 60 * 1000).toISOString(), 'en')).toBe('3 hours ago')
  })

  it('一周内显示"N 天前"', () => {
    at('2026-08-22T12:00:00Z')
    expect(formatWishTime(new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString(), 'zh-CN')).toBe('2天前')
    expect(formatWishTime(new Date(NOW - 2 * 24 * 60 * 60 * 1000).toISOString(), 'en')).toBe('2 days ago')
  })

  it('超过一周返回本地日期字符串', () => {
    at('2026-08-22T12:00:00Z')
    const out = formatWishTime(new Date(NOW - 30 * 24 * 60 * 60 * 1000).toISOString(), 'zh-CN')
    expect(typeof out).toBe('string')
    expect(out).not.toMatch(/分钟前|小时前|天前|刚刚/)
  })
})