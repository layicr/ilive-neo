/**
 * 图片画廊 composable · Image gallery
 *
 * @description 从 gallery.js 迁移而来。
 *              纯状态管理：仅记录打开状态与当前图片索引，渲染交给模板（声明式）。
 *              键盘导航（左右方向键、ESC）由 useKeyboard 提供。
 */
import { useData } from './useData'
import { useKeyboard } from './useKeyboard'
import { useSharedState } from './useSharedState'

// 懒初始化缓存：首次调用 useGallery()（处于 setup 上下文）时取一次本地化数据，
// 避免模块顶层调用 useData() 导致 SSR 阶段 "Nuxt instance unavailable"，
// 同时避免每次调用 currentImages() 重复 useData()。
let cachedLocalizedConcerts: ReturnType<typeof useData>['localizedConcerts'] | null = null
function getLocalizedConcerts() {
  if (!cachedLocalizedConcerts) cachedLocalizedConcerts = useData().localizedConcerts
  return cachedLocalizedConcerts
}

function getGalleryState() {
  return useSharedState<{ concertId: number; currentIndex: number } | null>('gallery:state', () => null)
}
function getGalleryOpen() {
  return useSharedState<boolean>('gallery:open', () => false)
}

/** 打开图片画廊 · Open gallery */
function openGallery(concertId: number, index: number): void {
  const galleryState = getGalleryState()
  const galleryOpen = getGalleryOpen()
  galleryState.value = { concertId, currentIndex: index }
  galleryOpen.value = true
}

/** 关闭图片画廊 · Close gallery */
function closeGallery(): void {
  const galleryOpen = getGalleryOpen()
  const galleryState = getGalleryState()
  galleryOpen.value = false
  galleryState.value = null
}

/** 上一张 · Previous image */
function prevImage(): void {
  const galleryState = getGalleryState()
  const galleryOpen = getGalleryOpen()
  if (!galleryState.value || !galleryOpen.value) return
  const { currentIndex } = galleryState.value
  const images = currentImages()
  if (images.length === 0) return
  galleryState.value.currentIndex = (currentIndex - 1 + images.length) % images.length
}

/** 下一张 · Next image */
function nextImage(): void {
  const galleryState = getGalleryState()
  const galleryOpen = getGalleryOpen()
  if (!galleryState.value || !galleryOpen.value) return
  const images = currentImages()
  if (images.length === 0) return
  galleryState.value.currentIndex = (galleryState.value.currentIndex + 1) % images.length
}

/** 当前场次的图片列表 · Current concert images (localized) */
function currentImages(): { src: string; alt: string }[] {
  const galleryState = getGalleryState()
  if (!galleryState.value) return []
  const concert = getLocalizedConcerts().value.find(c => c.id === galleryState.value!.concertId)
  return concert ? concert.images : []
}

/**
 * useGallery 组合式入口 · Composable entry
 * @description 注册键盘导航（左右方向键切换图片、ESC 关闭）。
 */
export function useGallery() {
  const keyboard = useKeyboard()
  const galleryOpen = getGalleryOpen()
  const galleryState = getGalleryState()

  // 当前展示图片与计数器 · current image & counter (computed)
  const currentImage = computed(() => {
    if (!galleryOpen.value || !galleryState.value) return null
    const images = currentImages()
    const img = images[galleryState.value.currentIndex]
    return img ? { ...img, index: galleryState.value.currentIndex, total: images.length } : null
  })

  onMounted(() => {
    keyboard.register('ArrowLeft', () => {
      if (galleryOpen.value) { prevImage(); return true }
      return false
    }, 20)

    keyboard.register('ArrowRight', () => {
      if (galleryOpen.value) { nextImage(); return true }
      return false
    }, 20)

    keyboard.register('Escape', () => {
      if (galleryOpen.value) { closeGallery(); return true }
      return false
    }, 20)
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
