/**
 * 数字滚动计数组合式 · Count-up animation composable
 *
 * @description 返回一个只读的响应式展示数值 `display`：
 *   - **未播放时（含 SSR）直接透传目标值**：用 computed 惰性求值而非 setup 期快照 ——
 *     SSR 阶段 `useAsyncData` 尚未 resolve，若在 setup 期取快照会得到 0，导致
 *     统计卡输出 0 且与同页其它 computed（渲染期求值，已有真实值）自相矛盾，
 *     并引发客户端水合文本不一致。惰性透传保证 SSR HTML 与无 JS / 爬虫可见真实终值。
 *   - 客户端挂载后于下一帧从 0 平滑缓动到目标值（easeOutCubic）；
 *   - 若目标值后续变化（CSR 重试 / 异步补齐）自动重播；
 *   - 可选 `repeatMs`：每隔该间隔从 0 重播一次（如 120000 = 120 秒）；
 *   - 尊重 `prefers-reduced-motion: reduce`，命中时直接显示终值、跳过动画。
 *
 * @param getTarget 读取目标值的函数（每次重播都重新读取，保证取到最新值）
 * @param durationMs 单次动画时长（毫秒），默认 1500
 * @param repeatMs 重复播放间隔（毫秒），>0 时启用；默认 0（不重复）
 */
import { ref, computed, watch, onMounted, onUnmounted, type ComputedRef } from 'vue'

export function useCountUp(getTarget: () => number, durationMs = 1500, repeatMs = 0): ComputedRef<number> {
  /** 动画进行中的数值（仅客户端播放期间生效）· animated value (client-only, during playback) */
  const animated = ref(0)
  /** 是否处于动画播放状态：未播放（含 SSR / 水合首帧）时透传目标值 · playback flag */
  const playing = ref(false)
  /** 未完成的 rAF 句柄（用于卸载时取消，防泄漏）· pending rAF handle */
  let raf = 0
  /** 周期重播定时器句柄 · repeat timer handle */
  let timer: ReturnType<typeof setInterval> | null = null
  /** 是否已挂载（未挂载前的 watch 触发不重播，避免与首帧重复）· mounted flag */
  let mounted = false

  /**
   * 展示值：播放中取动画值，否则实时透传目标值
   * Display: animated value while playing, otherwise a live pass-through of the target
   */
  const display = computed<number>(() => (playing.value ? animated.value : getTarget()))

  /**
   * 从 0 缓动到 target（easeOutCubic：1 - (1 - p)^3，末段自然减速）
   * @description 每帧仅更新一个整数 ref，Vue 对此文本节点做最小化更新，无额外重排。
   */
  function run(target: number): void {
    if (typeof window === 'undefined') {
      playing.value = false
      return
    }
    cancelAnimationFrame(raf)
    // 无障碍：减少动态效果，直接显示终值 · reduced-motion: show the final value
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || target <= 0) {
      playing.value = false
      return
    }
    playing.value = true
    animated.value = 0
    const start = performance.now()
    const tick = (now: number): void => {
      const p = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      animated.value = Math.round(eased * target)
      if (p < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        animated.value = target
      }
    }
    raf = requestAnimationFrame(tick)
  }

  onMounted(() => {
    mounted = true
    // 挂载后下一帧归零并播放，规避水合闪烁且触发首次计数动画
    // After mount, zero out on the next frame then play (avoid hydration flash + trigger the first animation)
    requestAnimationFrame(() => run(getTarget()))
    // 周期重播：每隔 repeatMs 从 0 再计数一次（repeatMs > 0 时启用）
    // Periodic replay: re-count from 0 every repeatMs (enabled when repeatMs > 0)
    if (repeatMs > 0) {
      timer = setInterval(() => run(getTarget()), repeatMs)
    }
  })

  // 目标值变化（挂载后）自动重播，保证最终态正确（如数据重试 / 异步补齐）
  // Auto-replay when the target changes after mount (e.g. retry / async fill)
  watch(getTarget, (val) => {
    if (mounted) run(val)
  })

  onUnmounted(() => {
    cancelAnimationFrame(raf)
    if (timer) clearInterval(timer)
  })

  return display
}
