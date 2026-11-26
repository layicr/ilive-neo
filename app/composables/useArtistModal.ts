/**
 * 艺人模态框 composable · Artist modal
 *
 * @description 纯状态管理：点击「艺人」统计卡片打开艺人列表模态框，渲染交给模板（声明式）。
 *              ESC 关闭由 useKeyboard 注册，组件卸载时注销；与 useGallery 同构
 *              （票根弹窗的 ESC 由 TicketModal.vue 组件自行注册）。
 */
import { useData } from './useData'
import { useKeyboard } from './useKeyboard'
import { useSharedState } from './useSharedState'
import { aggregateArtistShows } from '~/utils'

function getArtistModalOpen() {
  return useSharedState<boolean>('artist:open', () => false)
}

/**
 * useArtistModal 组合式入口 · Composable entry
 * @description 注册 ESC 关闭，卸载时自动注销键盘监听。
 */
export function useArtistModal() {
  const { localizedConcerts } = useData()
  const keyboard = useKeyboard()
  const artistModalOpen = getArtistModalOpen()

  /** 艺人聚合（歌手 + 团队成员，按场次去重后累计场数）· artists with show counts */
  const artists = computed(() =>
    aggregateArtistShows(localizedConcerts.value.map((c) => ({ artist: c.artist, team: c.team })))
  )

  /** 打开艺人模态框 · Open artist modal */
  function openArtistModal(): void {
    artistModalOpen.value = true
  }

  /** 关闭艺人模态框 · Close artist modal */
  function closeArtistModal(): void {
    artistModalOpen.value = false
  }

  let unregisterKeys: Array<() => void> = []

  onMounted(() => {
    unregisterKeys = [
      keyboard.register('Escape', () => {
        if (artistModalOpen.value) { closeArtistModal(); return true }
        return false
      }, 20)
    ]
  })

  onUnmounted(() => {
    unregisterKeys.forEach(fn => fn())
    unregisterKeys = []
  })

  return {
    artistModalOpen,
    artists,
    openArtistModal,
    closeArtistModal
  }
}
