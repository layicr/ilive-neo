/**
 * 站点级 SEO 映射层 · Site-level SEO mapping (DB-first, code fallback)
 *
 * @module server/lib/seo
 * @description 读取单行 `site_settings` 与全表 `site_seo_i18n`，逐字段回退到代码级
 *              默认值 `SEO_FALLBACK`；查询整体失败（表不存在 / DB 不可用）时直接返回完整默认
 *              对象，绝不抛错、绝不返回空文案。
 *              Reads the single `site_settings` row and the whole `site_seo_i18n` table, falling back
 *              per field to the code defaults `SEO_FALLBACK`; if the query fails entirely (missing table /
 *              DB unavailable) it returns the full defaults, never throwing and never returning empty copy.
 */

import type { Client } from '@libsql/client';
import type { SeoI18nKey, SiteSeoSettings } from '../../app/types';
import { parseI18n } from './parse';
import { DEFAULT_SITE_URL } from '../../app/utils/seo';

/** SEO 多语言键（与 site_seo_i18n.key 一一对应，未知键忽略）· SEO i18n keys */
export const SEO_I18N_KEYS: readonly SeoI18nKey[] = ['site_title', 'site_description', 'keywords'];

/**
 * 站点 SEO 的代码级回退默认值 · Hard-coded SEO fallbacks
 * @description 与迁移前的硬编码保持一致；DB 缺表 / 为空 / 查询失败时整体回退到此对象，
 *              保证任何情况下 title / description 都不会为空（SEO_DB_MIGRATION.md「坑 1」）。
 *              Matches the pre-migration hard-coded values; when the DB is missing/empty or the query
 *              fails, everything falls back to this object so title / description are never empty
 *              (see SEO_DB_MIGRATION.md "pitfall 1").
 */
export const SEO_FALLBACK: SiteSeoSettings = {
  ogImage: '/img/og-image.svg',
  twitterSite: '@layicr',
  twitterCreator: '@layicr',
  author: 'layicr',
  robots: 'index, follow',
  siteUrl: DEFAULT_SITE_URL,
  i18n: {}
};

/** site_settings 单行行结构 · Row shape of the single-row site_settings */
export interface SiteSettingsRow {
  og_image: string | null;
  twitter_site: string | null;
  twitter_creator: string | null;
  author: string | null;
  robots: string | null;
  site_url: string | null;
}

/** 取非空字符串，否则回退 · non-empty trimmed string, else fallback */
function orDefault(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

/**
 * 读取站点级 SEO 设置（DB 优先，逐字段回退）· Fetch site-level SEO settings
 * @description 读取单行 site_settings（id = 1）与 site_seo_i18n 全表；
 *              任何字段缺失/为空都用 `SEO_FALLBACK` 的同名字段兜底；查询整体失败
 *              （表不存在、DB 不可用）时直接返回完整默认对象，不抛错、不返回空文案。
 *              Reads the single site_settings row (id = 1) and the whole site_seo_i18n table; any
 *              missing/empty field falls back to the same-named SEO_FALLBACK value; a total failure
 *              (missing table, DB unavailable) returns the full defaults without throwing.
 */
export async function fetchSiteSeo(client: Client): Promise<SiteSeoSettings> {
  try {
    const [settingsRes, seoRes] = await Promise.all([
      client.execute('SELECT og_image, twitter_site, twitter_creator, author, robots, site_url FROM site_settings WHERE id = 1'),
      client.execute('SELECT key, value_i18n FROM site_seo_i18n')
    ]);

    const row = settingsRes.rows[0] as unknown as SiteSettingsRow | undefined;

    const i18n: Partial<Record<SeoI18nKey, ReturnType<typeof parseI18n>>> = {};
    for (const r of seoRes.rows) {
      const key = String(r.key ?? '') as SeoI18nKey;
      if (!SEO_I18N_KEYS.includes(key)) continue;
      i18n[key] = parseI18n(r.value_i18n == null ? null : String(r.value_i18n));
    }

    return {
      ogImage: orDefault(row?.og_image, SEO_FALLBACK.ogImage),
      twitterSite: orDefault(row?.twitter_site, SEO_FALLBACK.twitterSite),
      twitterCreator: orDefault(row?.twitter_creator, SEO_FALLBACK.twitterCreator),
      author: orDefault(row?.author, SEO_FALLBACK.author),
      robots: orDefault(row?.robots, SEO_FALLBACK.robots),
      siteUrl: orDefault(row?.site_url, SEO_FALLBACK.siteUrl),
      i18n
    };
  } catch (err) {
    // 未迁移 / DB 不可用 / 查询失败 → 完整默认对象（关键回退链，绝不抛错）· fallback to defaults
    console.warn('[mappers] fetchSiteSeo 回退默认值 · fallback to defaults:', String(err));
    return { ...SEO_FALLBACK, i18n: {} };
  }
}
