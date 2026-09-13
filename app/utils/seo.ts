/**
 * SEO 工具（多语言）· Locale-aware SEO helpers
 *
 * @module utils/seo
 * @description 纯函数与常量，供 app/app.vue（htmlAttrs.lang / hreflang / og:locale）与
 *              app/pages/index.vue（动态描述、hreflang）复用；不依赖 Nuxt 运行时，
 *              因此可被 vitest 直接单测（见 test/unit/i18n.test.ts）。
 *
 *              app.vue 与 index.vue 生成 hreflang link 时使用同一组去重 key，
 *              由 unhead 合并为唯一一条，避免同一 hreflang 重复输出。
 */

import type { Locale } from '../types'
import { ARTIST_DELIMITER, DEFAULT_LOCALE, LOCALE_LANG, LOCALES } from '../../server/lib/locales'

/**
 * 站点地址的代码级兜底值 · Last-resort site URL
 * @description 优先级链：DB site_settings.site_url（运营可改）→ runtimeConfig.public.siteUrl
 *              （环境变量 NUXT_PUBLIC_SITE_URL）→ 此常量。换域名优先改 DB / 环境变量，
 *              尽量避免直接改源码。
 */
export const DEFAULT_SITE_URL = 'https://ilive.lyc.la'

/**
 * 解析实际生效的站点地址（去掉尾部斜杠）· Resolve the effective site URL
 * @param configured runtimeConfig.public.siteUrl 的取值 · value from runtimeConfig.public.siteUrl
 */
export function resolveSiteUrl(configured?: string | null): string {
  const value = typeof configured === 'string' ? configured.trim() : ''
  return (value || DEFAULT_SITE_URL).replace(/\/+$/, '')
}

/**
 * 图片路径 → 绝对 URL（og:image / twitter:image 用）· Relative image path → absolute URL
 * @param image   已是 http(s) 绝对 URL 时原样返回；以 `/` 开头（或无前导斜杠）的站点相对路径拼到 siteUrl 后
 * @param siteUrl 生效的站点地址 · effective site URL
 */
export function toAbsoluteImageUrl(image: string, siteUrl: string = DEFAULT_SITE_URL): string {
  const path = (image ?? '').trim()
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  const base = resolveSiteUrl(siteUrl)
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

/** 语言顺序（hreflang 输出顺序）· Locale order（源自 server/lib/locales 单一真源） */
export const SEO_LOCALES: readonly Locale[] = LOCALES

/** locale → BCP-47 标签 · Locale → BCP-47 tag（单一真源，与 nuxt.config i18n.locales[].lang 同源） */
export { LOCALE_LANG, ARTIST_DELIMITER }

/** BCP-47 → Open Graph locale（下划线分隔，如 zh-CN → zh_CN）· OG locale format */
export function toOgLocale(lang: string): string {
  return lang.replace('-', '_')
}

/** locale → 站点绝对 URL（默认语言无前缀）· Absolute URL per locale */
export function toLocaleUrl(code: string, siteUrl: string = DEFAULT_SITE_URL): string {
  return code === DEFAULT_LOCALE ? `${siteUrl}/` : `${siteUrl}/${code}`
}

/**
 * hreflang link 的稳定去重 key · Stable dedupe key for hreflang links
 * @description app/app.vue 与 app/pages/index.vue 输出同名 key，unhead 会合并去重。
 */
export function hreflangKey(hreflang: string): string {
  return `i18n-hreflang-${hreflang}`
}

/** hreflang link 结构 · hreflang link shape */
export interface HreflangLink {
  rel: 'alternate'
  hreflang: string
  href: string
  key: string
}

/**
 * 构建 hreflang link 列表（默认 3 语言 + x-default）· Build hreflang links
 * @param codes   参与输出的 locale code 列表 · locale codes to output
 * @param siteUrl 站点地址（便于测试注入）· site URL (injectable for tests)
 */
export function buildHreflangLinks(
  codes: readonly string[] = SEO_LOCALES,
  siteUrl: string = DEFAULT_SITE_URL
): HreflangLink[] {
  return [
    ...codes.map((code) => {
      const hreflang = LOCALE_LANG[code as Locale] ?? code
      return {
        rel: 'alternate' as const,
        hreflang,
        href: toLocaleUrl(code, siteUrl),
        key: hreflangKey(hreflang)
      }
    }),
    {
      rel: 'alternate' as const,
      hreflang: 'x-default',
      href: `${siteUrl}/`,
      key: hreflangKey('x-default')
    }
  ]
}

/** 各语言的站点描述模板（`{artists}` 为艺人串占位符）· Description templates per locale */
export const DESCRIPTION_TEMPLATES: Record<Locale, { withArtists: string; withoutArtists: string }> = {
  'zh-CN': {
    withArtists: 'Layicr的个人演唱会足迹记录网站，记录观看{artists}等歌手演唱会的美好回忆。',
    withoutArtists: 'Layicr的个人演唱会足迹记录网站。'
  },
  en: {
    withArtists:
      "Layicr's personal concert journey site, documenting memories of watching concerts by {artists} and more.",
    withoutArtists: "Layicr's personal concert journey site."
  },
  'zh-Hant': {
    withArtists: 'Layicr 的個人演唱會足跡記錄網站，記錄觀看{artists}等歌手演唱會的美好回憶。',
    withoutArtists: 'Layicr 的個人演唱會足跡記錄網站。'
  }
}

/**
 * 构建站点描述（有艺人时插入艺人串）· Build locale-aware site description
 * @param locale     当前语言 · current locale
 * @param artistList 当前语言下的艺人串（空串表示无艺人）· artists joined text
 */
export function buildSiteDescription(locale: Locale, artistList: string): string {
  const tpl = DESCRIPTION_TEMPLATES[locale] ?? DESCRIPTION_TEMPLATES[DEFAULT_LOCALE]
  return artistList ? tpl.withArtists.replace('{artists}', artistList) : tpl.withoutArtists
}
