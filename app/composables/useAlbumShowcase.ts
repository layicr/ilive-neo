/**
 * 3D 专辑展示 composable · 3D album showcase
 *
 * @description 从 main.js 的 init3DAlbumShowcase 迁移而来。
 *              3D 专辑轮播：卡片由模板 v-for 渲染（声明式），本 composable 负责 3D 布局（transform）、
 *              自动轮播、触摸/滚轮导航、导航按钮、GSAP 入场动画。
 *              交互行为与旧脚本一致。
 *
 * 说明：专辑数据由 `useAlbumShowcase()` 内部的 computed 提供，
 *      `selectAlbum` / `init3DAlbumShowcase` 作为闭包函数读取该 computed，
 *      不再各自调用 `useData()`——`useAsyncData` 只能在 setup 同步阶段调用，
 *      在事件回调里调用属于未定义行为。
 */
import { CONFIG } from '~/utils/config'
import { useData } from './useData'
import { useSharedState } from './useSharedState'

/** 入场动画只播放一次（避免 watch 重建 DOM 时重复触发 gsap.from 造成 opacity 卡 0） · Play entry animation only once (avoid re-triggering gsap.from on DOM rebuild, which would stick opacity at 0) */
let entryAnimPlayed = false

function getSelectedAlbumIndex() {
  return useSharedState<number>('album:selectedIndex', () => 0)
}

/**
 * 应用 3D 轮播布局 · Apply carousel layout
 * @param selectedIndex 选中卡片索引 · selected card index
 * @description 所有卡片用 style.transform 直接写入（不依赖 GSAP 短属性 3D 合成），
 *              动画由 .album-card 自带的 transition: transform 负责。
 */
function applyCarouselLayout(selectedIndex: number): void {
  if (typeof document === 'undefined') return
  const stack = document.getElementById('albumStack')
  if (!stack) return
  const cards = Array.from(stack.querySelectorAll<HTMLElement>('.album-card'))
  if (cards.length === 0) return

  const isSmallScreen = window.innerWidth <= CONFIG.MOBILE_BREAKPOINT
  const radius = isSmallScreen ? CONFIG.ALBUM_CAROUSEL.MOBILE_RADIUS : CONFIG.ALBUM_CAROUSEL.DESKTOP_RADIUS
  const selectedX = isSmallScreen ? CONFIG.ALBUM_CAROUSEL.MOBILE_SELECTED_X : CONFIG.ALBUM_CAROUSEL.DESKTOP_SELECTED_X
  const selectedY = isSmallScreen ? CONFIG.ALBUM_CAROUSEL.MOBILE_SELECTED_Y : CONFIG.ALBUM_CAROUSEL.DESKTOP_SELECTED_Y
  const selectedScale = isSmallScreen ? CONFIG.ALBUM_CAROUSEL.MOBILE_SELECTED_SCALE : CONFIG.ALBUM_CAROUSEL.DESKTOP_SELECTED_SCALE
  const baseScale = isSmallScreen ? CONFIG.ALBUM_CAROUSEL.MOBILE_BASE_SCALE : CONFIG.ALBUM_CAROUSEL.DESKTOP_BASE_SCALE
  const decrement = isSmallScreen ? CONFIG.ALBUM_CAROUSEL.SCALE_DECREMENT_MOBILE : CONFIG.ALBUM_CAROUSEL.SCALE_DECREMENT_DESKTOP

  cards.forEach((card, i) => {
    const isSelected = i === selectedIndex
    const diff = Math.abs(i - selectedIndex)
    const scale = isSelected
      ? selectedScale
      : Math.max(baseScale - diff * decrement, CONFIG.ALBUM_CAROUSEL.MIN_SCALE)

    let tx: number, ty: number, tz: number, ry: number
    if (isSelected) {
      tx = selectedX
      ty = selectedY
      tz = radius + 50
      ry = 0
    } else {
      const angle = (i / cards.length) * Math.PI * 2
      tx = Math.sin(angle) * radius
      ty = 0
      tz = Math.cos(angle) * radius - radius
      ry = (angle * 180 / Math.PI) - 90
    }

    card.style.transform = `translate3d(${tx}px, ${ty}px, ${tz}px) rotateY(${ry}deg) scale(${scale}, ${scale})`
    card.style.zIndex = String(isSelected ? cards.length + 1 : cards.length - diff)
  })
}

/**
 * useAlbumShowcase 组合式入口 · Composable entry
 */
export function useAlbumShowcase() {
  const { localizedConcerts } = useData()
  const selectedAlbumIndex = getSelectedAlbumIndex()

  /** 当前专辑列表（本地化）· Current albums (localized) */
  const albums = computed(() =>
    localizedConcerts.value.map((c) => ({
      id: c.id,
      title: c.concertName ?? '',
      subtitle: c.artist ?? '',
      date: c.date ?? '',
      time: c.time ?? '',
      intro: c.theme ?? '',
      image: c.poster ?? ''
    }))
  )

  /** 切换选中专辑 · Select album by index */
  function selectAlbum(index: number): void {
    if (albums.value.length === 0) return
    const clamped = Math.max(0, Math.min(index, albums.value.length - 1))
    if (clamped === selectedAlbumIndex.value) return
    selectedAlbumIndex.value = clamped
    applyCarouselLayout(clamped)
  }

  /** 事件是否已绑定（组件实例级，卸载后允许重新绑定） · events bound for this instance */
  let eventsBound = false
  /** 卸载时执行的清理函数 · cleanup fns run on unmount */
  let cleanups: Array<() => void> = []

  /**
   * 初始化 3D 专辑展示 · Init 3D album showcase
   * @description 绑定事件与入场动画（仅首次），应用初始布局。
   */
  function init3DAlbumShowcase(): void {
    if (typeof document === 'undefined') return
    if (albums.value.length === 0) return

    const gsap = (window as any).gsap
    const hasGsap = typeof gsap !== 'undefined'

    if (!eventsBound) {
      eventsBound = true

      // 触摸滑动 · Touch swipe
      let touchStartX = 0
      const stack = document.getElementById('albumStack')

      const onTouchStart = (e: TouchEvent) => {
        touchStartX = e.touches[0].clientX
      }
      const onTouchEnd = (e: TouchEvent) => {
        const diffX = touchStartX - e.changedTouches[0].clientX
        if (Math.abs(diffX) > CONFIG.SWIPE_MIN_DISTANCE) {
          if (diffX > 0) selectAlbum(selectedAlbumIndex.value + 1)
          else selectAlbum(selectedAlbumIndex.value - 1)
        }
      }
      stack?.addEventListener('touchstart', onTouchStart, { passive: true })
      stack?.addEventListener('touchend', onTouchEnd, { passive: true })
      cleanups.push(() => {
        stack?.removeEventListener('touchstart', onTouchStart)
        stack?.removeEventListener('touchend', onTouchEnd)
      })

      // 窗口尺寸变化重排 · Re-layout on window resize
      let resizeTimeout: ReturnType<typeof setTimeout> | undefined
      const onResize = () => {
        clearTimeout(resizeTimeout)
        resizeTimeout = setTimeout(() => applyCarouselLayout(selectedAlbumIndex.value), CONFIG.DEBOUNCE_RESIZE_DELAY)
      }
      window.addEventListener('resize', onResize)
      cleanups.push(() => {
        clearTimeout(resizeTimeout)
        window.removeEventListener('resize', onResize)
      })

      // 入场动画（仅首次执行一次，且用 fromTo 明确回到 opacity:1） · Entry animation (runs only once, uses fromTo to explicitly return to opacity:1)
      if (hasGsap && !entryAnimPlayed) {
        entryAnimPlayed = true
        const isSmallScreen = window.innerWidth <= CONFIG.MOBILE_BREAKPOINT
        setTimeout(() => {
          gsap.fromTo('.album-stack-container',
            { opacity: 0, x: isSmallScreen ? 0 : -40 },
            { duration: CONFIG.GSAP_ALBUM_DURATION, opacity: 1, x: 0, delay: CONFIG.GSAP_ALBUM_DELAY, ease: 'back.out(1.6)', overwrite: 'auto' })
          gsap.fromTo('.detail-panel',
            { opacity: 0, x: isSmallScreen ? 0 : 40 },
            { duration: CONFIG.GSAP_ALBUM_DURATION, opacity: 1, x: 0, delay: CONFIG.GSAP_PANEL_DELAY, ease: 'back.out(1.6)', overwrite: 'auto' })
        }, CONFIG.IMAGE_LOAD_DELAY)
      } else if (!hasGsap) {
        const sc = document.querySelector<HTMLElement>('.album-stack-container')
        const dp = document.querySelector<HTMLElement>('.detail-panel')
        if (sc) sc.style.opacity = '1'
        if (dp) dp.style.opacity = '1'
      }
    }

    // 应用初始布局（当前选中索引） · Apply initial layout (current selected index)
    nextTick(() => {
      if (selectedAlbumIndex.value >= albums.value.length) selectedAlbumIndex.value = 0
      applyCarouselLayout(selectedAlbumIndex.value)
    })
  }

  // 语言切换（本地化数据变化）时重新应用布局，无需重建 DOM · Re-apply layout on language switch (localized data change) without rebuilding DOM
  watch(albums, () => {
    if (typeof document !== 'undefined') {
      nextTick(() => {
        if (selectedAlbumIndex.value >= albums.value.length) selectedAlbumIndex.value = 0
        applyCarouselLayout(selectedAlbumIndex.value)
      })
    }
  })

  onUnmounted(() => {
    cleanups.forEach(fn => fn())
    cleanups = []
    eventsBound = false
  })

  return {
    selectedAlbumIndex,
    albums,
    selectAlbum,
    applyCarouselLayout,
    init3DAlbumShowcase
  }
}
