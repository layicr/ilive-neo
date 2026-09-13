/**
 * 多语言 / SEO 单元测试 · i18n & SEO unit tests
 *
 * @description 覆盖 i18n-handoff.md 的 P1-3 / P1-4 / P1-5 / P1-6 / P2-8 验收点：
 *  · 从 nuxt.config.ts 断言 locale 配置（3 语言、BCP-47 lang、默认语言与路由策略）
 *  · 断言全站 head 已完成「语言相关元信息」清理，且 PWA / 构建相关改动未被回退
 *  · 断言 ~/utils/seo 的 hreflang / og:locale / 多语言描述构造逻辑（纯函数，真实执行）
 *  · 源码级回归：app.vue 输出 htmlAttrs.lang 与 og:locale，index.vue 复用 buildHreflangLinks
 *
 *  说明：Nuxt 运行时（useHead / useI18n）无法在 node 环境直接单测，
 *        故把 SSR head 的「可验证部分」下沉为 ~/utils/seo 纯函数后在此断言；
 *        真实 SSR 输出另由项目根的 verify-seo.mjs 对 dev/prod server 校验。
 *
 *              Covers i18n-handoff.md items P1-3/P1-4/P1-5/P1-6/P2-8: asserts the locale config in
 *              nuxt.config.ts (3 locales, BCP-47 lang, default locale & routing strategy); that the site
 *              head's locale-aware meta cleanup is in place (PWA/build changes not reverted); the hreflang /
 *              og:locale / localized-description logic in ~/utils/seo (pure functions, actually executed);
 *              and source-level regressions (app.vue emits htmlAttrs.lang & og:locale, index.vue reuses
 *              buildHreflangLinks). Nuxt runtime (useHead/useI18n) can't run in node, so the verifiable
 *              parts are extracted into ~/utils/seo pure functions; real SSR output is checked by verify-seo.mjs.
 */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  ARTIST_DELIMITER,
  DEFAULT_SITE_URL,
  DESCRIPTION_TEMPLATES,
  LOCALE_LANG,
  SEO_LOCALES,
  buildHreflangLinks,
  buildSiteDescription,
  hreflangKey,
  toLocaleUrl,
  toOgLocale
} from '~/utils/seo'

// ==================== nuxt.config 载入（node 环境桩）· Load nuxt.config ====================

/** nuxt.config.ts 依赖 Nuxt 注入的全局函数，测试中提供透传桩 · stub for defineNuxtConfig */
;(globalThis as Record<string, unknown>).defineNuxtConfig = (config: unknown) => config

/** 从 nuxt.config 导入的配置形状（仅声明本测试用到的字段）· shape used by this test */
interface NuxtishConfig {
  i18n: {
    locales: { code: string; name: string; file: string; lang: string }[]
    defaultLocale: string
    strategy: string
    fallbackLocale: string
    langDir: string
  }
  app: {
    head: {
      title?: string
      meta: { name?: string; property?: string; content?: string }[]
      link: { rel: string; href: string }[]
    }
  }
  pwa: {
    manifest: Record<string, unknown>
    workbox: { navigateFallback: unknown }
  }
  experimental: { entryImportMap: boolean }
  runtimeConfig: { public: { siteUrl: string } }
}

const nuxtConfig = (await import('../../nuxt.config')).default as unknown as NuxtishConfig

/**
 * 生效的站点地址 · effective site URL
 * @description 站点地址属「部署维度」，已从不进数据库的代码常量迁移到
 *              `runtimeConfig.public.siteUrl`（环境变量 `NUXT_PUBLIC_SITE_URL` 覆盖）。
 *              这里读取 config 求值结果，保证与实际运行时一致。
 */
const SITE_URL = nuxtConfig.runtimeConfig.public.siteUrl

/** 匹配汉字（用于回归保护：静态 head 不应含中文）· CJK ideographs */
const CJK_RE = /[\u3400-\u4DBF\u4E00-\u9FFF]/

// ==================== i18n 配置 · i18n configuration ====================

describe('i18n 配置（nuxt.config）', () => {
  it('包含 3 个 locale，code 与顺序符合预期', () => {
    expect(nuxtConfig.i18n.locales.map((l) => l.code)).toEqual(['zh-CN', 'en', 'zh-Hant'])
  })

  it('每个 locale 均声明 BCP-47 lang，且与 ~/utils/seo 的 LOCALE_LANG 完全一致', () => {
    for (const locale of nuxtConfig.i18n.locales) {
      expect(locale.lang, `${locale.code} 缺少 lang`).toBeTruthy()
      expect(LOCALE_LANG[locale.code as keyof typeof LOCALE_LANG]).toBe(locale.lang)
    }
    // 中文必须映射为 zh-CN（历史问题是 code `zh` 直接当 lang 用）
    expect(LOCALE_LANG['zh-CN']).toBe('zh-CN')
  })

  it('SEO_LOCALES 与配置中的 locale code 列表一致', () => {
    expect([...SEO_LOCALES]).toEqual(nuxtConfig.i18n.locales.map((l) => l.code))
  })

  it('默认语言 / 路由策略 / 回退语言配置正确', () => {
    expect(nuxtConfig.i18n.defaultLocale).toBe('zh-CN')
    expect(nuxtConfig.i18n.strategy).toBe('prefix_except_default')
    expect(nuxtConfig.i18n.fallbackLocale).toBe('zh-CN')
    expect(nuxtConfig.i18n.langDir).toBe('locales/')
  })
})

// ==================== 全站 head / PWA（P1-4、P2-8 回归）====================

describe('全站 head 与 PWA 配置（P1-4 / P2-8 回归）', () => {
  const meta = () => nuxtConfig.app.head.meta

  it('app.head 不再包含随语言变化的 title / keywords / description / og / twitter 文案项', () => {
    expect(nuxtConfig.app.head.title).toBeUndefined()
    expect(meta().some((m) => m.name === 'description')).toBe(false)
    expect(meta().some((m) => m.name === 'keywords')).toBe(false)
    expect(meta().some((m) => m.property === 'og:title')).toBe(false)
    expect(meta().some((m) => m.property === 'og:description')).toBe(false)
    expect(meta().some((m) => m.property === 'og:site_name')).toBe(false)
    expect(meta().some((m) => m.name === 'twitter:title')).toBe(false)
    expect(meta().some((m) => m.name === 'twitter:description')).toBe(false)
  })

  it('app.head 保留与语言无关的静态元信息', () => {
    expect(meta().some((m) => m.property === 'og:type' && m.content === 'website')).toBe(true)
    expect(meta().some((m) => m.property === 'og:image')).toBe(true)
    expect(meta().some((m) => m.property === 'og:url' && m.content === SITE_URL)).toBe(true)
    expect(meta().some((m) => m.name === 'robots')).toBe(true)
    expect(meta().some((m) => m.name === 'twitter:card')).toBe(true)
    // canonical 不再由静态 head 输出（原先所有语言页共用同一个根域名 canonical），
    // 已改为 app/app.vue 按当前 locale 输出 —— 见 SEO_DB_MIGRATION.md 第七节。
    expect(nuxtConfig.app.head.link.some((l) => l.rel === 'canonical')).toBe(false)
  })

  it('app.head 静态 meta 全部与语言无关（不含中文）', () => {
    for (const m of meta()) {
      expect(CJK_RE.test(m.content ?? ''), `${m.name ?? m.property} 含中文：${m.content}`).toBe(false)
    }
  })

  it('PWA manifest 使用与语言无关的品牌名', () => {
    const manifest = nuxtConfig.pwa.manifest
    expect(manifest.name).toBe('Layicr Concert Journey')
    expect(manifest.short_name).toBe('Layicr')
    expect(CJK_RE.test(String(manifest.name))).toBe(false)
    expect(CJK_RE.test(String(manifest.short_name))).toBe(false)
    // start_url / display 等安装所需字段保持可用
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
  })

  it('上一轮的 PWA / 构建相关改动保持不变', () => {
    expect(nuxtConfig.pwa.workbox.navigateFallback).toBeNull()
    expect(nuxtConfig.experimental.entryImportMap).toBe(false)
    const hrefs = nuxtConfig.app.head.link.map((l) => l.href)
    expect(hrefs).toContain('/img/logo.jpg')
    expect(hrefs).toContain('/css/main.css')
  })
})

// ==================== hreflang / og:locale 工具 · SEO helpers ====================

describe('hreflang 与 og:locale 工具（~/utils/seo）', () => {
  it('buildHreflangLinks 输出 3 个语言 + x-default', () => {
    const links = buildHreflangLinks()
    expect(links).toHaveLength(4)
    expect(links.map((l) => l.hreflang)).toEqual(['zh-CN', 'en', 'zh-Hant', 'x-default'])
  })

  it('hreflang 与站点 URL 对应，默认语言无前缀', () => {
    const byHreflang = Object.fromEntries(buildHreflangLinks().map((l) => [l.hreflang, l.href]))
    expect(byHreflang['zh-CN']).toBe(`${SITE_URL}/`)
    expect(byHreflang['en']).toBe(`${SITE_URL}/en`)
    expect(byHreflang['zh-Hant']).toBe(`${SITE_URL}/zh-Hant`)
    // x-default 指向默认语言（中文）首页
    expect(byHreflang['x-default']).toBe(`${SITE_URL}/`)
  })

  it('hreflang link 使用唯一且稳定的去重 key', () => {
    const links = buildHreflangLinks()
    const keys = links.map((l) => l.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(links.every((l) => l.rel === 'alternate')).toBe(true)
    expect(hreflangKey('en')).toBe('i18n-hreflang-en')
    expect(keys).toContain('i18n-hreflang-x-default')
  })

  it('支持按传入的 locale 列表裁剪（便于页面按需输出）', () => {
    const links = buildHreflangLinks(['zh-CN', 'en'])
    expect(links.map((l) => l.hreflang)).toEqual(['zh-CN', 'en', 'x-default'])
  })

  it('toOgLocale 将 BCP-47 转为下划线格式', () => {
    expect(toOgLocale('zh-CN')).toBe('zh_CN')
    expect(toOgLocale('zh-Hant')).toBe('zh_Hant')
    expect(toOgLocale('en')).toBe('en')
  })

  it('每个语言都能得到合法的 og:locale', () => {
    const ogLocales = SEO_LOCALES.map((code) => toOgLocale(LOCALE_LANG[code]))
    expect(ogLocales).toEqual(['zh_CN', 'en', 'zh_Hant'])
    expect(new Set(ogLocales).size).toBe(ogLocales.length)
  })

  it('toLocaleUrl 处理默认语言与带前缀语言', () => {
    expect(toLocaleUrl('zh-CN')).toBe(`${SITE_URL}/`)
    expect(toLocaleUrl('zh-Hant')).toBe(`${SITE_URL}/zh-Hant`)
    expect(toLocaleUrl('en', 'https://example.com')).toBe('https://example.com/en')
  })
})

// ==================== 多语言站点描述（P1-6）====================

describe('多语言站点描述（P1-6）', () => {
  it('三种语言均有独立描述文案，且互不相同', () => {
    const texts = SEO_LOCALES.map((code) => buildSiteDescription(code, ''))
    expect(texts.every((t) => t.length > 0)).toBe(true)
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('无艺人时返回备用文案，且不残留占位符', () => {
    for (const code of SEO_LOCALES) {
      const text = buildSiteDescription(code, '')
      expect(text).toBe(DESCRIPTION_TEMPLATES[code].withoutArtists)
      expect(text).not.toContain('{artists}')
    }
  })

  it('有艺人时插入当前语言艺人串', () => {
    const zh = buildSiteDescription('zh-CN', '周杰伦、五月天')
    expect(zh).toContain('周杰伦、五月天')
    expect(zh).not.toContain('{artists}')

    const en = buildSiteDescription('en', 'Jay Chou, Mayday')
    expect(en).toContain('Jay Chou, Mayday')
    expect(en).not.toContain('{artists}')
  })

  it('繁体与简体文案不同（避免繁简混用）', () => {
    expect(buildSiteDescription('zh-Hant', '')).not.toBe(buildSiteDescription('zh-CN', ''))
  })

  it('描述模板 / 艺人分隔符覆盖全部语言', () => {
    for (const code of SEO_LOCALES) {
      expect(DESCRIPTION_TEMPLATES[code]).toBeTruthy()
      expect(ARTIST_DELIMITER[code]).toBeTruthy()
    }
    // 中文、繁体用顿号，英文用逗号+空格
    expect(ARTIST_DELIMITER['zh-CN']).toBe('、')
    expect(ARTIST_DELIMITER['zh-Hant']).toBe('、')
    expect(ARTIST_DELIMITER.en).toBe(', ')
  })
})

// ==================== SSR head 组装（源码级回归）====================

describe('SSR head 组装（P1-3 / P1-5 源码回归）', () => {
  const read = (relative: string) =>
    readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

  it('app.vue 输出 htmlAttrs.lang 与 og:locale，并复用 buildHreflangLinks', () => {
    const source = read('../../app/app.vue')
    expect(source).toContain('htmlAttrs')
    expect(source).toContain("property: 'og:locale'")
    expect(source).toContain("property: 'og:locale:alternate'")
    expect(source).toContain('buildHreflangLinks')
    expect(source).toContain('useHead')
  })

  it('index.vue 复用 buildHreflangLinks，不再只输出单条 zh-CN hreflang', () => {
    const source = read('../../app/pages/index.vue')
    expect(source).toContain('buildHreflangLinks')
    expect(source).toContain('buildSiteDescription')
    expect(source).not.toMatch(/hreflang:\s*'zh-CN'/)
  })

  it('canonical 由 app.vue 按 locale 输出（复用 toLocaleUrl），站点地址来自 runtimeConfig', () => {
    const source = read('../../app/app.vue')
    expect(source).toContain("rel: 'canonical'")
    expect(source).toContain('toLocaleUrl(current, siteUrl.value)')
    expect(source).toContain('resolveSiteUrl')
    // 站点地址不再由 ~/utils/seo 导出常量提供（属部署维度，不进 DB）
    expect(DEFAULT_SITE_URL).toBe('https://ilive.lyc.la')
    expect(toLocaleUrl('zh-CN', SITE_URL)).toBe(`${SITE_URL}/`)
    expect(toLocaleUrl('en', SITE_URL)).toBe(`${SITE_URL}/en`)
  })

  it('index.vue 的 SEO 文案改为 DB 优先 + 代码级回退（不存在空 title/description）', () => {
    const source = read('../../app/pages/index.vue')
    expect(source).toContain('useData')
    expect(source).toContain('seoCopy')
    expect(source).toContain('site_title')
    expect(source).toContain('site_description')
    expect(source).toContain('buildSiteDescription')
    expect(source).toContain('resolveSiteUrl')
  })
})
