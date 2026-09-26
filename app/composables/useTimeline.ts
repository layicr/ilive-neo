/**
 * 时间轴 composable · Timeline
 *
 * @description 从原版时间轴渲染逻辑迁移而来。
 *              纯逻辑：提供按 id 降序（最新在前）的演唱会列表，与滚动渐显的 IntersectionObserver。
 *              渲染交给模板（声明式 v-for），不再手写 DOM。
 *              visibleIds 用响应式对象 {id: boolean} 记录已显示条目 id，DOM 重建时类名仍能保持。
 *
 *              生命周期：IntersectionObserver 会**强引用**被 observe 的节点，因此必须显式释放 ——
 *              页面卸载时（语言切换会整体重建页面组件）disconnect 并置空，避免旧时间轴的
 *              DOM / 图片节点无法回收；每次重新 init 也先 disconnect，避免沿用已废弃的节点。
 *              Lifecycle: an IntersectionObserver holds strong refs to observed nodes, so it must be
 *              released explicitly — disconnect + null on unmount, and disconnect before each re-init.
 */
import { CONFIG } from '~/utils/config'
import { useData } from './useData'
import { useSharedState } from './useSharedState'

/** 模块级唯一 observer，避免重复 init 叠加多个监听 · single module-level observer */
let revealObserver: IntersectionObserver | null = null

/**
 * 释放 observer 单例 · Release the observer singleton
 * @description IntersectionObserver 对被观察目标是**强引用**，只置 variables 不 disconnect 的话，
 *              这些 DOM 节点（及其图片、闭包）不会被 GC。故卸载 / 重建时必须调用。
 */
function releaseRevealObserver(): void {
  if (!revealObserver) return
  revealObserver.disconnect()
  revealObserver = null
}

/**
 * useTimeline 组合式入口 · Composable entry
 */
export function useTimeline() {
  const { localizedConcerts } = useData()

  // 宿主卸载时释放（语言切换会重建整个页面组件）· release when the owner unmounts
  onScopeDispose(releaseRevealObserver)

  /**
   * 已显示条目 id 映射（响应式，供模板绑定 .visible） · visible item ids
   * @description 用 useSharedState 而非模块级 ref：模块级 ref 在 SSR 下会跨请求存活，
   *              改用按请求隔离的共享状态。
   */
  const visibleIds = useSharedState<Record<number, boolean>>('timeline:visibleIds', () => ({}))

  // 与原版一致：按 id 降序排序（最新的在前）· same as original: sort by id desc (newest first)
  const sortedConcerts = computed(() =>
    [...localizedConcerts.value].sort((a, b) => b.id - a.id)
  )

  /**
   * 时间轴条目滚动进入视口时渐显 · Reveal timeline items on scroll
   * @description 监听 `.timeline-item`，进入视口时把对应 concert id 写入 visibleIds，
   *              模板通过 :class 绑定，避免 DOM 重建后类名丢失。
   *              放在闭包内，便于在 nextTick / watch 回调中安全调用。
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

    // 每次重新初始化前先断开：DOM 可能已被整体替换（语言切换 / 数据刷新），
    // 沿用旧的目标集合会让 observer 继续持有已废弃节点的强引用。
    // 断开无损 —— 紧接着就会基于「当前 DOM」重新 observe 所有尚未显示的条目。
    // Disconnect first: the DOM may have been replaced wholesale (locale switch / data refresh); keeping the
    // old target set would retain detached nodes. Losing nothing — every still-hidden item is re-observed below.
    revealObserver?.disconnect()

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
          visibleIds.value = next
        }
      }, { threshold: CONFIG.INTERSECTION_THRESHOLD })
    }

    // 仅观察尚未显示的条目，避免重复 observe 造成监听堆积
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
      }
    })
    if (changed) {
      visibleIds.value = next
    }
  }

  return {
    sortedConcerts,
    visibleIds,
    initTimelineReveal
  }
}
