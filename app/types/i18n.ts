/**
 * 多语言基础类型 · i18n base types
 * @module types/i18n
 * @description Locale 代码与按 locale 分组的多语言文本/标签。
 *              被所有领域模型（concert / city / wish / friendLink / seo）复用。
 */

/** 语言代码 · Locale code（与 @nuxtjs/i18n 对齐：zh-CN 为默认语言，无 URL 前缀） */
export type Locale = 'zh-CN' | 'en' | 'zh-Hant'

/** 多语言文本 · Localized text（按 locale 存储；zh-CN 为基语言，缺失时回退） */
export type LocalizedText = Partial<Record<Locale, string>> & { 'zh-CN': string }

/** 多语言标签（每语言一个字符串数组）· Localized tags */
export type LocalizedTags = Partial<Record<Locale, string[]>> & { 'zh-CN': string[] }
