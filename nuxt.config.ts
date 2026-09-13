/**
 * Nuxt 配置 · Nuxt configuration
 *
 * @description 演唱会足迹迁移项目的 Nuxt4 总配置（SSR、runtimeConfig、Head、Tailwind CDN 等）
 *              Nuxt4 config for the concert journey migration (SSR, runtimeConfig, Head, etc.)
 *              Nuxt 4 起 srcDir 默认为 app/：app.vue、pages/、composables/、plugins/、utils/、
 *              locales/、types/ 均位于 app/ 下；server/ 与 public/ 仍位于项目根。
 */

import { DEFAULT_LOCALE, I18N_LOCALES } from './server/lib/locales'

/**
 * 站点正式地址（HTTPS）· Canonical site URL (HTTPS)
 * @description 站点地址已「提取到数据库 site_settings.site_url」（运营可在 DB 改，优先于环境变量）。
 *              优先级链：site_settings.site_url → 此处环境变量 NUXT_PUBLIC_SITE_URL → 代码兜底域名。
 *              nuxt.config 在配置求值阶段即需 siteUrl（app.head 静态 meta / runtimeConfig），
 *              此时 DB 尚未就绪，故保留 env 作为 SSR 首屏与静态 meta 的回退；
 *              页面级 useSeoMeta / JSON-LD / app.vue 的 canonical 与 hreflang 在拿到 DB seo 后用 site_url 覆盖。
 */
const SITE_URL = process.env.NUXT_PUBLIC_SITE_URL || 'https://ilive.lyc.la'

export default defineNuxtConfig({
  compatibilityDate: '2026-08-31',

  /**
   * Nuxt 模块 · Modules
   * @description @vite-pwa/nuxt：自动生成 Service Worker（替代手写 public/js/sw.js），配置化缓存策略
   */
  modules: ['@vite-pwa/nuxt', '@nuxtjs/i18n'],

  /**
   * i18n 配置 · Internationalization（vue-i18n via @nuxtjs/i18n）
   * @description 多语言：中文 zh（默认无前缀）/ 英文 en / 繁体 zh-Hant。
   *              URL 前缀路由（prefix_except_default）；每个 locale 显式声明 BCP-47 lang，
   *              <html lang> / hreflang / og:locale 由 app/app.vue 统一输出（app.vue 无页面级依赖）；
   *              页面 title/description/og/twitter 由 app/pages/index.vue 的 useSeoMeta 按 locale 输出；
   *              文案 lazy 加载自 i18n/locales/*（各文件默认导出 message，v10 模块布局）；业务数据多语言见 server + useData。
   */
  i18n: {
    // 语言定义统一来自 server/lib/locales.ts（单一真源），新增语言只需改那里。
    // 每个 locale 显式声明 BCP-47 `lang`（zh-CN / en / zh-Hant），
    // app/app.vue 据此输出 <html lang>、hreflang（含 x-default）与 og:locale，
    // 避免默认以 code（zh）作 lang 导致 zh-CN 缺失。
    locales: I18N_LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    strategy: 'prefix_except_default',
    lazy: false,
    langDir: 'locales/',
    seo: true,
    fallbackLocale: DEFAULT_LOCALE,
    detectBrowserLanguage: {
      useCookie: true,
      switchOnDetect: false
    }
  },

  /**
   * PWA 配置 · PWA configuration
   * @description 用 @vite-pwa/nuxt 生成 SW 与 manifest。数据走数据库 API，故 /api/* 用 NetworkFirst
   *              保证实时从数据库获取（离线时回退缓存，不做静态数据降级）。
   *              dev 下默认不启用 SW，避免干扰开发；生产构建时自动注入。
   */
  pwa: {
    registerType: 'autoUpdate',
    injectRegister: 'inline',
    devOptions: { enabled: false },
    manifest: {
      // name / short_name 用与语言无关的品牌名（安装到桌面/主屏时展示），
      // 与站点语言无关；description 仍沿用中文简介。
      name: 'Layicr Concert Journey',
      short_name: 'Layicr',
      description: '记录每一次演唱会的感动与回忆',
      lang: 'zh-CN',
      start_url: '/',
      display: 'standalone',
      background_color: '#0f0c29',
      theme_color: '#4851ad',
      icons: [{ src: 'img/logo.jpg', sizes: 'any', type: 'image/jpeg' }]
    },
    workbox: {
      // 预缓存仅含应用壳（js/css/html/ico/字体），不预缓存图片/音频——
      // 图片/音频由下方 runtimeCaching 的 StaleWhileRevalidate 按需缓存。
      // 否则会一次性预缓存 300+ 张图（约 70MB），首次访问即被后台拉满，移动端灾难。
      globPatterns: ['**/*.{js,css,html,ico,woff2}'],
      // 导航回退置空 · Disable navigation fallback
      // 本项目为 SSR 站点，构建产物中没有可回退的静态 HTML（预缓存清单仅含 _nuxt 的 js/css、
      // css/main.css、manifest.webmanifest 与 builds/*.json，无任何 HTML 条目）。
      // 若保留 navigateFallback: '/'，workbox-build 会生成
      // `registerRoute(new NavigationRoute(createHandlerBoundToURL("/")))`，
      // 而 "/" 不在预缓存清单中，SW 启动即抛 `non-precached-url` 并中断其后
      // images / assets / api 三条运行时路由的注册。置为 null 后不再生成 NavigationRoute，
      // 导航请求直接走网络（离线时由浏览器离线页兜底），三条运行时缓存路由恢复正常注册。
      navigateFallback: null,
      runtimeCaching: [
        // 图片：Stale-While-Revalidate（缓存优先，后台更新）
        {
          urlPattern: /\.(?:jpg|jpeg|png|gif|webp|svg|ico)$/,
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'images', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } }
        },
        // CSS/JS：NetworkFirst（网络优先，缓存兜底）
        {
          urlPattern: /\.(?:css|js)$/,
          handler: 'NetworkFirst',
          options: { cacheName: 'assets', networkTimeoutSeconds: 3 }
        },
        // API 数据：NetworkFirst（保证实时从数据库获取，离线时回退缓存）
        {
          urlPattern: /\/api\//,
          handler: 'NetworkFirst',
          options: { cacheName: 'api', networkTimeoutSeconds: 3 }
        }
      ]
    }
  },

  /**
   * 类型检查与严格模式 · Type checking and strict mode
   * @description 生成类型声明，供 IDE 与 nuxt prepare 使用
   */
  typescript: {
    strict: true,
    typeCheck: false
  },

  /**
   * 实验特性 · Experimental features
   * @description entryImportMap：Nuxt 4.1+ 默认开启，会把客户端对入口 chunk 的引用改写为裸说明符 `#entry`，
   *              该说明符只能由 HTML 中的 import map 解析；对不支持原生 import maps 的内核
   *              （Safari/iOS < 16.4、Firefox < 108、Chrome/Edge < 89 等）会抛
   *              `Module specifier, "#entry" does not start with "/", "./", or "../"`。
   *              本项目未声明 vite.build.target，框架的浏览器兼容性闸门不生效，故显式关闭该特性。
   */
  experimental: {
    entryImportMap: false
  },

  /**
   * SSR 特性 · SSR features
   * @description 保持 SSR 开启以支持服务端渲染骨架与 API 调用；数据主要由客户端插件通过 /api 拉取
   */
  ssr: true,

  /**
   * runtime 配置 · Runtime configuration (server 端可访问环境变量)
   * @description Turso/LibSQL 双协议连接参数，来自环境变量（不提交版本库）。
   *              生产/线上用远程 Turso（NUXT_TURSO_DATABASE_URL=libsql://...），
   *              本地开发可回退到 file: 本地 SQLite。
   *              注意：用 NUXT_ 前缀，Nuxt 才会在运行时覆盖 runtimeConfig.turso.*；
   *              这里兼容 NUXT_ 与 TURSO_ 两种前缀（TURSO_ 仅 config 求值阶段有效）。
   */
  runtimeConfig: {
    /**
     * 公开运行时配置 · Public runtime config
     * @description 站点地址的「环境变量级」兜底：优先于代码常量，但弱于 DB site_settings.site_url。
     *              SEO 的 canonical / hreflang / og:* / JSON-LD 统一在页面与 app.vue 拿到 DB seo 后
     *              用 site_url 覆盖；此处保留为 SSR 首屏与 app.head 静态 meta 的回退。运行时由
     *              `NUXT_PUBLIC_SITE_URL` 覆盖。
     */
    public: {
      siteUrl: SITE_URL
    },
    turso: {
      databaseUrl: process.env.NUXT_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL || 'file:./public/data/data.db',
      authToken: process.env.NUXT_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || ''
    }
  },

  /**
   * 运行时环境变量透传 · Expose public env
   * @description 目前无需前端私有配置，保留以便扩展
   */
  devtools: { enabled: true },

  /**
   * 页面头部 · App head
   * @description 迁移原 index.html 的 SEO/OG/Twitter 元信息、Favicon、CDN 依赖（GSAP/FontAwesome）
   *              Keep original SEO meta, favicon and CDN deps to keep visuals identical
   */
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1.0',
      // 说明：title / keywords / description / og:title / og:description /
      //      twitter:title / twitter:description 均随语言变化，统一由页面级
      //      useSeoMeta（app/pages/index.vue）按当前 locale 输出；
      //      htmlAttrs.lang 与 hreflang / og:locale 由 app/app.vue 输出。
      //      此处只保留与语言无关的静态元信息，避免重复或冲突。
      meta: [
        { name: 'author', content: 'layicr' },
        { name: 'robots', content: 'index, follow' },
        { name: 'referrer', content: 'strict-origin-when-cross-origin' },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: SITE_URL },
        { property: 'og:image', content: SITE_URL + '/img/og-image.svg' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:site', content: '@layicr' },
        { name: 'twitter:creator', content: '@layicr' },
        { name: 'twitter:image', content: SITE_URL + '/img/og-image.svg' }
      ],
      link: [
        { rel: 'icon', type: 'image/jpeg', href: '/img/logo.jpg' },
        { rel: 'apple-touch-icon', href: '/img/logo.jpg' },
        // canonical 不再在此硬编码（原先所有语言页共用同一个根域名 canonical）：
        // 已改为 app/app.vue 按当前 locale 输出，如 https://ilive.lyc.la/ 与 https://ilive.lyc.la/en。
        // 原 CSS 原样链路 · Original CSS as-is (kept as separate requests to match original network behavior)
        { rel: 'stylesheet', href: '/css/main.css' },
        { rel: 'preconnect', href: 'https://cdnjs.cloudflare.com' },
        { rel: 'dns-prefetch', href: 'https://cdn.busuanzi.cc' },
        /**
         * FontAwesome（CDN）· Font Awesome via CDN
         * @description 沿用现有 `fa` 图标类名所需的字体样式库
         */
        { rel: 'stylesheet', href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css' }
      ],
      script: [
        /**
         * GSAP 动画库 · GSAP (3.12.2) via CDN
         * @description 3D 专辑堆叠与面板动画所需，保持与源站一致版本
         */
        { src: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js', integrity: 'sha512-16esztaSRplJROstbIIdwX3N97V1+pZvV33ABoG1H2OyTttBxEGkTsoIVsiP1iaTtM8b3+hu2kB6pQ4Clr5yug==', crossorigin: 'anonymous', referrerpolicy: 'no-referrer', defer: true, tagPosition: 'head' }
      ]
    }
  },

  /**
   * Nitro 配置 · Nitro settings
   * @description 数据来自远程 Turso（NUXT_TURSO_DATABASE_URL），本地 file: 仅作开发兜底。
   *              保留 public/data 静态资源挂载（若本地存在 data.db 会被复制到 .output/public/data），
   *              但线上依赖 Turso，不再需要把 data.db 打包进 server bundle。
   */
  nitro: {
    compressPublicAssets: true,
    /**
     * 客户端 IP 信任策略（说明，非 Nitro 选项）· Client-IP trust policy (note, not a Nitro option)
     * @description `nitro` 并无 `trustProxy` 选项。真正的信任开关是环境变量 `NUXT_TRUST_PROXY`，
     *              由 `server/lib/concertLikes.ts` 的 `getClientIp()` 在运行时读取：仅当其为 `true` 时
     *              才采信 `X-Forwarded-For`，否则回退到不可伪造的 TCP socket 地址（直连部署的安全默认）。
     *              部署于反代 / CDN（Vercel、Cloudflare、nginx）后设 `NUXT_TRUST_PROXY=true`，
     *              并确保反代「覆写」（而非追加）`X-Forwarded-For` 为真实客户端 IP。
     *              详见 README_DEV「安全」一节与 server/lib/concertLikes.ts 的 getClientIp 注释。
     *              · No such `nitro` option: the trust switch is the NUXT_TRUST_PROXY env var, read at
     *                runtime by getClientIp(). Set it true behind a trusted proxy that overwrites XFF.
     */
    // 注：不再把 public/data 作为静态资源暴露。
    // 线上走远程 Turso，本地 file: 模式下服务端插件直接连接 data.db 文件，
    // 无需（也不应）把数据库文件当静态资源公开下载。
  }
})