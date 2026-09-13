/**
 * 许愿领域模型 · Wish models
 * @module types/wish
 */

import type { LocalizedText } from './i18n'

export interface Wish {
  /** 许愿编号 · wish id */
  id: number
  /** 许愿内容（单语言，已本地化）· wish content (single-locale) */
  content: string
  /** 点赞总数 · total likes */
  likes: number
  /** 当前访问者是否已点赞 · whether the current visitor has liked */
  liked: boolean
}

export interface LocalizedWish {
  /** 许愿编号 · wish id */
  id: number
  /** 许愿内容（多语言，按 locale 分组）· wish content (multi-locale) */
  content: LocalizedText
  /** 点赞总数 · total likes */
  likes: number
  /** 当前访问者是否已点赞（按请求 IP 合并）· whether the current visitor has liked */
  liked: boolean
}
