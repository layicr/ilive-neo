// @vitest-environment happy-dom
/**
 * 数字滚动组合式测试 · useCountUp
 *
 * @description 重点守护两类行为：
 *   · **SSR / 水合安全** —— 未播放时必须「惰性透传」目标值（用 computed 而非 setup 期快照，
 *     否则 SSR 输出 0 且客户端水合不一致）；目标值变化实时反映。
 *   · **客户端播放** —— 从 0 按 easeOutCubic 递增、末帧精确落在目标值、周期重播、
 *     prefers-reduced-motion 直接显示终值、卸载清理定时器与 rAF。
 *
 *          时间轴由受控时钟（`performance.now` 桩）+ 受控 rAF 队列驱动，断言完全确定性。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, ref, type ComputedRef } from 'vue'
import { mount } from '@vue/test-utils'
import { useCountUp } from '../../app/composables/useCountUp'

/** 受控 rAF 队列 · controlled rAF queue */
let frames: FrameRequestCallback[] = []
/** 受控时钟（毫秒）· controlled clock (ms) */
let now = 0

/** 取出队列中全部回调并以当前受控时间执行 · run every queued callback at the current clock */
function flushFrame(): void {
  const pending = frames
  frames = []
  for (const cb of pending) cb(now)
}

/** 挂载承载 useCountUp 的宿主组件 · mount a host component that hosts useCountUp */
function mountCountUp(getTarget: () => number, durationMs = 5000, repeatMs = 0) {
  let display!: ComputedRef<number>
  const Host = defineComponent({
    setup() {
      display = useCountUp(getTarget, durationMs, repeatMs)
      return () => h('span', String(display.value))
    }
  })
  const wrapper = mount(Host)
  return {
    wrapper,
    /** 当前展示值 · current display value */
    get value(): number {
      return display.value
    }
  }
}

/** 指定 prefers-reduced-motion 命中与否 · control the reduced-motion media query */
function setReducedMotion(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: () => ({ matches, media: '', addEventListener() {}, removeEventListener() {} })
  })
}

beforeEach(() => {
  frames = []
  now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb)
    return frames.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  delete (window as unknown as Record<string, unknown>).matchMedia
})

describe('useCountUp · SSR / 水合安全（未播放时惰性透传）', () => {
  it('未播放时直接显示真实目标值（SSR HTML 与水合首帧一致）', () => {
    const ctx = mountCountUp(() => 42)
    expect(ctx.value).toBe(42)
  })

  it('目标值异步补齐后实时反映（不取 setup 期快照）', () => {
    const target = ref(0)
    const ctx = mountCountUp(() => target.value)
    expect(ctx.value).toBe(0)
    target.value = 12
    expect(ctx.value).toBe(12)
  })
})

describe('useCountUp · 客户端播放', () => {
  it('从 0 按 easeOutCubic 递增，末帧精确落在目标值', () => {
    const ctx = mountCountUp(() => 50, 5000)
    expect(ctx.value).toBe(50)

    flushFrame() // 触发首播：归零
    expect(ctx.value).toBe(0)

    now = 2500 // 进度 0.5 → easeOutCubic = 0.875 → round(43.75) = 44
    flushFrame()
    expect(ctx.value).toBe(44)

    now = 5000 // 进度 1 → 精确等于目标值（非近似）
    flushFrame()
    expect(ctx.value).toBe(50)
  })

  it('目标值为 0 时不播放动画', () => {
    const ctx = mountCountUp(() => 0, 5000)
    flushFrame()
    expect(ctx.value).toBe(0)
  })

  it('prefers-reduced-motion 命中时直接显示终值', () => {
    setReducedMotion(true)
    const ctx = mountCountUp(() => 30, 5000)
    flushFrame()
    expect(ctx.value).toBe(30)
  })

  it('按 repeatMs 周期从 0 重播', async () => {
    const ctx = mountCountUp(() => 20, 5000, 30)

    flushFrame()
    now = 5000
    flushFrame()
    expect(ctx.value).toBe(20)

    // 等待一个周期后，重播应从 0 重新起步 · after one period, replay restarts from 0
    await new Promise((resolve) => setTimeout(resolve, 60))
    flushFrame()
    expect(ctx.value).toBe(0)

    now = 10_000
    flushFrame()
    expect(ctx.value).toBe(20)
  })

  it('不传 repeatMs 时不注册周期定时器', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    mountCountUp(() => 10, 5000)
    expect(setIntervalSpy).not.toHaveBeenCalled()
  })

  it('卸载时清理周期定时器', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const ctx = mountCountUp(() => 10, 5000, 1000)
    ctx.wrapper.unmount()
    expect(clearIntervalSpy).toHaveBeenCalled()
  })
})
