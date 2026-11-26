// @vitest-environment happy-dom
/**
 * 歌单 composable 单测 · useSonglist
 *
 * @description 覆盖本轮歌单改造的所有新增行为：
 *              · 点击懒加载 GET /api/concerts/:id?lang=xx、loading 切换、无歌单不打开；
 *              · 按「语言 + id」缓存命中零请求、语言切换重新拉取；
 *              · hover 预取与在途 Promise 去重（同一 key 只发一次）；
 *              · 失败静默/提示、不写缓存可重试；
 *              · 搜索过滤 filteredSonglist；
 *              · 页面加载后立即预取前 N 场（prefetchInitialSonglists）；
 *              · 延时全量速热（scheduleSonglistWarmup）：20s 触发、跳过已缓存、每语言每会话一次。
 *
 *              Nuxt 自动导入 computed 与 i18n/错误 composable 在 vitest 下以桩提供；
 *              $fetch 走 test/stubs/nuxt-app.ts 的 __setFetch 注入。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computed } from 'vue'
import { __setFetch } from '../stubs/nuxt-app'
import type { Concert, SongItem } from '../../app/types'

/** i18n / 错误桩：用普通 { value } 对象模拟 ref，composable 只读 .value */
const mocks = vi.hoisted(() => ({
  lang: { value: 'zh-CN' } as { value: string },
  handleError: vi.fn()
}))

vi.mock('../../app/composables/useI18n', () => ({
  useAppI18n: () => ({ currentLanguage: mocks.lang })
}))
vi.mock('../../app/composables/useAppError', () => ({
  useAppError: () => ({ handleError: mocks.handleError })
}))

// Nuxt 自动导入的 computed 全局桩 · global stub for Nuxt auto-imported computed
vi.stubGlobal('computed', computed)

import { useSonglist } from '../../app/composables/useSonglist'

/** 构造最小 Concert 桩 · minimal Concert stub */
function concert(id: number, hasSonglist = true): Concert {
  return {
    id,
    artist: { 'zh-CN': '艺人' },
    concertName: { 'zh-CN': '演唱会' },
    hasSonglist
  } as unknown as Concert
}

/** 记录请求 URL · recorded request URLs */
let urls: string[]
/** 自增语言标记：保证各用例缓存 key 隔离 · unique locale per case */
let langSeq = 0

/** 复位共享状态（useSharedState 模块级缓存跨用例持久）· reset shared refs */
function resetShared(): void {
  const s = useSonglist()
  s.songlistOpen.value = false
  s.songlistLoading.value = false
  s.activeSonglist.value = []
  s.activeConcert.value = null
  s.songlistSearch.value = ''
}

beforeEach(() => {
  urls = []
  mocks.lang.value = `zh-${++langSeq}`
  mocks.handleError.mockClear()
  resetShared()
  __setFetch(async (url: string) => {
    urls.push(String(url))
    const id = Number(String(url).match(/\/api\/concerts\/(\d+)/)?.[1] ?? 0)
    return { songlist: [{ name: `歌曲${id}`, link: null } as SongItem] }
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useSonglist — 点击懒加载与缓存', () => {
  it('点击有歌单的场：打开弹窗 → 请求单场详情 → 填充歌单并清 loading', async () => {
    const s = useSonglist()
    await s.openSonglistModal(concert(101))

    expect(s.songlistOpen.value).toBe(true)
    expect(s.songlistLoading.value).toBe(false)
    expect(s.activeSonglist.value.map((x) => x.name)).toEqual(['歌曲101'])
    expect(s.activeConcert.value).toEqual({ artist: { 'zh-CN': '艺人' }, concertName: { 'zh-CN': '演唱会' } })
    expect(urls).toEqual([`/api/concerts/101?lang=${encodeURIComponent(mocks.lang.value)}`])
  })

  it('无歌单（hasSonglist=false）不打开也不请求', async () => {
    const s = useSonglist()
    await s.openSonglistModal(concert(102, false))
    expect(s.songlistOpen.value).toBe(false)
    expect(urls).toHaveLength(0)
  })

  it('同一 id + 语言二次打开命中缓存，零请求；切换语言重新拉取', async () => {
    const s = useSonglist()
    await s.openSonglistModal(concert(103))
    await s.openSonglistModal(concert(103))
    expect(urls).toHaveLength(1)

    mocks.lang.value = `${mocks.lang.value}-en`
    await s.openSonglistModal(concert(103))
    expect(urls).toHaveLength(2)
    expect(urls[1]).toContain(`lang=${encodeURIComponent(mocks.lang.value)}`)
  })

  it('请求失败：提示错误、不写缓存，下次点击可重试', async () => {
    let fail = true
    __setFetch(async (url: string) => {
      urls.push(String(url))
      if (fail) throw new Error('boom')
      return { songlist: [{ name: '重试成功', link: null } as SongItem] }
    })
    const s = useSonglist()
    await s.openSonglistModal(concert(104))
    expect(mocks.handleError).toHaveBeenCalledTimes(1)
    expect(s.activeSonglist.value).toEqual([])
    expect(s.songlistLoading.value).toBe(false)

    fail = false
    await s.openSonglistModal(concert(104))
    expect(s.activeSonglist.value.map((x) => x.name)).toEqual(['重试成功'])
    expect(urls).toHaveLength(2)
  })

  it('搜索过滤：filteredSonglist 在 150ms 防抖后按关键词过滤（不区分大小写）', async () => {
    __setFetch(async () => ({
      songlist: [
        { name: 'Rainbow', link: null },
        { name: '彩虹', link: null }
      ] as SongItem[]
    }))
    const s = useSonglist()
    await s.openSonglistModal(concert(105))
    expect(s.filteredSonglist.value).toHaveLength(2)
    const flushDebounce = () => new Promise((resolve) => setTimeout(resolve, 200))
    s.songlistSearch.value = 'rain'
    await flushDebounce()
    expect(s.filteredSonglist.value.map((x) => x.name)).toEqual(['Rainbow'])
    s.songlistSearch.value = '不存在'
    await flushDebounce()
    expect(s.filteredSonglist.value).toEqual([])
  })

  it('closeSonglistModal 关闭弹窗', async () => {
    const s = useSonglist()
    await s.openSonglistModal(concert(106))
    expect(s.songlistOpen.value).toBe(true)
    s.closeSonglistModal()
    expect(s.songlistOpen.value).toBe(false)
  })
})

describe('useSonglist — 预取与去重', () => {
  it('hover 预取后点击命中缓存，全程只发一次请求', async () => {
    const s = useSonglist()
    s.prefetchSonglist(concert(201))
    await Promise.resolve()
    await s.openSonglistModal(concert(201))
    expect(urls).toHaveLength(1)
    expect(s.activeSonglist.value).toHaveLength(1)
  })

  it('hover 与点击几乎同时发生：在途 Promise 去重，只发一次请求', async () => {
    const s = useSonglist()
    s.prefetchSonglist(concert(202))
    const opening = s.openSonglistModal(concert(202))
    await opening
    expect(urls).toHaveLength(1)
  })

  it('hover 预取失败静默：不触发 handleError，点击仍可重试', async () => {
    let fail = true
    __setFetch(async (url: string) => {
      urls.push(String(url))
      if (fail) throw new Error('prefetch failed')
      return { songlist: [{ name: 'OK', link: null } as SongItem] }
    })
    const s = useSonglist()
    s.prefetchSonglist(concert(203))
    await Promise.resolve()
    expect(mocks.handleError).not.toHaveBeenCalled()

    fail = false
    await s.openSonglistModal(concert(203))
    expect(urls).toHaveLength(2)
    expect(s.activeSonglist.value.map((x) => x.name)).toEqual(['OK'])
  })

  it('prefetchInitialSonglists 只预取前 N 个有歌单的场，跳过无歌单项', async () => {
    const s = useSonglist()
    await s.prefetchInitialSonglists([
      concert(301, false),
      concert(302),
      concert(303),
      concert(304, false),
      concert(305),
      concert(306)
    ], 2)
    // 第 3 个有歌单的是 305（302/303 已占满 count=2）
    expect(urls).toEqual([302, 303].map((id) => `/api/concerts/${id}?lang=${encodeURIComponent(mocks.lang.value)}`))
  })

  it('prefetchInitialSonglists 跳过已缓存条目', async () => {
    const s = useSonglist()
    await s.openSonglistModal(concert(307))
    const before = urls.length
    await s.prefetchInitialSonglists([concert(307), concert(308)], 5)
    expect(urls.length).toBe(before + 1)
    expect(urls[urls.length - 1]).toContain('/api/concerts/308')
  })
})

describe('useSonglist — 20s 延时全量速热', () => {
  it('20s 后串行预热所有未缓存歌单，跳过已缓存与无歌单项', async () => {
    vi.useFakeTimers()
    const s = useSonglist()
    await s.openSonglistModal(concert(401)) // 先缓存 401
    const before = urls.length

    s.scheduleSonglistWarmup([
      concert(401), // 已缓存
      concert(402, false), // 无歌单
      concert(403),
      concert(404)
    ])
    await vi.advanceTimersByTimeAsync(20_000)

    expect(urls.length).toBe(before + 2)
    expect(urls[urls.length - 2]).toContain('/api/concerts/403')
    expect(urls[urls.length - 1]).toContain('/api/concerts/404')
  })

  it('同一语言每会话只调度一次；切换语言后按新语言再调度', async () => {
    vi.useFakeTimers()
    const s = useSonglist()
    const list = [concert(405)]

    s.scheduleSonglistWarmup(list)
    s.scheduleSonglistWarmup(list)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(urls).toHaveLength(1) // 同语言第二次被去重

    mocks.lang.value = `${mocks.lang.value}-next`
    s.scheduleSonglistWarmup(list)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(urls).toHaveLength(2) // 新语言重新调度
    expect(urls[1]).toContain(`lang=${encodeURIComponent(mocks.lang.value)}`)
  })
})
