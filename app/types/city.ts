/**
 * 城市领域模型 · City models
 * @module types/city
 */

import type { LocalizedText } from './i18n'

/** 单语言城市（前端展示形态）· Single-locale city (view shape) */
export interface City {
  id: number
  name: string
  /** 排序（越小越靠前）· sort order */
  seq: number
  /** Font Awesome 图标类名（可空）· icon class (nullable) */
  icon: string | null
  /** 该城市下的演唱会数（服务端预置，供单语言直接读取）· concert count precomputed by the server */
  concertCount: number
}

/** 多语言城市（DB 原始形态）· Multi-locale city (DB shape) */
export interface LocalizedCity {
  id: number
  name: LocalizedText
  /** 排序（越小越靠前）· sort order */
  seq: number
  /** Font Awesome 图标类名（可空）· icon class (nullable) */
  icon: string | null
}
