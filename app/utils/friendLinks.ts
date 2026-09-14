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
 * 链接协议白名单净化（渲染前最后一道防线）· Sanitize a link by protocol allow-list
 * @description 仅放行 `http(s)://` 绝对地址、站内相对路径与页内锚点；`javascript:` / `data:` /
 *              `vbscript:` / `file:` 以及协议相对 `//host` 一律返回空串（由调用方过滤），
 *              防止 DB 中的 `friend_links.href` 被写成脚本伪协议后直接落到 `<a href>` 形成点击型 XSS。
 *              同时剥离空白与控制字符，防 `java\nscript:` 这类混淆绕过。
 *              Only http(s) absolute URLs, site-relative paths and in-page anchors pass; script-ish
 *              schemes and protocol-relative URLs are dropped (empty string). Control chars are stripped.
 */
export function sanitizeHref(raw: string | null | undefined): string {
  const value = (raw ?? '').trim()
  if (!value) return ''
  const stripped = value.replace(/[\u0000-\u0020\u007f]/g, '')
  if (!stripped) return ''
  if (/^https?:\/\//i.test(stripped)) return stripped
  if (/^[#/]/.test(stripped) && !stripped.startsWith('//')) return stripped
  return ''
}

/**
 * 单条友情链接本地化（字段级兜底，无内置列表）· Localize one friend link with per-field fallback
 * @description icon 缺失 → 通用图标；title 缺失 → href 本身；description 缺失 → null；
 *              href 走协议白名单，非法协议置空后由 resolveFriendLinks 过滤。
 */
export function localizeFriendLink(link: LocalizedFriendLink, locale: Locale): FriendLink {
  const href = sanitizeHref(link.href)
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
