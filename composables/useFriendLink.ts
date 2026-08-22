/**
 * 友情链接 composable · Friend links
 *
 * @description 从 friendLink.js 迁移而来。
 *              提供页脚社交链接数据（与原版一致：Font Awesome 图标 + 中英文 title）。
 */

interface FriendLink {
  href: string
  icon: string
  title: { zh: string; en: string }
}

/** 友情链接数据（9 个）· Friend links data */
export const friendLinksData: FriendLink[] = [
  {
    href: 'http://www.lyc.la',
    icon: 'fas fa-globe',
    title: { zh: 'lyc.la', en: 'lyc.la' }
  },
  {
    href: 'https://github.com/layicr/ilive_neo',
    icon: 'fab fa-github',
    title: { zh: 'Github', en: 'Github' }
  },
  {
    href: 'http://weibo.com/layicr',
    icon: 'fab fa-weibo',
    title: { zh: '微博', en: 'Weibo' }
  },
  {
    href: 'https://mp.weixin.qq.com/s/S1sq45LC_iQuCLYxzoaRkw',
    icon: 'fab fa-weixin',
    title: { zh: '微信', en: 'WeChat' }
  },
  {
    href: 'https://v.douyin.com/5nAiAZQoUXw/',
    icon: 'fab fa-tiktok',
    title: { zh: '抖音', en: 'Douyin' }
  },
  {
    href: 'https://space.bilibili.com/29825132',
    icon: 'fa fa-video-camera',
    title: { zh: 'B站', en: 'Bilibili' }
  },
  {
    href: 'http://twitter.com/layicr',
    icon: 'fab fa-twitter',
    title: { zh: '推特', en: 'Twitter' }
  },
  {
    href: 'http://www.instagram.com/ilayicr',
    icon: 'fab fa-instagram',
    title: { zh: 'Instagram', en: 'Instagram' }
  },
  {
    href: 'http://www.facebook.com/layicr',
    icon: 'fab fa-facebook',
    title: { zh: 'Facebook', en: 'Facebook' }
  }
]

/**
 * useFriendLink 组合式入口 · Composable entry
 * @returns 友情链接数据 · friend links
 */
export function useFriendLink() {
  return {
    friendLinks: friendLinksData
  }
}
