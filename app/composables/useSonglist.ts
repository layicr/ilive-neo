/**
 * 歌单模态框 composable · Songlist modal
 *
 * @description 从 songlist.js 迁移而来，并升级为按需加载：
 *              共享状态（打开态 / 当前歌单 / 搜索词）+ 点击时单场懒加载 + hover 预取。
 *              模态的 body 滚动锁定由 index.vue 统一 watch 处理；搜索为即时 computed 过滤（无防抖）。
 *
 *              歌单正文不随 /api/data 下发，改为点击时按单场 GET /api/concerts/:id 懒加载；
 *              按「语言 + 演唱会 id」缓存，hover 预取复用同一份缓存与在途 Promise。
 */
import type { Concert, SongItem } from '~/types'
import { useSharedState } from './useSharedState'
import { useAppI18n } from './useI18n'
import { useAppError } from './useAppError'

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
function getSonglistLoading() {
  return useSharedState<boolean>('songlist:loading', () => false)
}

/** 歌单缓存（模块级共享，key=语言:演唱会 id）· songlist cache shared across composable instances */
const songlistCache = new Map<string, SongItem[]>()
/** 在途请求（同一 key 去重，hover + click 只发一次）· in-flight requests */
const songlistPending = new Map<string, Promise<SongItem[] | null>>()

function cacheKey(id: number, lang: string): string {
  return `${lang}:${id}`
}

/** 过滤歌单 · Filter songlist by keyword */
function filterSonglist(list: SongItem[], keyword: string): SongItem[] {
  const lowerKeyword = keyword.trim().toLowerCase()
  if (!lowerKeyword) return list
  return list.filter(song => song.name.toLowerCase().includes(lowerKeyword))
}

/**
 * 取歌单（缓存 → 在途 → 网络）· Resolve songlist via cache, in-flight or network
 * @param silent 预取场景不弹错误提示（用户只是 hover）· prefetch stays silent
 */
function loadSonglist(id: number, lang: string, silent: boolean, onError: (e: unknown) => void): Promise<SongItem[] | null> {
  const key = cacheKey(id, lang)
  const cached = songlistCache.get(key)
  if (cached) return Promise.resolve(cached)
  const pending = songlistPending.get(key)
  if (pending) return pending

  const req = (async () => {
    try {
      const detail = await $fetch<{ songlist?: SongItem[] }>(`/api/concerts/${id}?lang=${encodeURIComponent(lang)}`)
      const songs = Array.isArray(detail?.songlist) ? detail.songlist : []
      songlistCache.set(key, songs)
      return songs
    } catch (e) {
      // 失败不写入缓存，下次点击可重试 · do not cache failures so a later click can retry
      if (!silent) onError(e)
      return null
    } finally {
      songlistPending.delete(key)
    }
  })()
  songlistPending.set(key, req)
  return req
}

/**
 * useSonglist 组合式入口 · Composable entry
 * @description i18n / 错误提示必须在 setup 阶段取得引用，供之后的事件回调使用（回调里直接调 useI18n 会抛错）。
 */
export function useSonglist() {
  const { currentLanguage } = useAppI18n()
  const { handleError } = useAppError()

  const songlistOpen = getSonglistOpen()
  const songlistLoading = getSonglistLoading()
  const activeSonglist = getActiveSonglist()
  const activeConcert = getActiveConcert()
  const songlistSearch = getSonglistSearch()

  /** 过滤后的歌单 · Filtered songlist */
  const filteredSonglist = computed(() => filterSonglist(activeSonglist.value, songlistSearch.value))

  /**
   * 打开歌单模态框（按需加载）· Open songlist modal (lazy-loaded)
   * @description 先打开弹窗并置 loading，请求返回后填充歌单；命中缓存时直接展示。
   */
  async function openSonglistModal(concert: Concert): Promise<void> {
    if (!concert.hasSonglist) return
    const lang = currentLanguage.value

    activeConcert.value = { artist: concert.artist, concertName: concert.concertName }
    songlistSearch.value = ''
    songlistOpen.value = true

    const cached = songlistCache.get(cacheKey(concert.id, lang))
    if (cached) {
      activeSonglist.value = cached
      songlistLoading.value = false
      return
    }

    songlistLoading.value = true
    const songs = await loadSonglist(concert.id, lang, false, (e) =>
      handleError(e instanceof Error ? e : new Error('songlist fetch failed'), 'SonglistFetch', true, 'loadFailed')
    )
    songlistLoading.value = false
    if (songs) activeSonglist.value = songs
  }

  /** 关闭歌单模态框 · Close songlist modal */
  function closeSonglistModal(): void {
    songlistOpen.value = false
  }

  /**
   * hover 预取歌单（点击前预热缓存）· Prefetch songlist on hover
   * @description 命中缓存或在途请求时零开销；失败静默，不影响用户后续点击重试。
   */
  function prefetchSonglist(concert: Concert): void {
    if (!concert.hasSonglist || typeof window === 'undefined') return
    void loadSonglist(concert.id, currentLanguage.value, true, () => {})
  }

  return {
    songlistOpen,
    songlistLoading,
    activeSonglist,
    activeConcert,
    filteredSonglist,
    songlistSearch,
    openSonglistModal,
    closeSonglistModal,
    prefetchSonglist
  }
}
