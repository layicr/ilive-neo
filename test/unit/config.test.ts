/**
 * 全局配置常量单元测试 · Unit tests for global config constants
 * @description 断言 CONFIG 中与环境无关的取值（防抖延迟、Toast 时长等）符合预期。
 *              Asserts the environment-independent CONFIG values (debounce delay, toast duration, …).
 */
import { describe, it, expect } from 'vitest'
import { CONFIG } from '../../app/utils/config'

describe('CONFIG — 配置项', () => {
  it('PERFORMANCE_MONITOR 仅在非生产环境开启', () => {
    // vitest 默认 NODE_ENV=test，故此处应 true；生产构建（NODE_ENV=production）时为 false
    // vitest defaults NODE_ENV=test, so this is true here; false in a production build (NODE_ENV=production)
    expect(CONFIG.PERFORMANCE_MONITOR).toBe(process.env.NODE_ENV !== 'production')
  })

  it('DEBOUNCE_RESIZE_DELAY 为 250', () => {
    expect(CONFIG.DEBOUNCE_RESIZE_DELAY).toBe(250)
  })

  it('TOAST_DURATION 有效（供 UI-030 配合）', () => {
    expect(CONFIG.TOAST_DURATION).toBeGreaterThan(0)
  })

  it('专辑轮播配置完整', () => {
    expect(CONFIG.ALBUM_CAROUSEL.DESKTOP_RADIUS).toBeGreaterThan(0)
    expect(CONFIG.ALBUM_CAROUSEL.MOBILE_RADIUS).toBeGreaterThan(0)
    expect(CONFIG.ALBUM_CAROUSEL.MIN_SCALE).toBeGreaterThan(0)
  })
})