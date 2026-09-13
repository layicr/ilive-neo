/**
 * localize 单元测试 · Unit tests for `app/utils/index.ts` 的多语言纯函数
 * @description 直接测试 `pickLocale` / `localizeConcert` / `localizeCity` / `localizeWish`
 *              与 `computeCityConcertCounts`（纯函数、无 `#app` / Nuxt 依赖）。
 *              Directly tests `pickLocale` / `localizeConcert` / `localizeCity` / `localizeWish` and
 *              `computeCityConcertCounts` (pure functions with no `#app` / Nuxt dependency).
 */
import { describe, it, expect } from 'vitest'
import {
  pickLocale,
  localizeConcert,
  localizeCity,
  localizeWish,
  computeCityConcertCounts,
  pickHotConcertIds
} from '../../app/utils'
import type { LocalizedConcert, LocalizedCity, LocalizedWish, LocalizedText } from '../../app/types'

/** 构造多语言演唱会 fixture · Build a localized concert fixture */
function buildLocalizedConcert(overrides: Partial<LocalizedConcert> = {}): LocalizedConcert {
  return {
    id: 1,
    artist: { 'zh-CN': '五月天', en: 'Mayday' },
    concertName: { 'zh-CN': 'Just Rock It 2016', en: 'Just Rock It 2016' },
    theme: { 'zh-CN': '演唱会', en: 'Concert' },
    location: {
      'zh-CN': '中国 · 陕西 · 西安 · 陕西省体育场',
      en: "China · Shaanxi · Xi'an · Shaanxi Provincial Stadium"
    },
    locationDetail: {
      country: { 'zh-CN': '中国', en: 'China' },
      province: { 'zh-CN': '陕西', en: 'Shaanxi' },
      city: { 'zh-CN': '西安', en: "Xi'an" },
      venue: { 'zh-CN': '陕西省体育场', en: 'Shaanxi Provincial Stadium' }
    },
    seat: { 'zh-CN': 'VIP 1排', en: 'VIP Row 1' },
    price: { 'zh-CN': '¥1555', en: '¥1555' },
    date: '2016.09.03',
    time: '19:30',
    poster: 'img/poster.jpg',
    tags: { 'zh-CN': ['摇滚'], en: ['Rock'] },
    description: { 'zh-CN': '五月天演唱会', en: 'Mayday concert' },
    images: [{ src: 'a.jpg', alt: { 'zh-CN': '现场', en: 'Live' } }],
    video: { 'zh-CN': '视频', en: 'Video' },
    videoUrl: { 'zh-CN': 'v.mp4', en: 'v.mp4' },
    songlist: [
      { name: { 'zh-CN': '为爱而生', en: 'Born to Love' }, link: 'https://example.com' },
      { name: { 'zh-CN': '温柔', en: 'Tenderness' }, link: null }
    ],
    ...overrides
  }
}

describe('pickLocale — 多语言回退取词', () => {
  it('命中目标语言时直接返回该语言值', () => {
    expect(pickLocale({ 'zh-CN': '五月天', en: 'Mayday' }, 'zh-CN')).toBe('五月天')
    expect(pickLocale({ 'zh-CN': '五月天', en: 'Mayday' }, 'en')).toBe('Mayday')
  })

  it('目标语言缺失时回退到 zh', () => {
    expect(pickLocale({ 'zh-CN': '五月天' }, 'en')).toBe('五月天')
    expect(pickLocale({ 'zh-CN': '五月天' }, 'zh-Hant')).toBe('五月天')
  })

  it('zh 缺失时回退到 en', () => {
    expect(pickLocale({ 'zh-CN': '', en: 'Mayday' }, 'zh-Hant')).toBe('Mayday')
  })

  it('目标语言为空白串时同样触发回退', () => {
    expect(pickLocale({ 'zh-CN': '五月天', en: '   ' }, 'en')).toBe('五月天')
  })

  it('null / undefined 输入返回空串', () => {
    expect(pickLocale(null, 'zh-CN')).toBe('')
    expect(pickLocale(undefined, 'en')).toBe('')
  })

  it('所有语言均为空时返回空串', () => {
    expect(pickLocale({ 'zh-CN': '' } as LocalizedText, 'en')).toBe('')
  })
})

describe('localizeConcert — 多语言演唱会本地化为单语言', () => {
  it('zh 模式输出中文字段集', () => {
    const c = localizeConcert(buildLocalizedConcert(), 'zh-CN')
    expect(c.artist).toBe('五月天')
    expect(c.concertName).toBe('Just Rock It 2016')
    expect(c.location).toBe('中国 · 陕西 · 西安 · 陕西省体育场')
    expect(c.tags).toEqual(['摇滚'])
    expect(c.description).toBe('五月天演唱会')
  })

  it('en 模式输出英文字段集', () => {
    const c = localizeConcert(buildLocalizedConcert(), 'en')
    expect(c.artist).toBe('Mayday')
    expect(c.location).toBe("China · Shaanxi · Xi'an · Shaanxi Provincial Stadium")
    expect(c.tags).toEqual(['Rock'])
  })

  it('未翻译语言（zh-Hant）整体回退到 zh', () => {
    const c = localizeConcert(buildLocalizedConcert(), 'zh-Hant')
    expect(c.artist).toBe('五月天')
    expect(c.tags).toEqual(['摇滚'])
  })

  it('locationDetail 四段分别本地化', () => {
    const c = localizeConcert(buildLocalizedConcert(), 'en')
    expect(c.locationDetail).toEqual({
      country: 'China',
      province: 'Shaanxi',
      city: "Xi'an",
      venue: 'Shaanxi Provincial Stadium'
    })
  })

  it('seat / price / video / videoUrl 为 null 时输出 null', () => {
    const c = localizeConcert(
      buildLocalizedConcert({ seat: null, price: null, video: null, videoUrl: null }),
      'zh-CN'
    )
    expect(c.seat).toBe(null)
    expect(c.price).toBe(null)
    expect(c.video).toBe(null)
    expect(c.videoUrl).toBe(null)
  })

  it('images 的 alt 按语言本地化', () => {
    const c = localizeConcert(buildLocalizedConcert(), 'en')
    expect(c.images).toEqual([{ src: 'a.jpg', alt: 'Live' }])
  })

  it('songlist 转为 { name, link } 并本地化 name', () => {
    const zh = localizeConcert(buildLocalizedConcert(), 'zh-CN')
    expect(zh.songlist).toEqual([
      { name: '为爱而生', link: 'https://example.com' },
      { name: '温柔', link: null }
    ])

    const en = localizeConcert(buildLocalizedConcert(), 'en')
    expect(en.songlist[0]).toEqual({ name: 'Born to Love', link: 'https://example.com' })
  })

  it('songlist 目标语言缺失时回退', () => {
    const c = localizeConcert(
      buildLocalizedConcert({ songlist: [{ name: { 'zh-CN': '温柔', en: '' }, link: null }] }),
      'en'
    )
    expect(c.songlist[0].name).toBe('温柔')
  })

  it('tags 按索引逐项回退', () => {
    const c = localizeConcert(
      buildLocalizedConcert({ tags: { 'zh-CN': ['摇滚', '流行'], en: ['Rock'] } }),
      'en'
    )
    expect(c.tags).toEqual(['Rock', '流行'])
  })

  it('保留 id / date / time / poster 等非翻译字段', () => {
    const c = localizeConcert(buildLocalizedConcert(), 'zh-CN')
    expect(c.id).toBe(1)
    expect(c.date).toBe('2016.09.03')
    expect(c.time).toBe('19:30')
    expect(c.poster).toBe('img/poster.jpg')
  })
})

describe('localizeCity — 多语言城市本地化', () => {
  const city: LocalizedCity = {
    id: 3,
    name: { 'zh-CN': '西安', en: "Xi'an" },
    seq: 1,
    icon: 'city-xian'
  }

  it('en 模式取英文名，concertCount 由调用方填充（默认 0）', () => {
    expect(localizeCity(city, 'en')).toEqual({
      id: 3,
      name: "Xi'an",
      seq: 1,
      icon: 'city-xian',
      concertCount: 0
    })
  })

  it('未翻译语言回退到 zh', () => {
    expect(localizeCity(city, 'zh-Hant').name).toBe('西安')
  })
})

describe('localizeWish — 多语言许愿本地化', () => {
  const wish: LocalizedWish = {
    id: 9,
    content: { 'zh-CN': '想看五月天', en: 'Wanna see Mayday' },
    likes: 3,
    liked: true
  }

  it('en 模式取英文内容，其余字段原样保留', () => {
    expect(localizeWish(wish, 'en')).toEqual({
      id: 9,
      content: 'Wanna see Mayday',
      likes: 3,
      liked: true
    })
  })

  it('未翻译语言回退到 zh', () => {
    expect(localizeWish(wish, 'zh-Hant').content).toBe('想看五月天')
  })
})

describe('computeCityConcertCounts — 城市演唱会计数（跨语言匹配）', () => {
  const cities: { id: number; name: LocalizedText }[] = [
    { id: 1, name: { 'zh-CN': '西安', en: "Xi'an" } },
    { id: 2, name: { 'zh-CN': '深圳', en: 'Shenzhen' } }
  ]

  it('按 location 包含城市名计数（任一语言命中）', () => {
    const concerts = [
      { location: { 'zh-CN': '中国 · 陕西 · 西安 · 陕西省体育场', en: "China · Shaanxi · Xi'an · ..." } },
      { location: { 'zh-CN': '中国 · 广东 · 深圳 · 深圳湾体育中心', en: 'China · Guangdong · Shenzhen · ...' } },
      // 同一场只计首个命中城市（西安在前）
      { location: { 'zh-CN': '中国 · 陕西 · 西安 · 深圳湾体育中心', en: "China · Shaanxi · Xi'an · ..." } }
    ]
    const counts = computeCityConcertCounts(concerts, cities)
    expect(counts[1]).toBe(2) // 西安
    expect(counts[2]).toBe(1) // 深圳
  })

  it('zh 为空、仅 en 命中时按 en 计数', () => {
    const concerts = [{ location: { 'zh-CN': '', en: 'China · Guangdong · Shenzhen · ...' } }]
    const counts = computeCityConcertCounts(concerts, cities)
    expect(counts[2]).toBe(1)
  })

  it('无城市命中时返回空对象', () => {
    const concerts = [{ location: { 'zh-CN': '日本 · 东京', en: 'Japan · Tokyo' } }]
    expect(computeCityConcertCounts(concerts, cities)).toEqual({})
  })

  it('location 缺失的条目被跳过', () => {
    const concerts = [{}, { location: { 'zh-CN': '中国 · 陕西 · 西安', en: "China · Shaanxi · Xi'an" } }]
    expect(computeCityConcertCounts(concerts, cities)[1]).toBe(1)
  })
})

describe('pickHotConcertIds — 热度标记（点赞前三，并列同显）', () => {
  it('全部为 0（或无 likes）→ 空集合', () => {
    expect(pickHotConcertIds([{ id: 1, likes: 0 }, { id: 2 }]).size).toBe(0)
  })

  it('不足三档时有几档选几档', () => {
    const ids = pickHotConcertIds([{ id: 1, likes: 5 }, { id: 2, likes: 2 }])
    expect([...ids].sort((a, b) => a - b)).toEqual([1, 2])
  })

  it('取点赞数最高的三档，第四档不入选', () => {
    const ids = pickHotConcertIds([
      { id: 1, likes: 9 },
      { id: 2, likes: 8 },
      { id: 3, likes: 7 },
      { id: 4, likes: 6 },
      { id: 5, likes: 0 }
    ])
    expect([...ids].sort((a, b) => a - b)).toEqual([1, 2, 3])
  })

  it('第三档并列同显（与第三档同值者一并入选）', () => {
    const ids = pickHotConcertIds([
      { id: 1, likes: 5 },
      { id: 2, likes: 3 },
      { id: 3, likes: 1 },
      { id: 4, likes: 1 },
      { id: 5, likes: 0 }
    ])
    expect([...ids].sort((a, b) => a - b)).toEqual([1, 2, 3, 4])
  })

  it('并列第一名全部入选', () => {
    const ids = pickHotConcertIds([{ id: 1, likes: 2 }, { id: 2, likes: 2 }])
    expect([...ids].sort((a, b) => a - b)).toEqual([1, 2])
  })
})
