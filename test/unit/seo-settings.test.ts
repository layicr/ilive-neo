/**
 * 站点 SEO 设置单元测试 · Unit tests for site-level SEO settings
 *
 * @description 覆盖 SEO 参数数据库化（见 doc/SEO_DB_MIGRATION.md）的三条关键链路：
 *              1. `fetchSiteSeo` 的「DB 优先 + 逐字段代码级回退」——空库 / 字段为空 / 查询失败均不返回空文案；
 *              2. 多语言取值——3 语言各自取到 DB 文案，缺语言时按 pickLocale 回退链兜底；
 *              3. 空 DB 场景——DB 无值时不出现空 title / description（回退到 message 组合与描述模板）。
 *              另覆盖「部署维度」的站点地址解析与 canonical 语言前缀（不进 DB，由 runtimeConfig 提供）。
 *
 *              全部使用最小 client 桩，不连真实数据库。
 *
 *              Covers the three key chains of the SEO-params-in-DB migration: (1) fetchSiteSeo's
 *              DB-first + per-field code fallback (never empty copy for empty DB / empty field / failed
 *              query); (2) multi-locale resolution (3 locales resolve their DB copy, missing → pickLocale
 *              fallback chain); (3) empty-DB case (no empty title/description). Also covers deployment-level
 *              site-URL resolution and canonical language prefix. All use a minimal client stub, no real DB.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Client } from '@libsql/client'
import { fetchSiteSeo, SEO_FALLBACK } from '../../server/lib/mappers'
import { pickLocale, LOCALES } from '../../app/utils'
import { DEFAULT_SITE_URL, resolveSiteUrl, toAbsoluteImageUrl, toLocaleUrl, buildSiteDescription } from '../../app/utils/seo'
import type { Locale } from '../../app/types'

/** 序列化多语言 JSON 列 · Serialize a localized JSON column */
const T = (obj: Record<string, string>) => JSON.stringify(obj)

/**
 * 最小 LibSQL client 桩（按 SQL 文本路由到内存数据）· Minimal LibSQL client stub
 * @param settings site_settings 查询返回的行 · rows for site_settings
 * @param seo      site_seo_i18n 查询返回的行 · rows for site_seo_i18n
 * @param failAll  true 时所有查询抛错，模拟「表不存在 / DB 不可用」
 */
function stubSeoClient(opts: {
  settings?: Record<string, unknown>[]
  seo?: Record<string, unknown>[]
  failAll?: boolean
} = {}): Client {
  return {
    execute: async (q: unknown) => {
      if (opts.failAll) throw new Error('no such table: site_settings')
      const sql = typeof q === 'string' ? q : String((q as { sql: string }).sql)
      if (sql.includes('FROM site_settings')) return { rows: opts.settings ?? [] }
      if (sql.includes('FROM site_seo_i18n')) return { rows: opts.seo ?? [] }
      return { rows: [] }
    }
  } as unknown as Client
}

/** 一份"库里有值"的站点设置行 · a populated site_settings row */
const SEED_SETTINGS_ROW = {
  og_image: '/img/og-image.svg',
  twitter_site: '@layicr',
  twitter_creator: '@layicr',
  author: 'layicr',
  robots: 'index, follow',
  site_url: 'https://ilive.lyc.la'
}

/** 一份"库里有值"的 3 语言 SEO 文案行 · populated site_seo_i18n rows */
const SEED_SEO_ROWS = [
  { key: 'site_title', value_i18n: T({ 'zh-CN': 'Layicr演唱会足迹', en: 'Layicr Concert Journey', 'zh-Hant': 'Layicr演唱會足跡' }) },
  { key: 'site_description', value_i18n: T({ 'zh-CN': 'Layicr的个人演唱会足迹记录网站。', en: "Layicr's personal concert journey site.", 'zh-Hant': 'Layicr 的個人演唱會足跡記錄網站。' }) },
  { key: 'keywords', value_i18n: T({ 'zh-CN': '演唱会足迹,演唱会记录', en: 'concert journey,concert record', 'zh-Hant': '演唱會足跡,演唱會記錄' }) }
]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchSiteSeo — DB 优先', () => {
  it('库中有值时按字段取回，并返回 3 语言文案', async () => {
    const client = stubSeoClient({ settings: [SEED_SETTINGS_ROW], seo: SEED_SEO_ROWS })
    const seo = await fetchSiteSeo(client)

    expect(seo.ogImage).toBe('/img/og-image.svg')
    expect(seo.twitterSite).toBe('@layicr')
    expect(seo.twitterCreator).toBe('@layicr')
    expect(seo.author).toBe('layicr')
    expect(seo.robots).toBe('index, follow')
    expect(Object.keys(seo.i18n).sort()).toEqual(['keywords', 'site_description', 'site_title'])
    expect(seo.i18n.site_title?.en).toBe('Layicr Concert Journey')
  })

  it('运营改写后的值优先于代码默认值（不覆盖、不回退）', async () => {
    const client = stubSeoClient({
      settings: [{ ...SEED_SETTINGS_ROW, og_image: 'https://cdn.example.com/og.png', robots: 'noindex, nofollow' }],
      seo: [{ key: 'site_title', value_i18n: T({ 'zh-CN': '新标题' }) }]
    })
    const seo = await fetchSiteSeo(client)

    expect(seo.ogImage).toBe('https://cdn.example.com/og.png')
    expect(seo.robots).toBe('noindex, nofollow')
    expect(seo.i18n.site_title?.['zh-CN']).toBe('新标题')
    // 未在库中的键不凭空生成
    expect(seo.i18n.site_description).toBeUndefined()
  })
})

describe('fetchSiteSeo — 代码级回退（关键：DB 挂了 SEO 不能为空）', () => {
  it('两表为空（未播种 / 清库）→ 全部字段回退默认值，i18n 为空对象', async () => {
    const seo = await fetchSiteSeo(stubSeoClient({ settings: [], seo: [] }))

    expect(seo).toEqual({ ...SEO_FALLBACK, i18n: {} })
    expect(seo.ogImage).toBe('/img/og-image.svg')
    expect(seo.twitterSite).toBe('@layicr')
    expect(seo.author).toBe('layicr')
    expect(seo.robots).toBe('index, follow')
    // 不为空字符串
    expect(Object.values(seo).filter((v) => typeof v === 'string')).not.toContain('')
  })

  it('单行缺失（site_settings 无数据行）→ 逐字段回退', async () => {
    const seo = await fetchSiteSeo(stubSeoClient({ settings: [], seo: SEED_SEO_ROWS }))

    expect(seo.ogImage).toBe(SEO_FALLBACK.ogImage)
    expect(seo.robots).toBe(SEO_FALLBACK.robots)
    // 文案仍来自 DB
    expect(seo.i18n.keywords?.['zh-Hant']).toBe('演唱會足跡,演唱會記錄')
  })

  it('字段为 null / 空串 / 空白串 → 逐字段回退（不返回空值）', async () => {
    const seo = await fetchSiteSeo(
      stubSeoClient({
        settings: [{ og_image: null, twitter_site: '', twitter_creator: '   ', author: 'layicr', robots: null }],
        seo: []
      })
    )

    expect(seo.ogImage).toBe(SEO_FALLBACK.ogImage)
    expect(seo.twitterSite).toBe(SEO_FALLBACK.twitterSite)
    expect(seo.twitterCreator).toBe(SEO_FALLBACK.twitterCreator)
    expect(seo.robots).toBe(SEO_FALLBACK.robots)
    expect(seo.author).toBe('layicr')
  })

  it('查询整体失败（表不存在 / DB 不可用）→ 返回完整默认对象且不抛错', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const seo = await fetchSiteSeo(stubSeoClient({ failAll: true }))

    expect(seo).toEqual({ ...SEO_FALLBACK, i18n: {} })
    expect(warn).toHaveBeenCalled()
  })

  it('未知 key 被忽略，非法 JSON 回退为空文案（不抛错）', async () => {
    const seo = await fetchSiteSeo(
      stubSeoClient({
        settings: [SEED_SETTINGS_ROW],
        seo: [
          { key: 'not_a_seo_key', value_i18n: T({ 'zh-CN': '忽略我' }) },
          { key: 'site_title', value_i18n: 'not-json' }
        ]
      })
    )

    expect(Object.keys(seo.i18n)).toEqual(['site_title'])
    expect(seo.i18n.site_title?.['zh-CN']).toBe('')
  })

  it('SEO_FALLBACK 与迁移前的硬编码默认值保持一致', () => {
    expect(SEO_FALLBACK).toEqual({
      ogImage: '/img/og-image.svg',
      twitterSite: '@layicr',
      twitterCreator: '@layicr',
      author: 'layicr',
      robots: 'index, follow',
      siteUrl: DEFAULT_SITE_URL,
      i18n: {}
    })
  })
})

describe('多语言取值 — 3 语言各自取到 DB 文案', () => {
  it('DB 有 3 语言时，各 locale 取到各自文案且互不相同', async () => {
    const seo = await fetchSiteSeo(stubSeoClient({ settings: [SEED_SETTINGS_ROW], seo: SEED_SEO_ROWS }))
    const title = seo.i18n.site_title
    const description = seo.i18n.site_description
    const keywords = seo.i18n.keywords

    expect(LOCALES).toEqual(['zh-CN', 'en', 'zh-Hant'])

    const titles = LOCALES.map((l) => pickLocale(title, l))
    const descriptions = LOCALES.map((l) => pickLocale(description, l))
    const keywordsList = LOCALES.map((l) => pickLocale(keywords, l))

    expect(titles.every((t) => t.trim() !== '')).toBe(true)
    expect(descriptions.every((d) => d.trim() !== '')).toBe(true)
    expect(keywordsList.every((k) => k.trim() !== '')).toBe(true)
    // 三种语言各不相同
    expect(new Set(titles).size).toBe(LOCALES.length)
    expect(new Set(descriptions).size).toBe(LOCALES.length)
    expect(new Set(keywordsList).size).toBe(LOCALES.length)

    expect(pickLocale(title, 'zh-CN')).toBe('Layicr演唱会足迹')
    expect(pickLocale(title, 'en')).toBe('Layicr Concert Journey')
    expect(pickLocale(title, 'zh-Hant')).toBe('Layicr演唱會足跡')
  })

  it('库中缺某语言时按 pickLocale 回退链兜底（不返回空）', async () => {
    const seo = await fetchSiteSeo(
      stubSeoClient({
        settings: [SEED_SETTINGS_ROW],
        seo: [{ key: 'site_description', value_i18n: T({ 'zh-CN': '只有中文描述' }) }]
      })
    )

    for (const l of LOCALES) {
      expect(pickLocale(seo.i18n.site_description, l)).toBe('只有中文描述')
    }
  })
})

describe('空 DB 场景 — 页面 SEO 不出现空 title / description', () => {
  it('空库时页面回退链仍产出非空文案（message 组合 + 描述模板）', async () => {
    const seo = await fetchSiteSeo(stubSeoClient({ settings: [], seo: [] }))

    // 页面逻辑：DB 取不到 → 回退 i18n message 组合 与 描述模板
    const pageTitleFromMessage = '演唱会足迹 - Layicr演唱会足迹'
    const title = pickLocale(seo.i18n.site_title, 'zh-CN') || pageTitleFromMessage
    expect(title.trim()).not.toBe('')
    expect(title).toBe(pageTitleFromMessage)

    // 描述回退到按语言模板（有 / 无艺人两种形态都不为空）
    const descWithArtists = pickLocale(seo.i18n.site_description, 'en') || buildSiteDescription('en', 'Mayday')
    const descWithoutArtists = pickLocale(seo.i18n.site_description, 'zh-Hant') || buildSiteDescription('zh-Hant', '')
    expect(descWithArtists.trim()).not.toBe('')
    expect(descWithoutArtists.trim()).not.toBe('')

    // 关键词回退：站点名 + 艺人 + 默认词，同样非空
    const keywords = pickLocale(seo.i18n.keywords, 'zh-CN') || ['Layicr', '演唱会足迹', '演唱会记录'].join(',')
    expect(keywords.trim()).not.toBe('')
  })

  it('3 语言描述模板回退均不为空', () => {
    for (const l of LOCALES) {
      expect(buildSiteDescription(l as Locale, '').trim()).not.toBe('')
      expect(buildSiteDescription(l as Locale, 'Mayday').trim()).not.toBe('')
    }
  })
})

describe('站点地址（DB site_url 优先 → env → 代码兜底）与 canonical 语言前缀', () => {
  it('fetchSiteSeo：DB 有 site_url 时返回该值', async () => {
    const client = stubSeoClient({ settings: [{ ...SEED_SETTINGS_ROW, site_url: 'https://custom.example.com' }], seo: SEED_SEO_ROWS })
    const seo = await fetchSiteSeo(client)
    expect(seo.siteUrl).toBe('https://custom.example.com')
  })

  it('fetchSiteSeo：DB site_url 为空时回退代码兜底域名', async () => {
    const client = stubSeoClient({ settings: [{ ...SEED_SETTINGS_ROW, site_url: '' }], seo: SEED_SEO_ROWS })
    const seo = await fetchSiteSeo(client)
    expect(seo.siteUrl).toBe(DEFAULT_SITE_URL)
  })

  it('fetchSiteSeo：缺行（空库）时回退代码兜底域名', async () => {
    const client = stubSeoClient({ settings: [], seo: [] })
    const seo = await fetchSiteSeo(client)
    expect(seo.siteUrl).toBe(DEFAULT_SITE_URL)
  })

  it('SEO_FALLBACK.siteUrl 等于代码兜底域名', () => {
    expect(SEO_FALLBACK.siteUrl).toBe(DEFAULT_SITE_URL)
  })

  it('resolveSiteUrl：未配置回退代码兜底，已配置去掉尾部斜杠', () => {
    expect(resolveSiteUrl(undefined)).toBe(DEFAULT_SITE_URL)
    expect(resolveSiteUrl(null)).toBe(DEFAULT_SITE_URL)
    expect(resolveSiteUrl('')).toBe(DEFAULT_SITE_URL)
    expect(resolveSiteUrl('   ')).toBe(DEFAULT_SITE_URL)
    expect(resolveSiteUrl('https://ilive.lyc.la/')).toBe('https://ilive.lyc.la')
    expect(resolveSiteUrl('https://ilive.lyc.la///')).toBe('https://ilive.lyc.la')
  })

  it('toLocaleUrl：默认语言无前缀，其余语言带前缀（canonical 修复核心）', () => {
    const site = 'https://ilive.lyc.la'
    expect(toLocaleUrl('zh-CN', site)).toBe('https://ilive.lyc.la/')
    expect(toLocaleUrl('en', site)).toBe('https://ilive.lyc.la/en')
    expect(toLocaleUrl('zh-Hant', site)).toBe('https://ilive.lyc.la/zh-Hant')
    // `/` 与 `/en` 的 canonical 必须不同
    expect(toLocaleUrl('zh-CN', site)).not.toBe(toLocaleUrl('en', site))
  })

  it('toAbsoluteImageUrl：DB 中的相对路径 / 绝对 URL 均可用', () => {
    const site = 'https://ilive.lyc.la'
    expect(toAbsoluteImageUrl('/img/og-image.svg', site)).toBe('https://ilive.lyc.la/img/og-image.svg')
    expect(toAbsoluteImageUrl('img/og-image.svg', site)).toBe('https://ilive.lyc.la/img/og-image.svg')
    expect(toAbsoluteImageUrl('https://cdn.example.com/og.png', site)).toBe('https://cdn.example.com/og.png')
    expect(toAbsoluteImageUrl('', site)).toBe('')
  })
})
