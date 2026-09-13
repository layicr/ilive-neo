/**
 * 友情链接模型 · Friend-link models
 * @module types/friendLink
 * @description `LocalizedFriendLink` 为 DB 形态（见 server/lib/mappers 的 fetchFriendLinks）；
 *              `FriendLink` 为前端按 locale 本地化后的展示形态。
 *              DB 为空 / 查询失败时前端展示空列表（不再回退代码列表）。
 */

import type { LocalizedText } from './i18n'

/** 多语言友情链接（DB 形态）· Multi-locale friend link (DB shape) */
export interface LocalizedFriendLink {
  id: number
  /** 链接地址 · link href */
  href: string
  /** Font Awesome 图标类名（可空，回退 'fas fa-globe'）· icon class */
  icon: string | null
  /** 链接名称（多语言）· link title per locale */
  title: LocalizedText
  /** 链接描述（多语言，可选）· link description per locale */
  description: LocalizedText | null
  /** 排序（越小越靠前）· sort order */
  seq: number
}

/** 单语言友情链接（前端展示形态）· Single-locale friend link (view shape) */
export interface FriendLink {
  href: string
  icon: string
  title: string
  description: string | null
}
