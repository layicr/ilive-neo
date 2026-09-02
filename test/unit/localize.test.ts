import { describe, it, expect } from 'vitest'
import { pickText, localizeConcert } from '../../app/composables/useData'
import type { BilingualConcert } from '../../app/types'

/** 构造双语演唱会 · Build a bilingual concert fixture */
function buildBilingualConcert(overrides: Partial<BilingualConcert> = {}): BilingualConcert {
  return {
    id: 1,
    artist: { zh: '五月天', en: 'Mayday' },
    concertName: { zh: 'Just Rock It 2016', en: 'Just Rock It 2016' },
    theme: { zh: '演唱会', en: 'Concert' },
    location: { zh: '中国 · 陕西 · 西安 · 陕西省体育场', en: 'China · Shaanxi · Xi\'an · Shaanxi Provincial Stadium' },
    locationDetail: {
      country: { zh: '中国', en: 'China' },
      province: { zh: '陕西', en: 'Shaanxi' },
      city: { zh: '西安', en: "Xi'an" },
      venue: { zh: '陕西省体育场', en: 'Shaanxi Provincial Stadium' }
    },
    seat: { zh: 'VIP 1排', en: 'VIP Row 1' },
    price: { zh: '¥1555', en: '¥1555' },
    date: '2016.09.03',
    time: '19:30',
    poster: 'img/poster.jpg',
    tags: { zh: ['摇滚'], en: ['Rock'] },
    description: { zh: '五月天演唱会', en: 'Mayday concert' },
    images: [{ src: 'a.jpg', alt: { zh: '现场', en: 'Live' } }],
    video: { zh: '视频', en: 'Video' },
    videoUrl: { zh: 'v.mp4', en: 'v.mp4' },
    songlist: [
      { zh: '为爱而生', en: 'Born to Love', link: 'https://example.com' },
      { zh: '温柔', en: 'Tenderness', link: null }
    ],
    ...overrides
  }
}

describe('pickText — 双语文本取单语言', () => {
  it('zh 模式取 zh 字段', () => {
    expect(pickText({ zh: '五月天', en: 'Mayday' }, 'zh')).toBe('五月天')
  })

  it('en 模式取 en 字段', () => {
    expect(pickText({ zh: '五月天', en: 'Mayday' }, 'en')).toBe('Mayday')
  })

  it('目标语言字段为 null/undefined 时回退到另一语言', () => {
    // ?? 只对 null/undefined 回退；空串 '' 不触发回退（保持实际行为）
    expect(pickText({ zh: null, en: 'Mayday' } as any, 'zh')).toBe('Mayday')
    expect(pickText({ zh: '五月天', en: null } as any, 'en')).toBe('五月天')
  })

  it('null / undefined 返回空串', () => {
    expect(pickText(null, 'zh')).toBe('')
    expect(pickText(undefined, 'en')).toBe('')
  })
})

describe('localizeConcert — 双语演唱会本地化为单语言', () => {
  it('zh 模式输出中文 field 集（含 location 拼接）', () => {
    const c = localizeConcert(buildBilingualConcert(), 'zh')
    expect(c.artist).toBe('五月天')
    expect(c.concertName).toBe('Just Rock It 2016')
    expect(c.location).toBe('中国 · 陕西 · 西安 · 陕西省体育场')
    expect(c.tags).toEqual(['摇滚'])
  })

  it('en 模式输出英文字段集', () => {
    const c = localizeConcert(buildBilingualConcert(), 'en')
    expect(c.artist).toBe('Mayday')
    expect(c.location).toBe('China · Shaanxi · Xi\'an · Shaanxi Provincial Stadium')
    expect(c.tags).toEqual(['Rock'])
  })

  it('seat/price/video 为空时输出 null', () => {
    const c = localizeConcert(
      buildBilingualConcert({ seat: null, price: null, video: null, videoUrl: null }),
      'zh'
    )
    expect(c.seat).toBe(null)
    expect(c.price).toBe(null)
    expect(c.video).toBe(null)
    expect(c.videoUrl).toBe(null)
  })

  it('images 的 alt 本地化', () => {
    const c = localizeConcert(buildBilingualConcert(), 'en')
    expect(c.images).toEqual([{ src: 'a.jpg', alt: 'Live' }])
  })

  it('songlist 转为 { name, link }，zh 取 s.zh、en 取 s.en', () => {
    const zh = localizeConcert(buildBilingualConcert(), 'zh')
    expect(zh.songlist).toEqual([
      { name: '为爱而生', link: 'https://example.com' },
      { name: '温柔', link: null }
    ])
    const en = localizeConcert(buildBilingualConcert(), 'en')
    expect(en.songlist[0]).toEqual({ name: 'Born to Love', link: 'https://example.com' })
  })

  it('songlist 单语言缺失时回退', () => {
    const c = localizeConcert(
      buildBilingualConcert({ songlist: [{ zh: '温柔', en: '', link: null }] }),
      'en'
    )
    expect(c.songlist[0].name).toBe('温柔')
  })

  it('保留 id/date/time/poster 等非双语字段', () => {
    const c = localizeConcert(buildBilingualConcert(), 'zh')
    expect(c.id).toBe(1)
    expect(c.date).toBe('2016.09.03')
    expect(c.time).toBe('19:30')
    expect(c.poster).toBe('img/poster.jpg')
  })
})
