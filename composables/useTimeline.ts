/**
 * 时间轴 composable · Timeline
 *
 * @description 从原版时间轴渲染逻辑迁移而来。
 *              纯逻辑：提供按 id 降序（最新在前）的演唱会列表，与滚动渐显的 IntersectionObserver。
 *              渲染交给模板（声明式 v-for），不再手写 DOM。
 *              visibleIds 用响应式 Set 保存已显示条目 id，DOM 重建时类名仍能保持。
 */
import { useData } from './useData'

/** 模块级唯一 observer，避免重复 init 叠加多个监听 · single module-level observer */
let revealObserver: IntersectionObserver | null = null

/** 已显示条目 id 映射（响应式，供模板绑定 .visible） · visible item ids */
const visibleIds = ref<Record<number, boolean>>({})

/**
 * 时间轴条目滚动进入视口时渐显 · Reveal timeline items on scroll
 * @description 监听 `.timeline-item`，进入视口时把对应 concert id 写入 visibleIds，
 *              模板通过 :class 绑定，避免 DOM 重建后类名丢失。
 */
function initTimelineReveal(): void {
  if (typeof document === 'undefined') return

  const items = document.querySelectorAll<HTMLElement>('.timeline-item')
  if (items.length === 0) return

  // 兼容无 IntersectionObserver 的环境：直接全部显示
  if (typeof IntersectionObserver === 'undefined') {
    const next: Record<number, boolean> = {}
    items.forEach(item => {
      const id = Number(item.getAttribute('data-concert-id'))
      if (id) next[id] = true
    })
    visibleIds.value = next
    return
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      const next = { ...visibleIds.value }
      let changed = false
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = Number(entry.target.getAttribute('data-concert-id'))
          if (id && !next[id]) {
            next[id] = true
            changed = true
          }
          revealObserver!.unobserve(entry.target)
        }
      })
      if (changed) {
        console.log('[timeline reveal] triggered ids:', Object.keys(next).filter(k => next[Number(k)]).join(','))
        visibleIds.value = next
      }
    }, { threshold: 0.1 })
  }

  // 仅观察尚未显示的条目，避免重复 observe 造成监听堆积
  let observed = 0
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  const next = { ...visibleIds.value }
  let changed = false
  items.forEach(item => {
    const id = Number(item.getAttribute('data-concert-id'))
    if (!id) return

    // 同步检查已在视口内的条目（防止 IntersectionObserver 初始回调延迟/丢失）
    if (!next[id]) {
      const rect = item.getBoundingClientRect()
      if (rect.top < viewportHeight && rect.bottom > 0) {
        next[id] = true
        changed = true
        return
      }
    }

    if (!next[id]) {
      revealObserver!.observe(item)
      observed++
    }
  })
  if (changed) {
    console.log('[timeline reveal] sync visible ids:', Object.keys(next).filter(k => next[Number(k)]).join(','))
    visibleIds.value = next
  }
  if (observed > 0) console.log('[timeline reveal] observing', observed, 'items')
}

/**
 * useTimeline 组合式入口 · Composable entry
 */
export function useTimeline() {
  const { localizedConcerts } = useData()

  // 与原版一致：按 id 降序排序（最新的在前）
  const sortedConcerts = computed(() =>
    [...localizedConcerts.value].sort((a, b) => b.id - a.id)
  )

  return {
    sortedConcerts,
    visibleIds,
    initTimelineReveal
  }
}
