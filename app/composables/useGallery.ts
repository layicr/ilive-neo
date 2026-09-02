/**
 * 图片画廊 composable · Image gallery
 *
 * @description 从 gallery.js 迁移而来。
 *              纯状态管理：仅记录打开状态与当前图片索引，渲染交给模板（声明式）。
 *              键盘导航（左右方向键、ESC）由 useKeyboard 提供。
 *
 * 说明：所有派生数据（图片列表、当前图片）均以闭包内的 computed 提供，
 *      不再使用模块级缓存——模块级缓存在 SSR 下会跨请求存活，
 *      把 A 请求的数据/语言状态泄漏给 B 请求。
 */
import { useData } from './useData'
import { useKeyboard } from './useKeyboard'
import { useSharedState } from './useSharedState'

function getGalleryState() {
  return useSharedState<{ concertId: number; currentIndex: number } | null>('gallery:state', () => null)
}
function getGalleryOpen() {
  return useSharedState<boolean>('gallery:open', () => false)
}

/**
 * useGallery 组合式入口 · Composable entry
 * @description 注册键盘导航（左右方向键切换图片、ESC 关闭），卸载时自动注销。
 */
export function useGallery() {
  const { localizedConcerts } = useData()
  const keyboard = useKeyboard()
  const galleryOpen = getGalleryOpen()
  const galleryState = getGalleryState()

  /** 当前场次的图片列表 · Images of the concert being viewed */
  const currentImages = computed<{ src: string; alt: string }[]>(() => {
    if (!galleryState.value) return []
    const concert = localizedConcerts.value.find(c => c.id === galleryState.value!.concertId)
    return concert ? concert.images : []
  })

  /** 当前展示图片与计数器 · current image & counter */
  const currentImage = computed(() => {
    if (!galleryOpen.value || !galleryState.value) return null
    const images = currentImages.value
    const img = images[galleryState.value.currentIndex]
    return img ? { ...img, index: galleryState.value.currentIndex, total: images.length } : null
  })

  /** 打开图片画廊 · Open gallery */
  function openGallery(concertId: number, index: number): void {
    galleryState.value = { concertId, currentIndex: index }
    galleryOpen.value = true
  }

  /** 关闭图片画廊 · Close gallery */
  function closeGallery(): void {
    galleryOpen.value = false
    galleryState.value = null
  }

  /** 上一张 · Previous image */
  function prevImage(): void {
    if (!galleryState.value || !galleryOpen.value) return
    const images = currentImages.value
    if (images.length === 0) return
    const { currentIndex } = galleryState.value
    galleryState.value.currentIndex = (currentIndex - 1 + images.length) % images.length
  }

  /** 下一张 · Next image */
  function nextImage(): void {
    if (!galleryState.value || !galleryOpen.value) return
    const images = currentImages.value
    if (images.length === 0) return
    galleryState.value.currentIndex = (galleryState.value.currentIndex + 1) % images.length
  }

  // 键盘导航：保存注销函数，组件卸载时一并注销 · keep unregister fns to clean up on unmount
  let unregisterKeys: Array<() => void> = []

  onMounted(() => {
    unregisterKeys = [
      keyboard.register('ArrowLeft', () => {
        if (galleryOpen.value) { prevImage(); return true }
        return false
      }, 20),

      keyboard.register('ArrowRight', () => {
        if (galleryOpen.value) { nextImage(); return true }
        return false
      }, 20),

      keyboard.register('Escape', () => {
        if (galleryOpen.value) { closeGallery(); return true }
        return false
      }, 20)
    ]
  })

  onUnmounted(() => {
    unregisterKeys.forEach(fn => fn())
    unregisterKeys = []
  })

  return {
    galleryOpen,
    galleryState,
    currentImage,
    openGallery,
    closeGallery,
    prevImage,
    nextImage
  }
}
