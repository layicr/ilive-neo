/**
 * 站点级 SEO 类型 · Site-level SEO types
 * @module types/seo
 * @description 「内容/运营维度」的 SEO 参数，来自数据库（见 server/lib/mappers 的 fetchSiteSeo）。
 *              DB 缺表 / 为空 / 查询失败时由服务端逐字段回退到代码默认值，前端再按语言回退到 i18n message，
 *              保证任何情况下 title / description 都不为空。
 */

import type { LocalizedText } from './i18n'

/** SEO 多语言文案键（与 DB 表 site_seo_i18n.key 一一对应）· SEO copy keys */
export type SeoI18nKey = 'site_title' | 'site_description' | 'keywords'

export interface SiteSeoSettings {
  /** OG 图（绝对 URL 或以 `/` 开头的站点相对路径）· OG image URL or site-relative path */
  ogImage: string
  twitterSite: string
  twitterCreator: string
  author: string
  robots: string
  /** 站点正式地址（HTTPS）· canonical site URL
   *  @description 来自 site_settings.site_url（运营可在 DB 改）；缺失时回退
   *               runtimeConfig.public.siteUrl（环境变量 NUXT_PUBLIC_SITE_URL）→ 代码兜底。 */
  siteUrl: string
  /** 多语言文案（仅含 DB 中实际存在的键，缺失键由调用方回退）· per-locale copy from DB */
  i18n: Partial<Record<SeoI18nKey, LocalizedText>>
}
