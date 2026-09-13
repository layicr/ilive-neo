/**
 * 友情链接：本地化 · Friend links: localization
 *
 * @description 页脚社交/友情链接的本地化（DB 驱动，无内置回退列表）：
 *              `resolveFriendLinks(dbLinks, locale)` 将 DB 返回的 `LocalizedFriendLink[]`
 *              逐条本地化为 `FriendLink[]`；DB 为空 / 查询失败（空数组 / null / undefined）
 *              → 直接返回空数组，站点不展示友情链接（不再回退代码内置列表）。
 *
 *              单条字段级兜底（不依赖任何内置数据）：
 *                · icon 缺失 → 通用图标 `FRIEND_LINK_ICON_FALLBACK`；
 *                · title 缺失 → 回退 href 本身，保证名称永不为空；
 *                · description 缺失 → null。
 */
import type { Locale, LocalizedFriendLink, FriendLink } from '../types'
import { pickLocale } from './index'

/** 图标缺失时的兜底类名 · Fallback Font Awesome class */
export const FRIEND_LINK_ICON_FALLBACK = 'fas fa-globe'

/**
 * 单条友情链接本地化（字段级兜底，无内置列表）· Localize one friend link with per-field fallback
 * @description icon 缺失 → 通用图标；title 缺失 → href 本身；description 缺失 → null。
 */
export function localizeFriendLink(link: LocalizedFriendLink, locale: Locale): FriendLink {
  const href = (link.href ?? '').trim()
  return {
    href,
    icon: (link.icon ?? '').trim() || FRIEND_LINK_ICON_FALLBACK,
    title: pickLocale(link.title, locale) || href,
    description: pickLocale(link.description, locale) || null
  }
}

/**
 * 解析友情链接（DB 驱动，无内置回退）· Resolve friend links (DB-only)
 * @description DB 有数据 → 逐条本地化并过滤 href 为空的条目；DB 为空 / null / undefined
 *              → 返回空数组（站点不展示友情链接）。
 */
export function resolveFriendLinks(
  dbLinks: LocalizedFriendLink[] | null | undefined,
  locale: Locale
): FriendLink[] {
  return (dbLinks ?? [])
    .map((l) => localizeFriendLink(l, locale))
    .filter((l) => l.href.length > 0)
}
