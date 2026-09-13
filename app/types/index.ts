/**
 * 全局类型定义（聚合导出）· Shared types (barrel)
 *
 * @module types
 * @description 应用（客户端 / API）共享类型。各子模块（i18n / concert / city / wish /
 *              friendLink / seo）在此统一再导出；`AppData` / `ApiResponse` 直接定义于此。
 *              历史 `import ... from '~/types'` 或 `from '../../app/types'` 仍可用，调用方无需改动。
 *              服务端 mappers 产出 `Localized*`（按 locale 分组的多语言对象），
 *              客户端按当前 locale 本地化为单语言 `Concert`/`City`/`Wish`。
 */

export * from './i18n'
export * from './concert'
export * from './city'
export * from './wish'
export * from './friendLink'
export * from './seo'

import type { LocalizedConcert } from './concert'
import type { LocalizedCity } from './city'
import type { LocalizedWish } from './wish'
import type { SiteSeoSettings } from './seo'
import type { LocalizedFriendLink } from './friendLink'

export interface AppData {
  concerts: LocalizedConcert[]
  cities: LocalizedCity[]
  wishes: LocalizedWish[]
  stats: { totalConcerts: number; totalArtists: number; totalCities: number; totalWishes: number }
  /** 站点级 SEO 设置（DB 优先，缺失回退）· site-level SEO settings */
  seo: SiteSeoSettings
  /** 页脚友情链接（DB 优先，空则前端回退代码列表）· footer friend links */
  friendLinks: LocalizedFriendLink[]
  /** 服务端实际本地化的语言（请求带 ?lang= 时为该语言，否则 null 表示返回多语言原始形态）· locale the server actually localized to */
  locale: Locale | null
  generatedAt: string
}

export interface ApiResponse {
  data: AppData
  generatedAt: string
}
