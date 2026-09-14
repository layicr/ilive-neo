/**
 * 单元测试：useData 聚合数据 composable · Aggregate-data composable
 *
 * @description 使用 `#app` 桩（useAsyncData / useState / $fetch 可控）在 node 环境直接驱动 useData：
 *              · 请求 URL 带 `?lang=`，响应字段（concerts/cities/wishes/stats/seo/friendLinks/generatedAt）映射；
 *              · 服务端已本地化（serverLocalized）→ 直通，否则调用 localizeConcert 系列；
 *              · 点赞乐观更新 / 覆盖叠加 / 失败回滚 / 429 标注 / 在途防抖 / 冷却窗口 / 未知 id 不请求。
 *
 *              Drives useData in a plain node environment through the `#app` stub: request URL locale
 *              param, field mapping, server-localized pass-through vs client localization, and the
 *              full optimistic-like lifecycle (override, rollback, 429, in-flight guard, cooldown).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useData } from '../../app/composables/useData'
import { __setFetch, __flushAsyncData, __resetNuxtState } from '#app'

vi.mock('../../app/composables/useI18n', async () => {
  const { ref } = await import('vue')
  const currentLanguage = ref<string>('zh-CN')
  return { useAppI18n: () => ({ currentLanguage }) }
})

const t = (zh: string, en: string, hant = zh) => ({ 'zh-CN': zh, en, 'zh-Hant': hant })

/** 已本地化（服务端返回单语言）的演唱会 · server-localized concert */
const flatConcert = (id: number, likes: number, liked: boolean) => ({
  id,
  artist: `Artist ${id}`,
  concertName: `Concert ${id}`,
  theme: 'Theme',
  location: 'Beijing',
  locationDetail: { country: 'China', province: 'Beijing', city: 'Beijing', venue: 'Bird Nest' },
  seat: 'A',
  price: '1000',
  date: '2024-05-01',
  time: '19:30',
  poster: '/p.jpg',
  tags: ['Pop'],
  description: 'desc',
  images: [{ src: '/i.jpg', alt: 'img' }],
  video: null,
  videoUrl: null,
  songlist: [{ name: 'Song', link: 'https://x' }],
  likes,
  liked
})

/** 多语言形态（未本地化）的演唱会 · localized (multi-locale) concert */
const multiConcert = (id: number, likes: number, liked: boolean) => ({
  ...flatConcert(id, likes, liked),
  artist: t(`歌手${id}`, `Artist ${id}`),
  concertName: t(`演出${id}`, `Concert ${id}`),
  theme: t('主题', 'Theme'),
  location: t('北京', 'Beijing'),
  locationDetail: { country: t('中国', 'China'), province: t('北京', 'Beijing'), city: t('北京', 'Beijing'), venue: t('鸟巢', 'Bird Nest') },
  seat: t('A区', 'A'),
  price: t('1000', '1000'),
  tags: { 'zh-CN': ['流行'], en: ['Pop'] },
  description: t('描述', 'desc'),
  images: [{ src: '/i.jpg', alt: t('图', 'img') }],
  songlist: [{ name: t('歌', 'Song'), link: 'https://x' }]
})

/** 构造 /api/data 响应 · build an /api/data payload */
const apiPayload = (opts: { localized: boolean; likes?: number; liked?: boolean }) => ({
  data: {
    locale: opts.localized ? 'zh-CN' : null,
    concerts: [opts.localized ? flatConcert(1, opts.likes ?? 3, opts.liked ?? false) : multiConcert(1, opts.likes ?? 3, opts.liked ?? false)],
    cities: opts.localized
      ? [{ id: 1, name: 'Beijing', seq: 1, icon: 'i', concertCount: 2 }]
      : [{ id: 1, name: t('北京', 'Beijing'), seq: 1, icon: 'i' }],
    wishes: opts.localized
      ? [{ id: 1, content: 'wish', likes: 1, liked: false }]
      : [{ id: 1, content: t('许愿', 'wish'), likes: 1, liked: false }],
    stats: { totalConcerts: 1, totalArtists: 1, totalCities: 1, totalWishes: 1 },
    seo: { siteUrl: 'https://ilive.lyc.la' },
    friendLinks: [{ id: 1, href: 'https://ok.example.com', icon: 'fas fa-globe', title: { 'zh-CN': '站点' }, description: null, seq: 1 }]
  },
  generatedAt: '2026-09-13T00:00:00.000Z'
})

/** 安装 $fetch 并记录调用 · install $fetch and record calls */
function installFetch(handler: (url: string, opts?: Record<string, unknown>) => unknown) {
  const calls: { url: string; opts?: Record<string, unknown> }[] = []
  __setFetch(async (url, opts) => {
    calls.push({ url, opts })
    return handler(url, opts)
  })
  return calls
}

/** 每个用例把时钟再前推 10 秒 · advance the clock by 10s per case */
let clockOffsetMs = 0

beforeEach(() => {
  __resetNuxtState()
  // likeInFlight / likeCooldown 是模块级状态、跨用例残留；每个用例把系统时间再前推 10s，
  // 使前序用例写入的冷却时间戳（冷却窗口仅 700ms）绝不阻挡当前用例。
  // likeInFlight / likeCooldown are module-level and survive across cases — advance the clock by
  // 10s per case so cooldown stamps written by earlier cases can never block the current one.
  clockOffsetMs += 10_000
  vi.useFakeTimers()
  vi.setSystemTime(new Date(Date.UTC(2030, 0, 1) + clockOffsetMs))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useData — 请求与字段映射', () => {
  it('请求 URL 携带当前语言，各字段正确映射', async () => {
    const calls = installFetch(() => apiPayload({ localized: true }))
    const d = useData()
    await __flushAsyncData()

    expect(calls[0].url).toBe('/api/data?lang=zh-CN')
    expect(d.stats.value.totalConcerts).toBe(1)
    expect(d.generatedAt.value).toBe('2026-09-13T00:00:00.000Z')
    expect(d.seo.value?.siteUrl).toBe('https://ilive.lyc.la')
    expect(d.friendLinks.value).toHaveLength(1)
    expect(d.dataReady.value).toBe(true)
    expect(d.dataError.value).toBe(false)
  })

  it('服务端已本地化 → 直通单语言数据（不再二次 localize）', async () => {
    installFetch(() => apiPayload({ localized: true }))
    const d = useData()
    await __flushAsyncData()

    expect(d.localizedConcerts.value[0].artist).toBe('Artist 1')
    expect(d.localizedConcerts.value[0].tags).toEqual(['Pop'])
    expect(d.counts.value).toEqual({ 1: 2 })
  })

  it('服务端未本地化（locale=null）→ 前端按当前语言 localize', async () => {
    installFetch(() => apiPayload({ localized: false }))
    const d = useData()
    await __flushAsyncData()

    expect(d.localizedConcerts.value[0].artist).toBe('歌手1')
    expect(d.localizedConcerts.value[0].locationDetail.venue).toBe('鸟巢')
    expect(d.localizedWishes.value[0].content).toBe('许愿')
    expect(d.counts.value).toEqual({ 1: 1 })
  })

  it('请求失败 → dataError 为 true 且可被调用方感知', async () => {
    installFetch(() => {
      throw new Error('network down')
    })
    const d = useData()
    await __flushAsyncData()

    expect(d.dataError.value).toBe(true)
    expect(d.dataReady.value).toBe(false)
  })
})

describe('useData — 点赞乐观更新与失败回滚', () => {
  it('toggleLike 成功：乐观叠加 → 服务端校准，并 POST /api/like { id }', async () => {
    const calls = installFetch((url) => (url === '/api/like' ? { id: 1, likes: 4, liked: true } : apiPayload({ localized: true })))
    const d = useData()
    await __flushAsyncData()

    await d.toggleLike(1)

    const likeCall = calls.find((c) => c.url === '/api/like')!
    expect(likeCall.opts?.method).toBe('POST')
    expect(likeCall.opts?.body).toEqual({ id: 1 })
    expect(d.localizedConcerts.value[0].liked).toBe(true)
    expect(d.localizedConcerts.value[0].likes).toBe(4)
  })

  it('toggleLike 失败：覆盖被回滚为服务端状态，并向上抛出', async () => {
    installFetch((url) => {
      if (url === '/api/like') throw new Error('500')
      return apiPayload({ localized: true })
    })
    const d = useData()
    await __flushAsyncData()

    await expect(d.toggleLike(1)).rejects.toThrow('500')
    expect(d.localizedConcerts.value[0].liked).toBe(false)
    expect(d.localizedConcerts.value[0].likes).toBe(3)
  })

  it('429 限流：异常被标注 e.code = rate_limited 供上层区分提示', async () => {
    installFetch((url) => {
      if (url === '/api/like') {
        const err: Error & { status?: number } = new Error('too many')
        err.status = 429
        throw err
      }
      return apiPayload({ localized: true })
    })
    const d = useData()
    await __flushAsyncData()

    await expect(d.toggleLike(1)).rejects.toMatchObject({ code: 'rate_limited' })
  })

  it('未知 id：不发请求、不抛错', async () => {
    const calls = installFetch(() => apiPayload({ localized: true }))
    const d = useData()
    await __flushAsyncData()
    const before = calls.filter((c) => c.url === '/api/like').length

    await d.toggleLike(999)

    expect(calls.filter((c) => c.url === '/api/like')).toHaveLength(before)
  })

  it('冷却窗口内连点被忽略（同一 id 只发一次请求）', async () => {
    // beforeEach 已把时钟设为本次用例的基准时间 · beforeEach already set this case's clock base
    const calls = installFetch((url) => (url === '/api/like' ? { id: 1, likes: 4, liked: true } : apiPayload({ localized: true })))
    const d = useData()
    await __flushAsyncData()

    await d.toggleLike(1)
    await d.toggleLike(1)
    expect(calls.filter((c) => c.url === '/api/like')).toHaveLength(1)

    // 越过 700ms 冷却后可再次点赞 · cooldown elapses
    vi.setSystemTime(new Date(Date.now() + 2000))
    await d.toggleLike(1)
    expect(calls.filter((c) => c.url === '/api/like')).toHaveLength(2)
  })
})
