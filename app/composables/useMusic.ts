/**
 * 背景音乐 composable · Background music
 *
 * @description 从 music.js 迁移而来。
 *              管理背景音乐播放/暂停、音量、音乐源切换（中英文版本）。
 *              纯状态管理：播放状态（isPlaying）由模板声明式绑定，不再直操作 DOM。
 */
import { CONFIG } from '~/utils/config'
import { useAppI18n } from './useI18n'
import { useAppError } from './useAppError'
import { useSharedState } from './useSharedState'

/** 是否正在播放 · Is playing（共享状态，懒初始化） */
function getIsPlaying() {
  return useSharedState<boolean>('music:playing', () => false)
}

/** 是否已初始化 · Whether initialized */
let musicInitialized = false

/** 背景音乐元素引用 · Audio element ref */
/** 背景音乐 <audio> 元素引用 · audio element ref */
let bgMusic: HTMLAudioElement | null = null
/** 背景音乐 <source> 元素引用 · audio <source> ref */
let bgMusicSource: HTMLSourceElement | null = null

/** 切换音乐源 · Switch music source */
function switchMusicSrc(musicSrc: string): void {
  const { handleError } = useAppError()
  const isPlaying = getIsPlaying()
  if (!bgMusic || !bgMusicSource) return

  const wasPlaying = isPlaying.value
  bgMusicSource.src = musicSrc
  bgMusic.load()

  if (wasPlaying) {
    bgMusic.play().then(() => {
      bgMusic!.currentTime = 0
    }).catch((error) => {
      handleError(error, 'MusicSwitch', false)
      isPlaying.value = false
    })
  }
}

/** 初始化背景音乐 · Init background music
 *  @description 仅加载音频资源不自动播放，用户点击音乐按钮后才开始播放。
 */
function initBgMusic(): void {
  if (musicInitialized) return
  musicInitialized = true

  bgMusic = document.getElementById('bgMusic') as HTMLAudioElement | null
  bgMusicSource = document.getElementById('bgMusicSource') as HTMLSourceElement | null

  if (!bgMusic || !bgMusicSource) return

  const { currentData } = useAppI18n()
  bgMusicSource.src = currentData.value.bgMusic || 'music/bgm_cn.mp3'
  bgMusic.load()
  bgMusic.volume = CONFIG.MUSIC_VOLUME

  // 不再自动播放，也不再监听首次交互自动补播 · no autoplay, no first-interaction auto-resume
  // 用户点击音乐按钮时（toggleMusic）才开始播放 · playback starts only on the music button (toggleMusic)
}

/** 音乐按钮点击处理 · Toggle music on click */
function toggleMusic(): void {
  const { handleError } = useAppError()
  const isPlaying = getIsPlaying()
  if (!bgMusic || !bgMusicSource) return

  if (isPlaying.value) {
    bgMusic.pause()
    isPlaying.value = false
  } else {
    bgMusic.play().then(() => {
      isPlaying.value = true
    }).catch((error) => {
      handleError(error, 'MusicTogglePlay', false)
      isPlaying.value = false
    })
  }
}

/**
 * useMusic 组合式入口 · Composable entry
 */
export function useMusic() {
  const { currentLanguage, currentData } = useAppI18n()
  const isPlaying = getIsPlaying()

  // 语言切换时切换音乐源 · switch music source on locale change
  watch(currentLanguage, () => {
    if (musicInitialized && currentData.value.bgMusic) {
      switchMusicSrc(currentData.value.bgMusic)
    }
  })

  return {
    isPlaying,
    initBgMusic,
    toggleMusic,
    switchMusicSrc
  }
}
