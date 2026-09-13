/**
 * mappers 单元测试 · Unit tests for `server/lib/mappers.ts`
 * @description 覆盖多语言 JSON 列（`*_i18n`）解析、`mapConcert` 行→领域模型映射，
 *              以及 `fetchAllConcerts` 批量查询后的内存 groupBy 装配（用最小 client 桩，不连真实 DB）。
 *              Covers multi-locale JSON column (`*_i18n`) parsing, `mapConcert` row→domain mapping, and
 *              the in-memory groupBy assembly of `fetchAllConcerts` (minimal client stub, no real DB).
 */
import { describe, it, expect } from 'vitest'
import type { Client } from '@libsql/client'
import { parseI18n, mapConcert, fetchAllConcerts } from '../../server/lib/mappers'
import type { ConcertRow, TagRow, ImageRow, SongRow } from '../../server/lib/mappers'

/** 序列化多语言文本列（JSON 字符串）· Serialize a localized-text column */
const T = (obj: Record<string, string>) => JSON.stringify(obj)
/** 序列化多语言标签列（JSON 字符串）· Serialize a localized-tags column */
const A = (obj: Record<string, string[]>) => JSON.stringify(obj)

/** 构造一个完整的 concerts 行（新 `*_i18n` JSON 列格式）· Build a full `concerts` row */
function buildRow(overrides: Partial<ConcertRow> = {}): ConcertRow {
  return {
    id: 1,
    artist_i18n: T({ 'zh-CN': '五月天', en: 'Mayday', 'zh-Hant': '五月天' }),
    concert_name_i18n: T({ 'zh-CN': 'Just Rock It 2016', en: 'Just Rock It 2016' }),
    theme_i18n: T({ 'zh-CN': '演唱会', en: 'Concert' }),
    country_i18n: T({ 'zh-CN': '中国', en: 'China' }),
    province_i18n: T({ 'zh-CN': '陕西', en: 'Shaanxi' }),
    city_i18n: T({ 'zh-CN': '西安', en: "Xi'an" }),
    venue_i18n: T({ 'zh-CN': '陕西省体育场', en: 'Shaanxi Provincial Stadium' }),
    seat_i18n: T({ 'zh-CN': 'VIP 1排20座', en: 'VIP Row 1 Seat 20' }),
    price_i18n: T({ 'zh-CN': '¥1555', en: '¥1555' }),
    date: '2016.09.03',
    time: '19:30',
    poster: 'img/concert/20160903-mayday.jpg',
    description_i18n: T({ 'zh-CN': '五月天 Just Rock It 演唱会', en: 'Mayday Just Rock It concert' }),
    video_i18n: null,
    video_url_i18n: null,
    ...overrides
  }
}

/**
 * 最小 LibSQL client 桩 · Minimal LibSQL client stub
 * @description 按 SQL 文本路由到内存数据，避免测试依赖真实数据库。
 */
function stubClient(tables: {
  concerts: ConcertRow[]
  tags?: TagRow[]
  images?: ImageRow[]
  songlist?: SongRow[]
}): Client {
  return {
    execute: async (q: unknown) => {
      const sql = typeof q === 'string' ? q : String((q as { sql: string }).sql)
      if (sql.includes('FROM concert_tags')) return { rows: tables.tags ?? [] }
      if (sql.includes('FROM concert_images')) return { rows: tables.images ?? [] }
      if (sql.includes('FROM concert_songlist')) return { rows: tables.songlist ?? [] }
      if (sql.includes('FROM concerts')) return { rows: tables.concerts }
      return { rows: [] }
    }
  } as unknown as Client
}

describe('parseI18n — 多语言 JSON 列解析', () => {
  it('正常 JSON 解析为对象并保留各语言值', () => {
    expect(parseI18n(T({ 'zh-CN': '五月天', en: 'Mayday', 'zh-Hant': '五月天' }))).toEqual({
      'zh-CN': '五月天',
      en: 'Mayday',
      'zh-Hant': '五月天'
    })
  })

  it("缺少 zh-CN 键时补空串（zh-CN 为基语言）", () => {
    expect(parseI18n(T({ en: 'Mayday' }))).toEqual({ 'zh-CN': '', en: 'Mayday' })
  })

  it("null / undefined / 空串 → { 'zh-CN': '' }", () => {
    expect(parseI18n(null)).toEqual({ 'zh-CN': '' })
    expect(parseI18n(undefined)).toEqual({ 'zh-CN': '' })
    expect(parseI18n('')).toEqual({ 'zh-CN': '' })
  })

  it("非法 JSON 不抛错，回退为 { 'zh-CN': '' }", () => {
    expect(parseI18n('not-json')).toEqual({ 'zh-CN': '' })
  })
})

describe('mapConcert — 演唱会行 → 多语言对象映射', () => {
  it('location 拼接为「国家 · 省 · 市 · 场馆」', () => {
    const result = mapConcert(buildRow(), [], [], [])
    expect(result.location['zh-CN']).toBe('中国 · 陕西 · 西安 · 陕西省体育场')
    expect(result.location.en).toBe("China · Shaanxi · Xi'an · Shaanxi Provincial Stadium")
  })

  it('venue 缺失时自动省略（国家 · 省 · 市）', () => {
    const result = mapConcert(buildRow({ venue_i18n: null }), [], [], [])
    expect(result.location['zh-CN']).toBe('中国 · 陕西 · 西安')
    expect(result.location.en).toBe("China · Shaanxi · Xi'an")
  })

  it('country 为空 JSON 时自动省略（省 · 市 · 场馆）', () => {
    const result = mapConcert(buildRow({ country_i18n: T({}) }), [], [], [])
    expect(result.location['zh-CN']).toBe('陕西 · 西安 · 陕西省体育场')
  })

  it('未翻译语言（zh-Hant）的 location 为空串，不跨语言回退', () => {
    const result = mapConcert(buildRow(), [], [], [])
    expect(result.location['zh-Hant']).toBe('')
  })

  it('locationDetail 返回按语言分段的四段结构', () => {
    const result = mapConcert(buildRow(), [], [], [])
    expect(result.locationDetail).toEqual({
      country: { 'zh-CN': '中国', en: 'China' },
      province: { 'zh-CN': '陕西', en: 'Shaanxi' },
      city: { 'zh-CN': '西安', en: "Xi'an" },
      venue: { 'zh-CN': '陕西省体育场', en: 'Shaanxi Provincial Stadium' }
    })
  })

  it('artist / concertName / theme / description 映射为多语言对象', () => {
    const result = mapConcert(buildRow(), [], [], [])
    expect(result.artist).toEqual({
      'zh-CN': '五月天',
      en: 'Mayday',
      'zh-Hant': '五月天'
    })
    expect(result.concertName).toEqual({ 'zh-CN': 'Just Rock It 2016', en: 'Just Rock It 2016' })
    expect(result.theme).toEqual({ 'zh-CN': '演唱会', en: 'Concert' })
    expect(result.description).toEqual({
      'zh-CN': '五月天 Just Rock It 演唱会',
      en: 'Mayday Just Rock It concert'
    })
  })

  it('seat / price / video 有值时为多语言对象', () => {
    const result = mapConcert(buildRow(), [], [], [])
    expect(result.seat).toEqual({ 'zh-CN': 'VIP 1排20座', en: 'VIP Row 1 Seat 20' })
    expect(result.price).toEqual({ 'zh-CN': '¥1555', en: '¥1555' })
  })

  it('seat / price / video / videoUrl 为 null 时输出 null', () => {
    const result = mapConcert(
      buildRow({ seat_i18n: null, price_i18n: null, video_i18n: null, video_url_i18n: null }),
      [],
      [],
      []
    )
    expect(result.seat).toBe(null)
    expect(result.price).toBe(null)
    expect(result.video).toBe(null)
    expect(result.videoUrl).toBe(null)
  })

  it('tags 合并多行为「每语言数组」，缺失语言补空数组', () => {
    const tags: TagRow[] = [
      { concert_id: 1, i18n: A({ 'zh-CN': ['摇滚'], en: ['Rock'] }) },
      { concert_id: 1, i18n: A({ 'zh-CN': ['流行'], en: ['Pop'] }) }
    ]
    const result = mapConcert(buildRow(), tags, [], [])
    expect(result.tags['zh-CN']).toEqual(['摇滚', '流行'])
    expect(result.tags.en).toEqual(['Rock', 'Pop'])
    expect(result.tags['zh-Hant']).toEqual([])
  })

  it('images 映射为 { src, alt }', () => {
    const images: ImageRow[] = [
      { concert_id: 1, url: 'a.jpg', alt_i18n: T({ 'zh-CN': '现场', en: 'Live' }) },
      { concert_id: 1, url: 'b.jpg', alt_i18n: null }
    ]
    const result = mapConcert(buildRow(), [], images, [])
    expect(result.images).toEqual([
      { src: 'a.jpg', alt: { 'zh-CN': '现场', en: 'Live' } },
      { src: 'b.jpg', alt: { 'zh-CN': '' } }
    ])
  })

  it('songlist 映射为 { name, link }', () => {
    const songlist: SongRow[] = [
      { concert_id: 1, seq: 1, i18n: T({ 'zh-CN': '为爱而生', en: 'Born to Love' }), link: 'https://example.com' },
      { concert_id: 1, seq: 2, i18n: T({ 'zh-CN': '温柔', en: 'Tenderness' }), link: null }
    ]
    const result = mapConcert(buildRow(), [], [], songlist)
    expect(result.songlist).toEqual([
      { name: { 'zh-CN': '为爱而生', en: 'Born to Love' }, link: 'https://example.com' },
      { name: { 'zh-CN': '温柔', en: 'Tenderness' }, link: null }
    ])
  })

  it('保留 id / date / time / poster 等非翻译字段', () => {
    const result = mapConcert(buildRow(), [], [], [])
    expect(result.id).toBe(1)
    expect(result.date).toBe('2016.09.03')
    expect(result.time).toBe('19:30')
    expect(result.poster).toBe('img/concert/20160903-mayday.jpg')
  })

  it('点赞默认值：mapConcert 输出 likes=0 / liked=false，由接口层用 concert_likes 覆盖', () => {
    const result = mapConcert(buildRow(), [], [], [])
    expect(result.likes).toBe(0)
    expect(result.liked).toBe(false)
  })
})

describe('fetchAllConcerts — 批量查询后内存 groupBy 装配', () => {
  it('无数据时返回空数组', async () => {
    const client = stubClient({ concerts: [] })
    expect(await fetchAllConcerts(client)).toEqual([])
  })

  it('按 concert_id 将 tags/images/songlist 装配到各场演唱会', async () => {
    const rows = [buildRow({ id: 1 }), buildRow({ id: 2, artist_i18n: T({ 'zh-CN': '告五人', en: 'Accusefive' }) })]
    const client = stubClient({
      concerts: rows,
      tags: [{ concert_id: 1, i18n: A({ 'zh-CN': ['摇滚'], en: ['Rock'] }) }],
      images: [{ concert_id: 1, url: 'a.jpg', alt_i18n: T({ 'zh-CN': '现场', en: 'Live' }) }],
      songlist: [{ concert_id: 1, seq: 1, i18n: T({ 'zh-CN': '温柔', en: 'Tenderness' }), link: null }]
    })

    const result = await fetchAllConcerts(client)

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe(1)
    expect(result[0].tags['zh-CN']).toEqual(['摇滚'])
    expect(result[0].images).toEqual([{ src: 'a.jpg', alt: { 'zh-CN': '现场', en: 'Live' } }])
    expect(result[0].songlist).toHaveLength(1)

    // 第 2 场无关联数据 → 空数组，不串场
    expect(result[1].id).toBe(2)
    expect(result[1].artist['zh-CN']).toBe('告五人')
    expect(result[1].tags['zh-CN']).toEqual([])
    expect(result[1].images).toEqual([])
    expect(result[1].songlist).toEqual([])
  })
})
