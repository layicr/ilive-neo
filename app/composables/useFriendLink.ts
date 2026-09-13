/**
 * 友情链接 composable · Friend links
 *
 * @description 页脚社交/友情链接（Font Awesome 图标 + 多语言名称/描述）。
 *              数据来源 DB 驱动（`/api/data` 的 `friendLinks`，server/db/schema.sql 的 friend_links 表）；
 *              DB 为空 / 未迁移 / 查询失败 → 展示空列表（无内置回退）。
 *
 *              语言切换零请求：仅按当前 locale 重新本地化同一份数据。
 *              zh-Hant 初版为机翻，需人工校对。
 */
import { computed } from 'vue'
import { useData } from './useData'
import { useAppI18n } from './useI18n'
import { resolveFriendLinks } from '../utils/friendLinks'
import type { FriendLink, Locale } from '../types'

/**
 * useFriendLink 组合式入口 · Composable entry
 * @returns 当前语言的友情链接列表（DB 优先，空则展示空列表）· friend links localized for current locale
 */
export function useFriendLink() {
  const { friendLinks: dbFriendLinks } = useData()
  const { currentLanguage } = useAppI18n()

  const friendLinks = computed<FriendLink[]>(() =>
    resolveFriendLinks(dbFriendLinks.value, currentLanguage.value as Locale)
  )

  return {
    friendLinks
  }
}
