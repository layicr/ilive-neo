/**
 * 单元测试：app/utils/seo.ts — 多语言 SEO 纯函数
 *
 * @description 覆盖站点 URL 解析与兜底、图片绝对化、og:locale 转换、hreflang link 构建与去重 key、
 *              描述模板（含未知语言的兜底），并校验 LOCALE_LANG / ARTIST_DELIMITER 与
 *              server/lib/locales 单一真源一致（i18n.test.ts 只覆盖了一部分）。
 *
 *              Covers resolveSiteUrl / toAbsoluteImageUrl / toOgLocale / toLocaleUrl / hreflang
 *              builders / description templates and their fallbacks.
 */
import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SITE_URL,
  resolveSiteUrl,
  toAbsoluteImageUrl,
  toOgLocale,
  toLocaleUrl,
  hreflangKey,
  buildHreflangLinks,
  buildSiteDescription,
  DESCRIPTION_TEMPLATES,
  LOCALE_LANG,
  ARTIST_DELIMITER
} from '../../app/utils/seo'
import { LOCALE_LANG as SRC_LOCALE_LANG, LOCALES, ARTIST_DELIMITER as SRC_DELIMITER } from '../../server/lib/locales'

describe('resolveSiteUrl — 站点地址解析', () => {
  it('未配置 / 空串 / 纯空白 / 非字符串 → 代码级默认值', () => {
    expect(resolveSiteUrl(undefined)).toBe(DEFAULT_SITE_URL)
    expect(resolveSiteUrl(null)).toBe(DEFAULT_SITE_URL)
    expect(resolveSiteUrl('')).toBe(DEFAULT_SITE_URL)
    expect(resolveSiteUrl('   ')).toBe(DEFAULT_SITE_URL)
    expect(resolveSiteUrl(123 as unknown as string)).toBe(DEFAULT_SITE_URL)
  })

  it('配置值两端 trim 后使用', () => {
    expect(resolveSiteUrl('  https://example.com  ')).toBe('https://example.com')
  })

  it('去除尾部斜杠（含多个）', () => {
    expect(resolveSiteUrl('https://example.com/')).toBe('https://example.com')
    expect(resolveSiteUrl('https://example.com///')).toBe('https://example.com')
  })
})

describe('toAbsoluteImageUrl — 图片绝对化', () => {
  it('空值 → 空串', () => {
    expect(toAbsoluteImageUrl('')).toBe('')
    expect(toAbsoluteImageUrl('   ')).toBe('')
    expect(toAbsoluteImageUrl(undefined as unknown as string)).toBe('')
  })

  it('已是 http(s) 绝对 URL 时原样返回（含大小写 HTTP）', () => {
    expect(toAbsoluteImageUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
    expect(toAbsoluteImageUrl('HTTP://cdn.example.com/a.png')).toBe('HTTP://cdn.example.com/a.png')
  })

  it('站点相对路径（带前导斜杠）拼接站点地址', () => {
    expect(toAbsoluteImageUrl('/img/og-image.svg', 'https://site.test')).toBe('https://site.test/img/og-image.svg')
  })

  it('无前导斜杠的相对路径自动补斜杠', () => {
    expect(toAbsoluteImageUrl('img/og-image.svg', 'https://site.test')).toBe('https://site.test/img/og-image.svg')
  })

  it('siteUrl 带尾斜杠时不会出现双斜杠', () => {
    expect(toAbsoluteImageUrl('/img/a.png', 'https://site.test/')).toBe('https://site.test/img/a.png')
  })

  it('未传 siteUrl 时使用默认站点地址', () => {
    expect(toAbsoluteImageUrl('/img/a.png')).toBe(`${DEFAULT_SITE_URL}/img/a.png`)
  })

  it('路径两端空白被 trim', () => {
    expect(toAbsoluteImageUrl('  /img/a.png  ', 'https://site.test')).toBe('https://site.test/img/a.png')
  })
})

describe('toOgLocale / toLocaleUrl / hreflangKey', () => {
  it('BCP-47 → Open Graph 下划线格式', () => {
    expect(toOgLocale('zh-CN')).toBe('zh_CN')
    expect(toOgLocale('zh-Hant')).toBe('zh_Hant')
    expect(toOgLocale('en')).toBe('en')
  })

  it('默认语言无 URL 前缀，其余语言加前缀', () => {
    expect(toLocaleUrl('zh-CN', 'https://site.test')).toBe('https://site.test/')
    expect(toLocaleUrl('en', 'https://site.test')).toBe('https://site.test/en')
    expect(toLocaleUrl('zh-Hant', 'https://site.test')).toBe('https://site.test/zh-Hant')
  })

  it('hreflangKey 稳定且带语言后缀', () => {
    expect(hreflangKey('zh-CN')).toBe('i18n-hreflang-zh-CN')
    expect(hreflangKey('x-default')).toBe('i18n-hreflang-x-default')
  })
})

describe('buildHreflangLinks — hreflang link 列表', () => {
  it('默认输出 3 语言 + x-default，且 key 唯一（供 unhead 去重）', () => {
    const links = buildHreflangLinks(undefined, 'https://site.test')
    expect(links).toHaveLength(4)
    expect(links.map((l) => l.hreflang)).toEqual(['zh-CN', 'en', 'zh-Hant', 'x-default'])
    const keys = links.map((l) => l.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(links.every((l) => l.rel === 'alternate')).toBe(true)
  })

  it('href 与各语言 URL 对应，x-default 指向默认语言首页', () => {
    const links = buildHreflangLinks(undefined, 'https://site.test')
    expect(links.find((l) => l.hreflang === 'zh-CN')?.href).toBe('https://site.test/')
    expect(links.find((l) => l.hreflang === 'en')?.href).toBe('https://site.test/en')
    expect(links.find((l) => l.hreflang === 'x-default')?.href).toBe('https://site.test/')
  })

  it('可自定义语言子集', () => {
    const links = buildHreflangLinks(['en'], 'https://site.test')
    expect(links.map((l) => l.hreflang)).toEqual(['en', 'x-default'])
  })

  it('未知 locale code 直接作为 hreflang 输出（不抛错）', () => {
    const links = buildHreflangLinks(['ja'], 'https://site.test')
    expect(links[0].hreflang).toBe('ja')
    expect(links[0].href).toBe('https://site.test/ja')
  })
})

describe('buildSiteDescription — 站点描述模板', () => {
  it('有艺人串时插入占位符', () => {
    expect(buildSiteDescription('zh-CN', '林俊杰')).toContain('林俊杰')
    expect(buildSiteDescription('en', 'JJ Lin')).toContain('JJ Lin')
    expect(buildSiteDescription('zh-Hant', '林俊傑')).toContain('林俊傑')
  })

  it('艺人串为空时使用无艺人模板（不含占位符残留）', () => {
    for (const locale of LOCALES) {
      const text = buildSiteDescription(locale, '')
      expect(text).toBe(DESCRIPTION_TEMPLATES[locale].withoutArtists)
      expect(text).not.toContain('{artists}')
    }
  })

  it('未知语言回退默认语言模板', () => {
    expect(buildSiteDescription('ja' as never, '')).toBe(DESCRIPTION_TEMPLATES['zh-CN'].withoutArtists)
  })
})

describe('SEO 常量与 server/lib/locales 单一真源一致性', () => {
  it('LOCALE_LANG 与真源完全一致', () => {
    expect(LOCALE_LANG).toEqual(SRC_LOCALE_LANG)
  })

  it('ARTIST_DELIMITER 与真源完全一致', () => {
    expect(ARTIST_DELIMITER).toEqual(SRC_DELIMITER)
  })

  it('描述模板覆盖全部语言', () => {
    for (const l of LOCALES) {
      expect(DESCRIPTION_TEMPLATES[l]).toBeTruthy()
    }
  })
})
