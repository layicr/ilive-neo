/**
 * 语言单一真源 · Single source of truth for locales
 *
 * @module server/lib/locales
 * @description 全项目（nuxt.config / app / server）共用的语言定义。
 *
 *              重构前 locale 列表散落在 6+ 处，加语言必须同步改多处，极易遗漏：
 *                · nuxt.config i18n.locales（code/name/file/lang）
 *                · app/utils/seo SEO_LOCALES / LOCALE_LANG / ARTIST_DELIMITER
 *                · app/utils/index LOCALES（回退链）+ 内联 BCP-47 日期映射
 *                · server/lib/mappers LOCALES（多语言列遍历顺序）
 *                · app/composables/useI18n AppLocale（与 Locale 重复的联合类型）
 *                · app/pages/index.vue 语言切换器 langs
 *
 *              现统一收敛到本文件：新增语言只需在 LOCALE_DEFINITIONS 追加一项。
 *
 *              注意：本文件被 nuxt.config 与客户端代码共同引用，因此
 *                · 不得引入 Nuxt 运行时 / Nitro 专有依赖
 *                · 对 app/types 仅使用 `import type`（编译期擦除，不产生运行时跨端依赖）
 *
 *              Shared locale definitions for the whole project (nuxt.config / app / server).
 *              Previously scattered across 6+ places; now centralized here so adding a language only
 *              requires appending one entry to LOCALE_DEFINITIONS.
 *              Must not pull in Nuxt runtime / Nitro-only deps; only `import type` from app/types.
 */

import type { Locale } from '../../app/types'

/** 单个语言的定义 · One locale definition */
export interface LocaleDefinition {
  /** URL 前缀与 vue-i18n code（默认语言无前缀）· URL prefix & vue-i18n code */
  code: Locale
  /** 语言切换器显示名（母语）· Endonym shown in the switcher */
  name: string
  /** 切换器紧凑标签（部分语言与 name 不同，如 en → EN）· Compact switcher label */
  short: string
  /** message 文件名（相对 i18n.langDir）· message file name */
  file: string
  /** BCP-47 标签（html lang / hreflang / og:locale）· BCP-47 tag */
  lang: string
  /** toLocaleDateString 用的完整 BCP-47（含地区）· full BCP-47 for date formatting */
  dateLocale: string
  /** 艺人串分隔符 · artist list delimiter */
  delimiter: string
}

/** 默认语言（无 URL 前缀，也是回退基语言）· Default locale (no URL prefix, fallback base) */
export const DEFAULT_LOCALE: Locale = 'zh-CN'

/**
 * 语言定义（顺序 = 切换器 / hreflang / 回退链顺序）· Locale definitions, in order
 * @description `file` 必须与 i18n/langDir 下的 message 文件名一致；
 *              `lang` 必须与 app/utils/seo 输出的 hreflang/og:locale 一致（test/unit/i18n.test.ts 有断言）。
 */
export const LOCALE_DEFINITIONS: readonly LocaleDefinition[] = [
  { code: 'zh-CN', name: '中文', short: '中文', file: 'zh-CN.ts', lang: 'zh-CN', dateLocale: 'zh-CN', delimiter: '、' },
  { code: 'en', name: 'English', short: 'EN', file: 'en.ts', lang: 'en', dateLocale: 'en-US', delimiter: ', ' },
  { code: 'zh-Hant', name: '繁體', short: '繁體', file: 'zh-Hant.ts', lang: 'zh-Hant', dateLocale: 'zh-TW', delimiter: '、' }
]

/** locale code 列表 · locale codes, in order */
export const LOCALES: readonly Locale[] = LOCALE_DEFINITIONS.map((l) => l.code)

/** code → 定义（缺失时回退默认语言）· code → definition (falls back to default) */
const BY_CODE = new Map<string, LocaleDefinition>(LOCALE_DEFINITIONS.map((l) => [l.code, l]))

/** 按 code 取语言定义（缺失时回退默认语言）· Get a locale definition by code (falls back to default) */
export function localeDef(code: Locale): LocaleDefinition {
  return BY_CODE.get(code) ?? BY_CODE.get(DEFAULT_LOCALE)!
}

/** code → BCP-47（html lang / hreflang / og:locale）· code → BCP-47 tag */
export const LOCALE_LANG: Record<Locale, string> = Object.fromEntries(
  LOCALE_DEFINITIONS.map((l) => [l.code, l.lang])
) as Record<Locale, string>

/** code → 日期格式化 BCP-47 · code → BCP-47 for toLocaleDateString */
export const LOCALE_DATE: Record<Locale, string> = Object.fromEntries(
  LOCALE_DEFINITIONS.map((l) => [l.code, l.dateLocale])
) as Record<Locale, string>

/** code → 艺人串分隔符 · code → artist list delimiter */
export const ARTIST_DELIMITER: Record<Locale, string> = Object.fromEntries(
  LOCALE_DEFINITIONS.map((l) => [l.code, l.delimiter])
) as Record<Locale, string>

/**
 * @nuxtjs/i18n 的 locales 配置 · i18n.locales for nuxt.config
 * @description 由 LOCALE_DEFINITIONS 派生，nuxt.config 直接引用，避免两处维护。
 *              Derived from LOCALE_DEFINITIONS and referenced directly by nuxt.config to avoid
 *              maintaining it in two places.
 */
export const I18N_LOCALES: { code: Locale; name: string; file: string; lang: string }[] =
  LOCALE_DEFINITIONS.map((l) => ({ code: l.code, name: l.name, file: l.file, lang: l.lang }))
