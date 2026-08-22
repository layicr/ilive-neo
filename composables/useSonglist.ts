/**
 * 歌单模态框 composable · Songlist modal
 *
 * @description 从 songlist.js 迁移而来。
 *              纯状态管理：打开状态/搜索关键词/当前歌单，渲染交给模板（声明式）。
 *              交互行为与旧脚本一致（show 类、body 锁定、防抖搜索）。
 */
import type { Concert, SongItem } from '~/types'
import { useSharedState } from './useSharedState'

function getSonglistOpen() {
  return useSharedState<boolean>('songlist:open', () => false)
}
function getActiveSonglist() {
  return useSharedState<SongItem[]>('songlist:data', () => [])
}
function getActiveConcert() {
  return useSharedState<{ artist: string; concertName: string } | null>('songlist:concert', () => null)
}
function getSonglistSearch() {
  return useSharedState<string>('songlist:search', () => '')
}

/** 过滤歌单 · Filter songlist by keyword */
function filterSonglist(list: SongItem[], keyword: string): SongItem[] {
  const lowerKeyword = keyword.trim().toLowerCase()
  if (!lowerKeyword) return list
  return list.filter(song => song.name.toLowerCase().includes(lowerKeyword))
}

/** 打开歌单模态框 · Open songlist modal */
function openSonglistModal(concert: Concert): void {
  if (!concert.songlist || concert.songlist.length === 0) return
  const activeSonglist = getActiveSonglist()
  const activeConcert = getActiveConcert()
  const songlistSearch = getSonglistSearch()
  const songlistOpen = getSonglistOpen()

  activeSonglist.value = concert.songlist
  activeConcert.value = { artist: concert.artist, concertName: concert.concertName }
  songlistSearch.value = ''
  songlistOpen.value = true
}

/** 关闭歌单模态框 · Close songlist modal */
function closeSonglistModal(): void {
  const songlistOpen = getSonglistOpen()
  songlistOpen.value = false
}

/**
 * useSonglist 组合式入口 · Composable entry
 */
export function useSonglist() {
  const songlistOpen = getSonglistOpen()
  const activeSonglist = getActiveSonglist()
  const activeConcert = getActiveConcert()
  const songlistSearch = getSonglistSearch()

  /** 过滤后的歌单 · Filtered songlist */
  const filteredSonglist = computed(() => filterSonglist(activeSonglist.value, songlistSearch.value))

  return {
    songlistOpen,
    activeSonglist,
    activeConcert,
    filteredSonglist,
    songlistSearch,
    openSonglistModal,
    closeSonglistModal
  }
}
