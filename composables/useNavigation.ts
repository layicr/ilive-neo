/**
 * 导航 composable · Navigation
 *
 * @description 从 navigation.js 迁移而来。
 *              返回顶部、城市/视频模态框、反馈按钮、触摸手势。
 *              纯状态管理：渲染交给模板（声明式）。
 */
import { CONFIG } from '~/utils/config'
import { useI18n } from './useI18n'
import { useSharedState } from './useSharedState'

function getBackToTopVisible() {
  return useSharedState<boolean>('nav:backToTopVisible', () => false)
}
function getCityModalOpen() {
  return useSharedState<boolean>('nav:cityModalOpen', () => false)
}
function getVideoModalOpen() {
  return useSharedState<boolean>('nav:videoModalOpen', () => false)
}
function getVideoModalUrl() {
  return useSharedState<string>('nav:videoUrl', () => '')
}
function getVideoModalTitle() {
  return useSharedState<string>('nav:videoTitle', () => 'Loading...')
}

/** 返回顶部 · Scroll to top */
function backToTop(): void {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

/** 滚动监听：控制返回顶部按钮显隐 · Scroll listener */
function initScrollListener(): void {
  const backToTopVisible = getBackToTopVisible()
  const onScroll = () => {
    backToTopVisible.value = window.scrollY > CONFIG.SCROLL_THRESHOLD
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
}

/** 打开城市模态框 · Open city modal */
function openCityModal(): void {
  const cityModalOpen = getCityModalOpen()
  cityModalOpen.value = true
}

/** 关闭城市模态框 · Close city modal */
function closeCityModal(): void {
  const cityModalOpen = getCityModalOpen()
  cityModalOpen.value = false
}

/** 打开视频模态框 · Open video modal (bilibili bvid) */
function openVideoModal(videoId: string, title?: string): void {
  if (!videoId) return
  const videoModalUrl = getVideoModalUrl()
  const videoModalOpen = getVideoModalOpen()
  const videoModalTitle = getVideoModalTitle()
  // 与原版一致：用 bvid 构造 B 站内嵌播放器地址
  videoModalUrl.value = `https://player.bilibili.com/player.html?bvid=${videoId}&autoplay=1`
  if (title) videoModalTitle.value = title
  videoModalOpen.value = true
}

/** 关闭视频模态框 · Close video modal */
function closeVideoModal(): void {
  const videoModalOpen = getVideoModalOpen()
  const videoModalUrl = getVideoModalUrl()
  videoModalOpen.value = false
  videoModalUrl.value = ''
}

/** 打开反馈链接 · Open feedback link */
function openFeedback(): void {
  const { currentData } = useI18n()
  const url = CONFIG.GITHUB_ISSUES_URL
  const title = currentData.value.feedback.urlTitle
  const body = currentData.value.feedback.urlBody
  window.open(`${url}?title=${title}&body=${body}`, '_blank', 'noopener')
}

/**
 * useNavigation 组合式入口 · Composable entry
 */
export function useNavigation() {
  const backToTopVisible = getBackToTopVisible()
  const cityModalOpen = getCityModalOpen()
  const videoModalOpen = getVideoModalOpen()
  const videoModalUrl = getVideoModalUrl()
  const videoModalTitle = getVideoModalTitle()

  onMounted(() => {
    initScrollListener()
  })

  return {
    backToTopVisible,
    cityModalOpen,
    videoModalOpen,
    videoModalUrl,
    videoModalTitle,
    backToTop,
    openCityModal,
    closeCityModal,
    openVideoModal,
    closeVideoModal,
    openFeedback
  }
}
