/**
 * 友情链接映射层 · Friend-link mapping (DB-first, code fallback)
 *
 * @module server/lib/friendLinks
 * @description 读取启用状态的 `friend_links` 记录并映射为 `LocalizedFriendLink`；
 *              查询失败（表不存在 / DB 不可用）时返回空数组，前端据此展示空列表
 *              （无内置回退列表，见 app/utils/friendLinks.ts）。
 *              Fetch enabled `friend_links` rows and map them to `LocalizedFriendLink`; on failure
 *              (missing table / DB unavailable) it returns an empty array and the client renders an
 *              empty list (no built-in fallback — see app/utils/friendLinks.ts).
 */

import type { Client } from '@libsql/client';
import type { LocalizedFriendLink } from '../../app/types';
import { parseI18n, has } from './parse';

/** friend_links 表行结构 · Row shape of the friend_links table */
export interface FriendLinkRow {
  id: number;
  href: string | null;
  icon: string | null;
  title_i18n: string | null;
  description_i18n: string | null;
  seq: number | null;
  enabled: number | null;
}

/** 图标缺失时的兜底类名 · Fallback Font Awesome class */
export const FRIEND_LINK_ICON_FALLBACK = 'fas fa-globe';

/**
 * 链接协议白名单净化（服务端输出前防御）· Sanitize a link by protocol allow-list
 * @description 仅放行 `http(s)://` 绝对地址、站内相对路径与页内锚点；`javascript:` / `data:` /
 *              `vbscript:` / `file:` 与协议相对 `//host` 一律置空（由 fetchFriendLinks 过滤），
 *              避免运营在 DB 中被写入脚本伪协议后经 `/api/data` 直接下发到 `<a href>`。
 *              同时剥离空白与控制字符，防 `java\nscript:` 混淆绕过。
 *              Only http(s)/site-relative/anchor links pass; script-ish schemes are emptied.
 */
function sanitizeHref(raw: string | null | undefined): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  const stripped = value.replace(/[\u0000-\u0020\u007f]/g, '');
  if (!stripped) return '';
  if (/^https?:\/\//i.test(stripped)) return stripped;
  if (/^[#/]/.test(stripped) && !stripped.startsWith('//')) return stripped;
  return '';
}

/**
 * 将单行友情链接映射为多语言结构（逐字段回退）· Map one friend-link row with per-field fallback
 * @description 可翻译字段走 `parseI18n`；icon 缺失回退通用图标；seq 缺失回退 0；href 过协议白名单；
 *              描述列缺失时返回 null（由前端决定是否回退代码文案）。
 *              Translatable fields go through `parseI18n`; href passes a protocol allow-list; a missing
 *              icon falls back to the generic icon; a missing seq falls back to 0; a missing description
 *              column returns null.
 */
export function mapFriendLink(row: FriendLinkRow): LocalizedFriendLink {
  return {
    id: Number(row.id ?? 0),
    href: sanitizeHref(row.href),
    icon: has(row.icon) ? String(row.icon).trim() : FRIEND_LINK_ICON_FALLBACK,
    title: parseI18n(row.title_i18n),
    description: has(row.description_i18n) ? parseI18n(row.description_i18n) : null,
    seq: Number(row.seq ?? 0)
  };
}

/**
 * 读取启用的友情链接（DB 优先）· Fetch enabled friend links
 * @description 仅取 `enabled = 1` 且 href 非空的记录，按 seq 升序；
 *              未迁移（表不存在）/ DB 不可用 / 查询失败时返回空数组并告警，
 *              **不抛错**——前端据此展示空列表（无内置回退，见 app/utils/friendLinks.ts）。
 *              Takes only `enabled = 1` rows with a non-empty href, ordered by seq; on failure
 *              (missing table / DB unavailable) it warns and returns an empty array, **never throws**,
 *              and the client renders an empty list (no built-in fallback).
 */
export async function fetchFriendLinks(client: Client): Promise<LocalizedFriendLink[]> {
  try {
    const res = await client.execute(
      'SELECT id, href, icon, title_i18n, description_i18n, seq, enabled FROM friend_links WHERE enabled = 1 ORDER BY seq, id'
    );
    return res.rows
      .map((r) => mapFriendLink(r as unknown as FriendLinkRow))
      .filter((l) => l.href.length > 0);
  } catch (err) {
    // 关键回退链：返回空数组 → 前端使用代码内置列表 · fallback handled by the client
    console.warn('[mappers] fetchFriendLinks 回退空列表（无内置回退）· fallback to empty list:', String(err));
    return [];
  }
}
