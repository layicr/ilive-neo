/**
 * 多语言 JSON 列解析 · i18n JSON column parsing
 *
 * @module server/lib/parse
 * @description 将 DB 中以 `*_i18n` TEXT 存储的 JSON（`{"zh-CN":..,"en":..,"zh-Hant":..}`；
 *              历史库可能残留已下线的 `ja`/`ko` 键，解析时按原样保留但不参与展示）
 *              解析为 `LocalizedText` / `LocalizedTags`。被 concerts / seo / friendLinks 复用，
 *              解析失败一律回退到 zh-CN 空值，绝不抛错。
 *              Parses JSON stored in `*_i18n` TEXT columns (`{"zh-CN":..,"en":..,"zh-Hant":..}`; legacy
 *              DBs may still contain retired `ja`/`ko` keys, kept as-is but not displayed) into
 *              `LocalizedText` / `LocalizedTags`. Reused by concerts / seo / friendLinks; on parse
 *              failure it always falls back to an empty zh-CN value and never throws.
 */

import type { Locale, LocalizedText, LocalizedTags } from '../../app/types';

/** 解析多语言文本列（JSON）· Parse a localized-text column */
export function parseI18n(json: string | null | undefined): LocalizedText {
  if (!json) return { 'zh-CN': '' };
  try {
    const obj = JSON.parse(json) as Partial<Record<Locale, string>>;
    return { 'zh-CN': obj['zh-CN'] ?? '', ...obj };
  } catch {
    return { 'zh-CN': '' };
  }
}

/** 解析多语言标签列（JSON 数组）· Parse a localized-tags column */
export function parseTags(json: string | null | undefined): LocalizedTags {
  if (!json) return { 'zh-CN': [] };
  try {
    const obj = JSON.parse(json) as Partial<Record<Locale, string[]>>;
    return { 'zh-CN': obj['zh-CN'] ?? [], ...obj };
  } catch {
    return { 'zh-CN': [] };
  }
}

/** 非空字符串类型守卫 · non-null string type guard */
export function has(j: string | null | undefined): j is string {
  return j != null;
}
