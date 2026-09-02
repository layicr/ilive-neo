/**
 * 统计分析插件 · Analytics plugin (client-only)
 *
 * @description 从 public/js/statis.js 迁移而来。
 *              集成百度统计、Google Analytics、51.la 三个第三方统计服务。
 *              逻辑与旧脚本完全一致，作为 Nuxt 客户端插件在应用启动时注入。
 *              Migrated from public/js/statis.js. Integrates Baidu, Google Analytics
 *              and 51.la tracking. Logic identical to the legacy script, injected at app start.
 *
 *              注意事项：
 *              - var _hmt 必须保留 var 声明（百度统计标准写法）
 *              - 所有统计代码均为第三方服务，不建议修改核心逻辑
 *              Notes:
 *              - The `var _hmt` declaration must be kept as-is (Baidu standard)
 *              - All tracking code is third-party; do not modify core logic
 */
export default defineNuxtPlugin(() => {
  // ==================== 百度统计 ====================
  // @see https://tongji.baidu.com/
  ;(window as any)._hmt = (window as any)._hmt || []
  ;(function () {
    const hm = document.createElement('script')
    hm.src = 'https://hm.baidu.com/hm.js?314959f767a1bf837f2a6bc8ba6f5e2d'
    const s = document.getElementsByTagName('script')[0]
    s.parentNode!.insertBefore(hm, s)
  })()

  // ==================== Google Analytics ====================
  // @see https://analytics.google.com/
  ;(function () {
    const firstScript = document.createElement('script')
    firstScript.async = true
    firstScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-Y7B6DLCXSE'

    firstScript.onload = function () {
      window.dataLayer = window.dataLayer || []
      function gtag(...args: any[]) {
        ;(window.dataLayer as any[]).push(args)
      }
      gtag('js', new Date())
      gtag('config', 'G-Y7B6DLCXSE')
    }

    firstScript.onerror = function () {
      console.error('无法加载 Google Analytics gtag.js 主库。')
    }

    document.head.appendChild(firstScript)
  })()

  // ==================== 51.la 网站统计 ====================
  // @see https://www.51.la/
  !function (p: any) {
    'use strict'
    !function () {
      const s = window
      const e = document
      const i = p
      const c = ''.concat(
        'https:' === e.location.protocol ? 'https://' : 'http://',
        'sdk.51.la/js-sdk-pro.min.js'
      )
      const n = e.createElement('script')
      const r = e.getElementsByTagName('script')[0]
      n.type = 'text/javascript'
      n.setAttribute('charset', 'UTF-8')
      n.async = true
      n.src = c
      n.id = 'LA_COLLECT'
      i.d = n
      const o = function () {
        ;(s as any).LA.ids.push(i)
      }
      ;(s as any).LA
        ? (s as any).LA.ids && o()
        : ((s as any).LA = p, (s as any).LA.ids = [], o())
      r.parentNode!.insertBefore(n, r)
    }()
  }({ id: 'L8VlyZ1HkDS0E3VO', ck: 'L8VlyZ1HkDS0E3VO' })
})
