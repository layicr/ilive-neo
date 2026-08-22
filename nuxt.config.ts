/**
 * Nuxt 配置 · Nuxt configuration
 *
 * @description 演唱会足迹迁移项目的 Nuxt3 总配置（SSR、runtimeConfig、Head、Tailwind CDN 等）
 *              Nuxt3 config for the concert journey migration (SSR, runtimeConfig, Head, etc.)
 */
export default defineNuxtConfig({
  compatibilityDate: '2025-07-04',

  /**
   * Nuxt 模块 · Modules
   * @description @vite-pwa/nuxt：自动生成 Service Worker（替代手写 public/js/sw.js），配置化缓存策略
   */
  modules: ['@vite-pwa/nuxt'],

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
      name: 'Layicr 演唱会足迹',
      short_name: '演唱会足迹',
      description: '记录每一次演唱会的感动与回忆',
      lang: 'zh-CN',
      start_url: '/',
      display: 'standalone',
      background_color: '#0f0c29',
      theme_color: '#4851ad',
      icons: [{ src: 'img/logo.jpg', sizes: 'any', type: 'image/jpeg' }]
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,jpg,jpeg,png,svg,woff2,mp3}'],
      navigateFallback: '/',
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
   * SSR 特性 · SSR features
   * @description 保持 SSR 开启以支持服务端渲染骨架与 API 调用；数据主要由客户端插件通过 /api 拉取
   */
  ssr: true,

  /**
   * runtime 配置 · Runtime configuration (server 端可访问环境变量)
   * @description Turso/LibSQL 双协议连接参数，来自 .env（不提交版本库）
   */
  runtimeConfig: {
    turso: {
      databaseUrl: process.env.TURSO_DATABASE_URL || 'file:./public/data/data.db',
      authToken: process.env.TURSO_AUTH_TOKEN || ''
    }
  },

  /**
   * 运行时环境变量透传 · Expose public env
   * @description 目前无需前端私有配置，保留以便扩展
   */
  devtools: { enabled: true },

  /**
   * 页面头部 · App head
   * @description 迁移原 index.html 的 SEO/OG/Twitter 元信息、Favicon、CDN 依赖（GSAP/Tailwind/FontAwesome）
   *              Keep original SEO meta, favicon and CDN deps to keep visuals identical
   */
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1.0',
      htmlAttrs: { lang: 'zh-CN' },
      title: 'layicr - 演唱会足迹',
      meta: [
        { name: 'keywords', content: 'layicr,lyc,lyc.la,演唱会,五月天,陈奕迅,任贤齐,孙燕姿,邓紫棋,周传雄,李荣浩,伍佰,周杰伦,蔡依林,侧田,Concert,Mayday,EasonChan,RichieJen,StefanieSun,G.E.M.,SteveChou,LiRonghao,WuBai,JayChou,JolinCai,JustinLo,演唱会足迹,演唱会记录' },
        { name: 'description', content: 'Layicr的个人演唱会足迹记录网站。记录观看五月天、陈奕迅、伍佰、任贤齐、孙燕姿、周传雄、邓紫棋、李荣浩、周杰伦、蔡依林、侧田等歌手演唱会的美好回忆。' },
        { name: 'author', content: 'layicr' },
        { name: 'robots', content: 'index, follow' },
        { name: 'referrer', content: 'strict-origin-when-cross-origin' },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'http://ilive.lyc.la' },
        { property: 'og:title', content: 'Layicr 演唱会足迹' },
        { property: 'og:description', content: '记录每一次演唱会的感动与回忆' },
        { property: 'og:image', content: 'http://ilive.lyc.la/img/logo.jpg' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Layicr 演唱会足迹' },
        { name: 'twitter:description', content: '记录每一次演唱会的感动与回忆' },
        { name: 'twitter:image', content: 'http://ilive.lyc.la/img/logo.jpg' }
      ],
      link: [
        { rel: 'icon', type: 'image/jpeg', href: 'img/logo.jpg' },
        { rel: 'apple-touch-icon', href: 'img/logo.jpg' },
        { rel: 'canonical', href: 'http://ilive.lyc.la' },
        // 原 CSS 原样链路 · Original CSS as-is (kept as separate requests to match original network behavior)
        { rel: 'stylesheet', href: 'css/load.css' },
        { rel: 'stylesheet', href: 'css/main.css' },
        { rel: 'preconnect', href: 'https://cdnjs.cloudflare.com' },
        { rel: 'dns-prefetch', href: 'https://cdn.busuanzi.cc' },
        { rel: 'dns-prefetch', href: 'https://cdn.tailwindcss.com' },
        /**
         * FontAwesome（CDN）· Font Awesome via CDN
         * @description 沿用现有 `fa` 图标类名所需的字体样式库
         */
        { rel: 'stylesheet', href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css', media: 'print', onload: "this.media='all'" }
      ],
      script: [
        /**
         * GSAP 动画库 · GSAP (3.12.2) via CDN
         * @description 3D 专辑堆叠与面板动画所需，保持与源站一致版本
         */
        { src: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js', integrity: 'sha512-16esztaSRplJROstbIIdwX3N97V1+pZvV33ABoG1H2OyTttBxEGkTsoIVsiP1iaTtM8b3+hu2kB6pQ4Clr5yug==', crossorigin: 'anonymous', referrerpolicy: 'no-referrer', tagPosition: 'head' },
        /**
         * TailwindCSS（CDN）· Tailwind via CDN
         * @description 原页面大量使用 Tailwind 工具类，CDN 模式保持视觉一致
         */
        { src: 'https://cdn.tailwindcss.com', tagPosition: 'head' }
      ]
    }
  },

  /**
   * 兼容 Node 原生内置模块 · Compat settings (optional)
   */
  nitro: {
    compressPublicAssets: true,
    /**
     * 方案 C：只读部署到 Vercel。
     * data.db 放在 public/data/ 下，Nitro 构建时会原样复制到 .output/public/data/data.db。
     * Vercel 上 serverless 函数可读取 public 目录（cwd=/var/task），路径稳定。
     * 无需 serverAssets/useStorage，纯文件系统读取，最可靠。
     */
    publicAssets: [
      {
        dir: './public/data',
        maxAge: 60 * 60 * 24 * 365,
        baseURL: '/data'
      }
    ]
  }
})