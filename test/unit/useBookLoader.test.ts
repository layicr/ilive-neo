/**
 * 书册加载页时序 / 预取单测 · Book loader timing & prefetch
 *
 * @description 用假定时器确定性验证：
 *   · 翻页间隔从慢到快（二次递减），19 场全部翻完且总时长 < 15s
 *   · 数据就绪后过最短窗口立即淡出、淡出后不再有回调改写状态
 *   · 数据始终不就绪 / 失败时的超时与错误兜底、卸载清理
 *   · 海报预取去重、翻页逐张预热、淡出期间补齐剩余全部
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  BOOK_COVER_MS,
  BOOK_WINDOW_MS,
  BOOK_MAX_MS,
  BOOK_MIN_SHOW_MS,
  BOOK_FADE_MS,
  G_MAX,
  G_MIN,
  gapAt,
  flipMsOf,
  speedOf,
  buildBookTimeline,
  useBookLoader,
  createPosterPrefetcher,
  type BookStep
} from '../../app/composables/useBookLoader'

/** 构造带事件记录的调度器 · build a scheduler that records every callback */
function harness(total = 19) {
  const events: string[] = []
  const flips: BookStep[] = []
  const loader = useBookLoader({
    total,
    onOpen: () => events.push('open'),
    onFlip: (step) => { events.push('flip'); flips.push(step) },
    onPage: (step) => events.push(`page:${step.page}`),
    onFlipEnd: (step) => events.push(`end:${step.page}`),
    onFinish: (reason) => events.push(`finish:${reason}`)
  })
  return { loader, events, flips }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('书册节奏（从慢到快）', () => {
  it('间隔二次递减：首页最慢 1.32s，末页最快 0.32s', () => {
    const flips = 18
    expect(gapAt(1, flips)).toBeCloseTo(G_MAX, 6)
    expect(gapAt(flips, flips)).toBeCloseTo(G_MIN, 6)
    const gaps = Array.from({ length: flips }, (_, i) => gapAt(i + 1, flips))
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i]!).toBeLessThanOrEqual(gaps[i - 1]!)
    }
    // 前半段减速更明显（二次曲线），末尾趋于平稳
    expect(gaps[0]! - gaps[1]!).toBeGreaterThan(gaps[16]! - gaps[17]!)
  })

  it('单页 / 零页不会产生翻页，也不会除零', () => {
    expect(gapAt(1, 1)).toBe(G_MIN)
    expect(buildBookTimeline(1)).toEqual([])
    expect(buildBookTimeline(0)).toEqual([])
  })

  it('翻页动画与淡入速度随节奏同步加快，且不越界', () => {
    expect(flipMsOf(G_MAX)).toBeGreaterThan(flipMsOf(G_MIN))
    expect(speedOf(G_MAX)).toBe(1)
    expect(speedOf(G_MIN)).toBe(0.35)
    for (const gap of [0.1, 0.32, 0.8, 1.32, 3]) {
      expect(flipMsOf(gap)).toBeGreaterThanOrEqual(160)
      expect(flipMsOf(gap)).toBeLessThanOrEqual(500)
      expect(speedOf(gap)).toBeGreaterThanOrEqual(0.35)
      expect(speedOf(gap)).toBeLessThanOrEqual(1)
    }
  })

  it('19 场全部翻完（18 次），且封面 + 翻阅 + 淡出仍 < 15s', () => {
    const steps = buildBookTimeline(19, BOOK_WINDOW_MS)
    expect(steps).toHaveLength(18)
    expect(steps[0]!.page).toBe(1)
    expect(steps[17]!.page).toBe(18)
    expect(steps[17]!.at).toBeLessThan(BOOK_WINDOW_MS)
    expect(steps.every((s, i) => i === 0 || s.gap <= steps[i - 1]!.gap)).toBe(true)
    // 最后一次翻页动画也能在窗口内结束
    expect(steps[17]!.at + steps[17]!.flipMs).toBeLessThan(BOOK_WINDOW_MS)
    expect(BOOK_MAX_MS + BOOK_FADE_MS).toBeLessThan(15_000)
    expect(BOOK_COVER_MS + BOOK_WINDOW_MS).toBe(BOOK_MAX_MS)
  })

  it('场次较少时（e2e 的 4 场）时间表同样合法', () => {
    const steps = buildBookTimeline(4)
    expect(steps).toHaveLength(3)
    expect(steps[2]!.at).toBeLessThan(BOOK_WINDOW_MS)
  })
})

describe('调度生命周期（就绪即淡出 / 超时 / 失败 / 清理）', () => {
  it('封面在 900ms 翻开，翻页按时间表依次触发 onFlip → onPage → onFlipEnd', () => {
    const { loader, events } = harness()
    loader.start()
    expect(events).toEqual([])

    vi.advanceTimersByTime(BOOK_COVER_MS)
    expect(events).toEqual(['open'])

    const first = buildBookTimeline(19)[0]!
    vi.advanceTimersByTime(first.at)
    expect(events).toContain('flip')
    vi.advanceTimersByTime(first.flipMs / 2)
    expect(events).toContain('page:1')
    vi.advanceTimersByTime(first.flipMs / 2 + 30)
    expect(events).toContain('end:1')
    loader.stop()
  })

  it('数据就绪后过最短窗口立即淡出，且淡出后定时器全部清理', () => {
    const { loader, events } = harness()
    loader.start()
    loader.setReady()

    vi.advanceTimersByTime(BOOK_MIN_SHOW_MS - 1)
    expect(events).not.toContain('finish:ready')

    vi.advanceTimersByTime(1)
    expect(events).toContain('finish:ready')

    const count = events.length
    vi.advanceTimersByTime(20_000)
    expect(events).toHaveLength(count)
    expect(events.filter((e) => e.startsWith('finish:'))).toEqual(['finish:ready'])
  })

  it('数据晚于最短窗口就绪时，就绪当刻立即淡出', () => {
    const { loader, events } = harness()
    loader.start()
    vi.advanceTimersByTime(BOOK_MIN_SHOW_MS + 1_000)
    expect(events.some((e) => e.startsWith('finish:'))).toBe(false)
    loader.setReady()
    expect(events.at(-1)).toBe('finish:ready')
  })

  it('数据始终不就绪时，13.5s 硬上限自动淡出', () => {
    const { loader, events } = harness()
    loader.start()
    vi.advanceTimersByTime(BOOK_MAX_MS - 1)
    expect(events.some((e) => e.startsWith('finish:'))).toBe(false)
    vi.advanceTimersByTime(1)
    expect(events.at(-1)).toBe('finish:timeout')
  })

  it('数据失败时不等最短窗口，立即淡出以露出错误提示', () => {
    const { loader, events } = harness()
    loader.start()
    loader.setFailed()
    expect(events).toEqual(['finish:error'])
    vi.advanceTimersByTime(20_000)
    expect(events).toEqual(['finish:error'])
  })

  it('stop 后不再触发任何回调（卸载安全）', () => {
    const { loader, events } = harness()
    loader.start()
    loader.stop()
    vi.advanceTimersByTime(20_000)
    expect(events).toEqual([])
  })

  it('重复 start / 重复 setReady 不会重复结束', () => {
    const { loader, events } = harness()
    loader.start()
    loader.start()
    loader.setReady()
    loader.setReady()
    vi.advanceTimersByTime(20_000)
    expect(events.filter((e) => e.startsWith('finish:'))).toHaveLength(1)
  })
})

describe('海报预取（去重 + 补齐全部 19 张）', () => {
  const urls = Array.from({ length: 19 }, (_, i) => `/concert/poster/${i}_thumb.jpg`)

  it('翻页逐张预热当前页与下一页，重复 URL 只请求一次', () => {
    const loaded: string[] = []
    const prefetcher = createPosterPrefetcher({ load: (url) => loaded.push(url), idle: (fn) => fn() })
    prefetcher.warm(urls[0]!)
    prefetcher.warm(urls[0]!)
    prefetcher.warmAround(urls, 0)
    prefetcher.warm('')
    expect(loaded).toEqual([urls[0], urls[1]])
    expect(prefetcher.warmed).toBe(2)
  })

  it('淡出期间按空闲批次补齐剩余全部 19 张，且不重复', () => {
    const loaded: string[] = []
    let idleCalls = 0
    const prefetcher = createPosterPrefetcher({
      load: (url) => loaded.push(url),
      idle: (fn) => { idleCalls += 1; fn() },
      batchSize: 3
    })
    prefetcher.warmAround(urls, 5)
    prefetcher.fill(urls)
    expect(prefetcher.warmed).toBe(19)
    expect(new Set(loaded).size).toBe(19)
    expect(idleCalls).toBeGreaterThan(1) // 分批低优先级，不一次性抢占带宽
  })

  it('全部已预热时 fill 不再调度空闲回调', () => {
    let idleCalls = 0
    const prefetcher = createPosterPrefetcher({
      load: () => {},
      idle: (fn) => { idleCalls += 1; fn() }
    })
    prefetcher.fill(urls)
    expect(idleCalls).toBeGreaterThan(0)
    const before = idleCalls
    prefetcher.fill(urls)
    expect(idleCalls).toBe(before)
  })
})
