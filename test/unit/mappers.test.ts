import { describe, it, expect } from 'vitest'
import { mapConcert, computeCityConcertCounts } from '../../server/lib/mappers'

/** 构造一个完整的 concerts 行 · Build a full concerts row */
function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    artist_zh: '五月天',
    artist_en: 'Mayday',
    concert_name_zh: 'Just Rock It 2016',
    concert_name_en: 'Just Rock It 2016',
    theme_zh: '演唱会',
    theme_en: 'Concert',
    country_zh: '中国',
    country_en: 'China',
    province_zh: '陕西',
    province_en: 'Shaanxi',
    city_zh: '西安',
    city_en: "Xi'an",
    venue_zh: '陕西省体育场',
    venue_en: 'Shaanxi Provincial Stadium',
    seat_zh: 'VIP 1排20座',
    seat_en: 'VIP Row 1 Seat 20',
    price_zh: '¥1555',
    price_en: '¥1555',
    date: '2016.09.03',
    time: '19:30',
    poster: 'img/concert/20160903-mayday.jpg',
    description_zh: '五月天 Just Rock It 演唱会',
    description_en: 'Mayday Just Rock It concert',
    video_zh: null,
    video_en: null,
    video_url_zh: null,
    video_url_en: null,
    ...overrides
  }
}

describe('mapConcert — 演唱会行→双语对象映射', () => {
  it('location 拼接包含国家前缀（国家·省·市·场馆）', () => {
    const result = mapConcert(buildRow(), [], [], [])
    expect(result.location.zh).toBe('中国 · 陕西 · 西安 · 陕西省体育场')
    expect(result.location.en).toBe('China · Shaanxi · Xi\'an · Shaanxi Provincial Stadium')
  })

  it('venue 为空时自动省略（国家·省·市）', () => {
    const result = mapConcert(buildRow({ venue_zh: null, venue_en: '' }), [], [], [])
    expect(result.location.zh).toBe('中国 · 陕西 · 西安')
    expect(result.location.en).toBe('China · Shaanxi · Xi\'an')
  })

  it('country 为空时自动省略（省·市·场馆）', () => {
    const result = mapConcert(buildRow({ country_zh: '', country_en: null }), [], [], [])
    expect(result.location.zh).toBe('陕西 · 西安 · 陕西省体育场')
  })

  it('locationDetail 返回分段双语结构', () => {
    const result = mapConcert(buildRow(), [], [], [])
    expect(result.locationDetail).toEqual({
      country: { zh: '中国', en: 'China' },
      province: { zh: '陕西', en: 'Shaanxi' },
      city: { zh: '西安', en: "Xi'an" },
      venue: { zh: '陕西省体育场', en: 'Shaanxi Provincial Stadium' }
    })
  })

  it('artist/concertName 双语映射正确', () => {
    const result = mapConcert(buildRow(), [], [], [])
    expect(result.artist).toEqual({ zh: '五月天', en: 'Mayday' })
    expect(result.concertName).toEqual({ zh: 'Just Rock It 2016', en: 'Just Rock It 2016' })
  })

  it('seat/price/video 等可空字段：值缺失时为 null', () => {
    const result = mapConcert(buildRow({ seat_zh: null, seat_en: null, video_zh: null, video_en: null }), [], [], [])
    expect(result.seat).toBe(null)
    expect(result.video).toBe(null)
  })

  it('seat 有值时报双语对象', () => {
    const result = mapConcert(buildRow(), [], [], [])
    expect(result.seat).toEqual({ zh: 'VIP 1排20座', en: 'VIP Row 1 Seat 20' })
  })

  it('tags/images/songlist 正确组装', () => {
    const tags = [{ zh: '摇滚', en: 'Rock' }]
    const images = [{ src: 'a.jpg', alt_zh: '现场', alt_en: 'Live' }]
    const songlist = [{ zh: '为爱而生', en: 'Born to Love', link: null }]
    const result = mapConcert(buildRow(), tags, images, songlist)
    expect(result.tags).toEqual({ zh: ['摇滚'], en: ['Rock'] })
    expect(result.images).toEqual([{ src: 'a.jpg', alt: { zh: '现场', en: 'Live' } }])
    expect(result.songlist).toEqual([{ zh: '为爱而生', en: 'Born to Love', link: null }])
  })

  it('description 为可选双语对（空则空串）', () => {
    const result = mapConcert(buildRow(), [], [], [])
    expect(result.description).toEqual({
      zh: '五月天 Just Rock It 演唱会',
      en: 'Mayday Just Rock It concert'
    })
  })
})

describe('computeCityConcertCounts — 城市演唱会计数', () => {
  const cities = [
    { id: 1, name_zh: '西安', name_en: "Xi'an" },
    { id: 2, name_zh: '深圳', name_en: 'Shenzhen' }
  ]

  it('按 location 包含城市名计数（中英任一命中）', () => {
    const concerts = [
      { location: { zh: '中国 · 陕西 · 西安 · 陕西省体育场', en: 'China · Shaanxi · Xi\'an · ...' } },
      { location: { zh: '中国 · 广东 · 深圳 · 深圳湾体育中心', en: 'China · Guangdong · Shenzhen · ...' } },
      // 同一场只计首个命中城市
      { location: { zh: '中国 · 陕西 · 西安 · 深圳湾体育中心', en: 'China · Shaanxi · Xi\'an · ...' } }
    ]
    const counts = computeCityConcertCounts(concerts, cities)
    expect(counts[1]).toBe(2) // 西安
    expect(counts[2]).toBe(1) // 深圳
  })

  it('中英文各命中计数（en 命中用 name_en）', () => {
    const concerts = [
      { location: { zh: '', en: 'China · Guangdong · Shenzhen · ...' } }
    ]
    const counts = computeCityConcertCounts(concerts, cities)
    expect(counts[2]).toBe(1) // 深圳（en 命中）
  })

  it('无城市命中时计数为空对象', () => {
    const concerts = [{ location: { zh: '日本 · 东京', en: 'Japan · Tokyo' } }]
    const counts = computeCityConcertCounts(concerts, cities)
    expect(counts).toEqual({})
  })
})
