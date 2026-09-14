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
    const obj = JSON.parse(json) as unknown;
    // 脏数据防护：仅接受普通对象（数组 / 标量 / null 一律回退）· only plain objects are accepted
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return { 'zh-CN': '' };
    const record = obj as Record<string, unknown>;
    // 仅保留字符串值（null / 数字等脏数据丢弃），并保证基语言 zh-CN 存在
    // keep string values only (drop null / number noise) and guarantee the base zh-CN key
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'string') result[key] = value;
    }
    result['zh-CN'] = result['zh-CN'] ?? '';
    return result as LocalizedText;
  } catch {
    return { 'zh-CN': '' };
  }
}

/**
 * 解析多语言标签列（JSON 对象；每行一个标签）
 * · Parse a localized-tags column (JSON object; one tag per row)
 * @description i18n 列实际存储为「每语言一个字符串」（`{"zh-CN":"摇滚","en":"Rock"}`，一行一标签），
 *              亦兼容「每语言一个字符串数组」（`{"zh-CN":["摇滚"],"en":["Rock"]}`）。两种形态都归一化为
 *              `string[]`：字符串 → 单元素数组、数组 → 过滤其中的字符串元素、其它类型丢弃。
 *              解析失败一律回退空 `zh-CN` 数组，绝不抛错。
 *              The column stores a string per locale (one tag per row) in practice, while the array form
 *              is also accepted; both are normalized to `string[]`. On parse failure it falls back to an
 *              empty `zh-CN` array and never throws.
 */
export function parseTags(json: string | null | undefined): LocalizedTags {
  if (!json) return { 'zh-CN': [] };
  try {
    const obj = JSON.parse(json) as unknown;
    // 脏数据防护：仅接受普通对象（数组 / 标量 / null 一律回退空数组）· only plain objects are accepted
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return { 'zh-CN': [] };
    const record = obj as Record<string, unknown>;
    // 逐语言归一化：字符串 → 单元素数组；数组 → 仅留字符串元素；其余丢弃
    // normalize per locale: string → single-element array; array → keep only string items; drop the rest
    const out: Partial<Record<Locale, string[]>> = {};
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'string') {
        const v = value.trim();
        if (v) out[key as Locale] = [v];
      } else if (Array.isArray(value)) {
        const arr = value.filter((x): x is string => typeof x === 'string');
        if (arr.length) out[key as Locale] = arr;
      }
    }
    // 保证基语言 zh-CN 必存在（缺失补空数组，避免中文页回退到其它语言）
    // guarantee the base zh-CN key (fall back to empty so zh page never falls back to en)
    out['zh-CN'] = out['zh-CN'] ?? [];
    return out as LocalizedTags;
  } catch {
    return { 'zh-CN': [] };
  }
}

/** 非空字符串类型守卫 · non-null string type guard */
export function has(j: string | null | undefined): j is string {
  return j != null;
}
