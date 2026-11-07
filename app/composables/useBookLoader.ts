/**
 * 书册加载页时序与海报预取 · Book-style loader timing & poster prefetch
 *
 * @module useBookLoader
 * @description 把「加速翻页时间表 / 生命周期调度 / 图片预取」从 Vue 组件中抽成纯 TS 模块，
 *              便于用假定时器单测，组件只负责把回调结果映射成响应式状态。
 *
 *  时序（从 start 起算，单位 ms）：
 *    0                        封面停留
 *    BOOK_COVER_MS(900)       封面翻开 → onOpen，进入翻阅窗口
 *    ...                      按二次递减间隔逐页 onFlip → onPage → onFlipEnd
 *    BOOK_MIN_SHOW_MS(11000)  最短展示窗口结束（>10s）；若数据已就绪 → onFinish('ready')
 *    BOOK_MAX_MS(13500)       硬上限；数据仍未就绪 → onFinish('timeout')
 *    + BOOK_FADE_MS(900)      淡出结束，遮罩移除 → 14.4s < 15s
 *
 *  设计取舍：SSR 预取使数据在客户端水合时几乎总是已就绪，若「数据就绪」立刻淡出，
 *  每次刷新将完全看不到动画。故保留 11s 最短展示窗口（>10s，可看完整本的大部分翻页），
 *  就绪后不等待整本翻完；数据失败仍立即淡出以露出错误提示。
 *
 *              Timing/posters are pure TS so the pacing, early-exit and cleanup are unit-testable;
 *              the component only maps callbacks onto reactive state.
 */

/** 封面停留（ms） · cover hold */
export const BOOK_COVER_MS = 900
/** 翻阅窗口（ms，相对封面翻开） · page-turning window (relative to cover open) */
export const BOOK_WINDOW_MS = 12_600
/** 淡出时长（ms） · fade-out duration */
export const BOOK_FADE_MS = 900
/** 硬上限（ms，触发淡出的最晚时刻；与淡出相加仍 < 15s） · hard deadline before fade-out */
export const BOOK_MAX_MS = 13_500
/** 最短展示（ms）：加载页至少停留 11 秒（>10s），且淡出后仍早于 15s CSS 兜底 · minimum visible duration */
export const BOOK_MIN_SHOW_MS = 11_000
/** 最慢 / 最快的每页停留（秒） · slowest / fastest page dwell (seconds) */
export const G_MAX = 1.32
export const G_MIN = 0.32

/**
 * 整页会话播放标记 · module-level "played once" flag
 * @description `<script setup>` 顶层变量属于组件实例，SPA 语言切换重建组件会把它重置；
 *              因此标记必须放在模块作用域。只在客户端 onMounted 写入，服务端始终为 false，
 *              既保证 SSR 每次都直出遮罩，也不会造成跨请求状态污染。
 */
export const bookLoaderSession = { played: false }

/** 结束原因 · why the loader stopped */
export type BookFinishReason = 'ready' | 'timeout' | 'error'

/** 单次翻页的时序描述 · one scheduled page turn */
export interface BookStep {
  /** 相对封面翻开的触发时刻（ms） · offset from cover open */
  at: number
  /** 翻到的目标页索引（0-based） · destination page index */
  page: number
  /** 本页停留间隔（秒，从慢到快） · dwell for this page (seconds) */
  gap: number
  /** 翻页动画时长（ms） · flip animation duration */
  flipMs: number
  /** 内容淡入速度系数（1 最慢，.35 最快） · content fade speed factor */
  speed: number
}

/**
 * 第 k 次翻页的停留间隔（二次递减：1.32s → 0.32s）· quadratic slow→fast dwell
 * @param k 第几次翻页（1-based） · 1-based turn index
 * @param flips 总翻页次数 · total turns
 */
export function gapAt(k: number, flips: number): number {
  if (flips <= 1) return G_MIN
  const t = Math.max(0, Math.min(1, (flips - k) / (flips - 1)))
  return G_MIN + (G_MAX - G_MIN) * t * t
}

/** 翻页动画时长：随节奏加快，但始终短于该页停留 · flip duration scales with pace */
export function flipMsOf(gap: number): number {
  return Math.max(160, Math.min(500, Math.round(gap * 420)))
}

/** 内容淡入速度系数 · fade-in speed factor */
export function speedOf(gap: number): number {
  return Math.max(0.35, Math.min(1, gap / 1.0))
}

/**
 * 构建完整翻页时间表 · Build the full page-turn timeline
 * @param total 演唱会页数 · number of pages
 * @param windowMs 翻阅窗口上限 · turning window cap
 * @description 累加各页停留得到绝对触发时刻；超出窗口的翻页不再调度（默认 19 页时末次约 11.9s）。
 */
export function buildBookTimeline(total: number, windowMs: number = BOOK_WINDOW_MS): BookStep[] {
  const flips = Math.max(0, Math.floor(total) - 1)
  const steps: BookStep[] = []
  let acc = 0
  for (let k = 1; k <= flips; k++) {
    const gap = gapAt(k, flips)
    acc += gap * 1000
    if (acc > windowMs) break
    steps.push({
      at: Math.round(acc),
      page: k,
      gap,
      flipMs: flipMsOf(gap),
      speed: speedOf(gap)
    })
  }
  return steps
}

/** 调度回调 · scheduler callbacks */
export interface BookLoaderCallbacks {
  /** 封面翻开，绘制第 0 页 · cover opened */
  onOpen: (gap: number) => void
  /** 开始一次翻页动画 · a flip starts */
  onFlip: (step: BookStep) => void
  /** 动画半程，切换右页内容 / 目录高亮 / 进度条 · mid-flip content switch */
  onPage: (step: BookStep) => void
  /** 动画结束，移除翻页纸 · flip finished */
  onFlipEnd: (step: BookStep) => void
  /** 结束（组件据此淡出） · loader finished */
  onFinish: (reason: BookFinishReason) => void
}

/** 调度配置 · scheduler config */
export interface BookLoaderConfig extends BookLoaderCallbacks {
  total: number
  coverMs?: number
  windowMs?: number
  maxMs?: number
  minShowMs?: number
}

/** 调度器实例 · scheduler handle */
export interface BookLoader {
  start: () => void
  /** 数据已就绪：过了最短窗口就立即淡出 · data ready → fade out once min window elapsed */
  setReady: () => void
  /** 数据失败：不等最短窗口，立即淡出以便露出错误提示 · fetch failed → immediate fade-out */
  setFailed: () => void
  /** 卸载清理（不触发 onFinish） · dispose without finishing */
  stop: () => void
}

/**
 * 创建书册加载页调度器 · Create the loader scheduler
 * @description 所有定时器集中登记，finish/stop 时一次性清理，避免淡出后仍有翻页回调改写状态。
 */
export function useBookLoader(config: BookLoaderConfig): BookLoader {
  const {
    total,
    coverMs = BOOK_COVER_MS,
    windowMs = BOOK_WINDOW_MS,
    maxMs = BOOK_MAX_MS,
    minShowMs = BOOK_MIN_SHOW_MS,
    onOpen, onFlip, onPage, onFlipEnd, onFinish
  } = config

  const timeline = buildBookTimeline(total, windowMs)
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let started = false
  let finished = false
  let stopped = false
  let ready = false
  let minElapsed = false

  /** 登记一个受管定时器 · register a managed timeout */
  function later(fn: () => void, ms: number): void {
    const id = setTimeout(() => {
      timers.delete(id)
      if (!finished && !stopped) fn()
    }, Math.max(0, ms))
    timers.add(id)
  }

  function clearAll(): void {
    // forEach 而非 for...of：避免低 target 下遍历 Set 需要 downlevelIteration
    timers.forEach((id) => clearTimeout(id))
    timers.clear()
  }

  /** 统一收口：只触发一次 onFinish · finish exactly once */
  function finish(reason: BookFinishReason): void {
    if (finished || stopped || !started) return
    finished = true
    clearAll()
    onFinish(reason)
  }

  function start(): void {
    if (started || stopped) return
    started = true

    // 最短展示窗口：数据再快也要看得见封面 + 首次翻页
    later(() => {
      minElapsed = true
      if (ready) finish('ready')
    }, minShowMs)

    // 绝对上限：数据始终不就绪时强制淡出（与淡出相加仍 < 15s）
    later(() => finish('timeout'), maxMs)

    later(() => {
      onOpen(G_MAX)
      for (const step of timeline) {
        later(() => onFlip(step), step.at)
        later(() => onPage(step), step.at + step.flipMs / 2)
        later(() => onFlipEnd(step), step.at + step.flipMs + 30)
      }
      // 整本翻完仍无就绪信号 → 视为超时
      later(() => finish('timeout'), windowMs)
    }, coverMs)
  }

  return {
    start,
    setReady() {
      ready = true
      if (minElapsed) finish('ready')
    },
    setFailed() {
      finish('error')
    },
    stop() {
      stopped = true
      clearAll()
    }
  }
}

// ==================== 海报预取 · Poster prefetch ====================

/** 预取依赖（便于单测注入） · injected dependencies for tests */
export interface PosterPrefetchOptions {
  /** 实际发起图片请求 · actually load an image */
  load?: (url: string) => void
  /** 低优先级调度（默认 requestIdleCallback，降级 setTimeout） · idle scheduler */
  idle?: (fn: () => void) => void
  /** 每个空闲窗口补齐的张数 · images per idle batch */
  batchSize?: number
}

/** 预取器句柄 · prefetcher handle */
export interface PosterPrefetcher {
  /** 预热单张（去重） · warm a single URL once */
  warm: (url: string) => void
  /** 翻页时预热当前页与下一页 · warm current + next page */
  warmAround: (urls: string[], index: number) => void
  /** 淡出期间低优先级补齐剩余全部 · fill the rest during idle time */
  fill: (urls: string[]) => void
  /** 已预热数量（单测用） · number of warmed URLs */
  readonly warmed: number
}

/** 默认预热：与原首页 <img> 同一 URL，命中 HTTP cache · default loader reuses the homepage URL */
function defaultLoad(url: string): void {
  if (typeof Image === 'undefined') return
  const img = new Image()
  img.src = url
}

/** 默认空闲调度 · default idle scheduler with fallback */
function defaultIdle(fn: () => void): void {
  const g = globalThis as unknown as { requestIdleCallback?: (cb: () => void) => number }
  if (typeof g.requestIdleCallback === 'function') g.requestIdleCallback(() => fn())
  else setTimeout(fn, 200)
}

/**
 * 创建海报预取器 · Create a deduplicating poster prefetcher
 * @description 翻页天然预热「已翻到的 + 下一张」；淡出后用空闲时间分批补齐剩余，
 *              总量约 965 KB / 19 张，不抢首页数据请求带宽，也不改变淡出时机。
 */
export function createPosterPrefetcher(options: PosterPrefetchOptions = {}): PosterPrefetcher {
  const seen = new Set<string>()
  const load = options.load ?? defaultLoad
  const idle = options.idle ?? defaultIdle
  const batchSize = Math.max(1, options.batchSize ?? 3)

  function warm(url: string): void {
    if (!url || seen.has(url)) return
    seen.add(url)
    load(url)
  }

  return {
    warm,
    warmAround(urls, index) {
      warm(urls[index] ?? '')
      warm(urls[index + 1] ?? '')
    },
    fill(urls) {
      const pending = urls.filter((url) => !!url && !seen.has(url))
      const step = () => {
        for (const url of pending.splice(0, batchSize)) warm(url)
        if (pending.length) idle(step)
      }
      if (pending.length) idle(step)
    },
    get warmed() {
      return seen.size
    }
  }
}
