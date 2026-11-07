# 演唱会足迹（ilive_neo）开发文档

> Nuxt4 + Turso(LibSQL) 迁移版本 · 记录每一次演唱会的感动与回忆
>
> [English Version](./README_DEV_EN.md) | 中文文档
>
> 最近更新：**2026-11-07** —— 书册加载页、20 KB/s 慢网首屏、SSR HTML 压缩、测试体系与安全审查（见第 11 / 14 章）。

---

## 1. 项目简介

「演唱会足迹」是一个个人演唱会记录站点，从原纯静态站点（`index.html` + 原生 JS + 手写 Service Worker）迁移而来。本仓库（`ilive_neo`）在**保留原视觉效果 100% 一致**的前提下，将架构升级为：

- **Nuxt4**（SSR + Vue3 + TypeScript）
- **Turso / LibSQL** 数据库（远程 `libsql:` 为主，本地 `file:` 仅开发兜底）
- **@vite-pwa/nuxt** 生成 Service Worker（替代手写 `sw.js`）

> **Nuxt 4 目录约定**：`srcDir` 默认为 `app/`，`app.vue`、`pages/`、`composables/`、
> `plugins/`、`utils/`、`types/` 均位于 `app/` 下；`server/`、`public/`、`test/`、`i18n/`、
> `nuxt.config.ts` 位于项目根（多语言文案在 `i18n/locales/`，`@nuxtjs/i18n` 的 `langDir`
> 相对 `i18n/` 目录解析）。因此 vitest 的 `~`/`@` 别名指向 `app/`。

关键原则：

- **数据完全来自数据库 API**，前端不做静态数据降级。演唱会、城市、许愿数据一律从 `/api/*` 拉取。
- **语言切换零请求**：前端 `useI18n` + `pickLocale` 在已拉取的**多语言数据**上派生（zh / en / zh-Hant 三种），不额外请求。
- **多语言 SEO**：`app/app.vue` 统一输出 `<html lang>`、3 语言 `hreflang`（含 `x-default`）与 `og:locale` / `og:locale:alternate`；页面级 `title` / `description` 由 `app/pages/index.vue` 按 locale 输出。
- **数据库以远程 Turso 为准**：线上（Vercel）通过 `NUXT_TURSO_DATABASE_URL=libsql://...` 连接远程库；本地开发可回退到 `file:` SQLite。
- **首屏不依赖外部 CDN**：书册遮罩由 SSR 直出并内联关键 CSS，字体 / 图标样式延后到 `bodyClose`；动态 SSR HTML 由 Nitro 插件压缩（见第 11 章）。

---

## 2. 技术清单

| 类别 | 技术 |
|------|------|
| 框架 | Nuxt 4 (`^4.5`)、Vue 3 (`^3.5`)、Vue Router 5 |
| 数据库 | Turso / LibSQL (`@libsql/client ^0.17`) |
| PWA | `@vite-pwa/nuxt`（配置化 Service Worker，`/api/*` NetworkFirst）|
| 多语言 | `@nuxtjs/i18n` v10（3 语言：zh / en / zh-Hant，`strategy: prefix_except_default`，默认 zh 无前缀）|
| 语言 | TypeScript（`strict` 开启，构建期 `typeCheck: false`）|
| 动画 | GSAP 3.12.2（CDN，保留 SRI）|
| 样式 | `public/css/main.css`（手写工具类，已移除 Google Fonts `@import` 与旧 spinner）、Font Awesome 6.4.0（CDN，`bodyClose` 加载） |
| 首屏 | 全屏书册加载页（SSR 直出 + 内联关键 CSS）、Nitro `render:response` 动态 HTML brotli / gzip 压缩、系统字体栈兜底 |
| SEO | Nuxt 内置 `useSeoMeta` / `useHead`（多语言 hreflang / og:locale）+ 静态 `robots.txt` / `sitemap.xml` |
| 测试 | Vitest（单元测试，happy-dom，**28 文件 / 401 用例**）+ Playwright（E2E，**10 套件 / 69 用例**，桌面 / 移动双 project + CDP 20 KB/s 限速 + 零下载 Edge 模式）+ `verify-seo.mjs`（SSR head 校验脚本）|

### 核心依赖（package.json）

- `@libsql/client`：Turso / SQLite 客户端
- `@vite-pwa/nuxt`：PWA / Service Worker
- `@nuxtjs/i18n`（v10）：多语言路由 / SEO / vue-i18n 集成
- `nuxt`、`vue`、`vue-router`：框架
- 开发依赖：`vitest`、`@vue/test-utils`、`happy-dom`、`@nuxt/test-utils`、`@playwright/test`、`playwright`、`typescript`、`@types/node`

---

## 3. 目录结构

```
ilive_neo/
├── nuxt.config.ts             # Nuxt 总配置（SSR/runtimeConfig/head/PWA/SEO；关键 CSS / bodyClose 非关键 CSS / noscript 兜底）
├── playwright.config.ts       # E2E 配置（双 project、fixture 库种子、PLAYWRIGHT_USE_EDGE 零下载模式）
├── app/                       # [Nuxt 4 srcDir] 应用层
│   ├── app.vue                # 根组件（NuxtPage + 全局错误处理 + 全站语言 SEO：html lang/hreflang/og:locale）
│   ├── pages/
│   │   └── index.vue          # 首页「组合根」：SEO / JSON-LD、初始化编排、body 滚动锁 + 与内容区同级的 <SiteLoader />（363 行）
│   ├── components/            # 首页拆分出的展示组件（18 个，自 index.vue 抽出，各自直连共享 composable）
│   │   ├── AlbumShowcase.vue      # 3D 专辑轮播（含封面缩略图 + @error 回退）
│   │   ├── TicketModal.vue        # 票根模态（@tanstack/vue-virtual 按行虚拟滚动）
│   │   ├── CityModal.vue / GalleryModal.vue / VideoModal.vue / SonglistModal.vue
│   │   ├── HeroSection.vue / StoriesSection.vue / StatsCards.vue / TimelineSection.vue
│   │   ├── GuestbookSection.vue / WishWall.vue / SiteFooter.vue
│   │   ├── SiteLoader.vue        # 全屏书册加载页（SSR 直出 #loader、内联关键 CSS、15s 兜底需水合武装）
│   │   └── LanguageSwitcher.vue / MusicPlayer.vue / FeedbackButton.vue / BackToTopButton.vue
│   ├── composables/           # [核心] 全部交互逻辑（Vue composables）
│   │   ├── useBookLoader.ts   # 书册加载页时序调度 + 海报预取（纯 TS，假定时器单测）
│   │   ├── useData.ts         # SSR 按当前语言请求 /api/data?lang= 单语言本地化（服务端已本地化则透传，否则前端 localizeConcert）+ 点赞覆盖；本地化派生写入请求级共享快照（app:localized，只计算一次）
│   │   ├── useI18n.ts         # 多语言切换（zh / en / zh-Hant，useState 懒初始化）
│   │   ├── useGallery.ts      # 图片画廊（懒初始化缓存 localizedConcerts）
│   │   ├── useSonglist.ts     # 歌单弹层
│   │   ├── useTimeline.ts     # 时间线渲染
│   │   ├── useNavigation.ts   # 角色导航滚动
│   │   ├── useTicketModal.ts  # 票务模态框
│   │   ├── useAlbumShowcase.ts  # 专辑展示轮播（GSAP）
│   │   ├── useMusic.ts        # 背景音乐播放/暂停
│   │   ├── useKeyboard.ts     # 键盘手势
│   │   ├── useSharedState.ts  # 跨组件共享状态（useState 封装）
│   │   ├── useCountUp.ts      # 统计数字滚动（0 → 目标值，easeOutCubic 5s，每 120s 重播；SSR 透传真值、水合安全）
│   │   ├── useFriendLink.ts   # 友情链接
│   │   ├── useGuestbook.ts    # 留言板（分页列表 / 发布留言 / 发布回复 / 卡片·列表视图）
│   │   └── useAppError.ts     # 全局错误处理 + Toast
│   ├── plugins/
│   │   └── statis.client.ts   # 第三方统计注入（百度/GA/51.la，客户端插件）
│   ├── types/                 # 前端数据类型（i18n / concert / city / wish / friendLink / guestbook / seo）
│   │   ├── index.ts           # 汇总再导出（Locale / Localized* / Concert / City / Wish / AppData 等）
│   │   └── guestbook.ts       # 留言板领域模型（GuestbookMessage / GuestbookReply / GuestbookPage）
│   └── utils/
│       ├── config.ts          # 全局配置常量 CONFIG
│       ├── index.ts           # 工具函数（safeHtml / 时间格式化 / pickLocale / localize* / computeCityConcertCounts / firstSentence）
│       ├── thumb.ts           # 缩略图工具（thumbSrc：.jpg → _thumb.jpg；onThumbError：缺失回退原图）
│       └── seo.ts             # SEO 纯函数（hreflang / og:locale / 描述模板 / serializeJsonLd 安全序列化）
├── i18n/                      # [根目录] 多语言文案（@nuxtjs/i18n v10 布局，langDir 相对此目录）
│   └── locales/               # zh-CN.ts · en.ts · zh-Hant.ts（各语言 message，含 loadingBook 书册三语文案）
├── public/                    # 静态资源
│   ├── css/  main.css         # 全局样式（已移除 @import 与旧 spinner；首屏关键 CSS 独立可解析）
│   ├── img/  logo.jpg
│   ├── music/ bgm_cn.mp3 · bgm_en.mp3
│   ├── concert/  海报与现场照片
│   ├── data/data.db           # 本地 SQLite（开发兜底；线上走远程 Turso）
│   ├── robots.txt             # 爬虫规则 + sitemap 引用
│   └── sitemap.xml            # 站点地图（当前仅收录默认语言首页；多语言 hreflang 由页面 useHead 输出）
├── server/                    # Nitro 服务端
│   ├── api/
│   │   ├── data.get.ts        # GET /api/data（单端点聚合：concerts/cities/wishes/stats/seo/friendLinks + 点赞）
│   │   ├── like.post.ts       # POST /api/like（演唱会点赞/取消，按 IP 去重）
│   │   ├── concerts/[id].get.ts  # GET /api/concerts/:id（单场详情 + likes/liked）
│   │   ├── guestbook.get.ts   # GET /api/guestbook（分页读取已通过留言及其回复）
│   │   ├── guestbook.post.ts  # POST /api/guestbook（发布留言，提交即通过）
│   │   └── guestbook/reply.post.ts  # POST /api/guestbook/reply（发布回复，校验父留言存在且已通过）
│   ├── lib/
│   │   ├── turso.ts           # LibSQL 客户端单例（file:/libsql: 切换）
│   │   ├── db-config.ts       # 本地 file: 库路径解析（默认 public/data/data.db）
│   │   ├── mappers.ts         # 数据映射层 barrel（再导出 parse/concerts/seo/friendLinks/concertLikes/guestbook）
│   │   ├── parse.ts           # i18n JSON 列解析（parseI18n / parseTags / has，绝不抛错）
│   │   ├── concerts.ts        # 演唱会行类型 + mapConcert / fetchConcert / fetchAllConcerts
│   │   ├── seo.ts             # SEO_I18N_KEYS / SEO_FALLBACK / fetchSiteSeo（DB 优先 + 代码回退）
│   │   ├── friendLinks.ts     # 友情链接映射（含 href 协议白名单 sanitizeHref）
│   │   ├── concertLikes.ts    # 点赞读写（事务内切换 + COUNT(*) 自愈重算冗余列）+ getClientIp（按 IP 去重、可取消）
│   │   ├── guestbook.ts       # 留言/回复读写（仅读已通过；回复父留言校验；IN 批量取回复无 N+1）
│   │   ├── ua.ts              # 服务端 UA 解析（浏览器 / 系统）
│   │   ├── rateLimit.ts       # 每 IP 内存限流（点赞与留言写接口共用）
│   │   ├── locales.ts         # 语言定义（LOCALES）
│   │   └── htmlCompression.ts # 压缩纯逻辑（编码协商 / 是否压缩 / Vary 与响应头 / 错误页识别），单测覆盖
│   ├── plugins/
│   │   ├── init-db.ts         # Nitro 启动时幂等初始化（远程 Turso 跳过）
│   │   └── html-compression.ts # render:response 动态 SSR HTML br/gzip 压缩（错误页跳过，可开关关闭）
│   └── db/
│       ├── schema.sql         # 表结构（12 张表，可翻译字段为 *_i18n JSON 列）
│       └── seed.mjs           # 建空库脚本（DROP + CREATE，不含业务数据）
├── scripts/                   # 构建期脚本
│   └── gen-thumbs.mjs         # 递归遍历 public/concert/ 生成 600px 缩略图（_thumb.jpg，幂等；npm run thumbs）
├── verify-seo.mjs · dump-head.mjs · html-head.mjs   # SSR head / SEO 校验脚本（node 直接运行）
├── test/                      # 测试
│   ├── unit/                  # Vitest 单元测试（28 文件 / 401 用例；含 useBookLoader / htmlCompression / firstSentence）
│   ├── e2e/                   # Playwright 端到端测试（10 套件 / 69 用例，桌面/移动双 project + fixture 库种子）
│   │   ├── book-loader.spec.ts   # 书册加载页三语文案 / 目录 / 主题首句 / 淡出 / 窄视口
│   │   └── slow-network.spec.ts  # CDP 20 KB/s 限速、首屏关键路径、noscript 与 HTML 压缩语义
│   ├── ui-tests.md            # UI 验收清单（手动 + 自动化，第 18 节为加载页与慢网）
│   └── unit-tests.md / README.md
└── doc/
    ├── README_DEV.md          # 本文档（中文）
    └── README_DEV_EN.md       # English version
```

---

## 4. 核心架构与数据流

### 4.1 前端启动链路（Vue 化）

不再有经典脚本注入器。`app/pages/index.vue` 已由「巨型单文件」收敛为**组合根**（363 行，原 1374 行），
各展示区块拆为 `app/components/` 下的 **18 个子组件**；共享状态由 composable 的 `useState` 提供，
**子组件直接调用即可，无需 props 透传**：

```
app/pages/index.vue（组合根：只做协调）
  ├─ useData()             → useAsyncData('app-data') SSR 预取 GET /api/data?lang=<locale>
  ├─ useSeoMeta()/useHead() → 页面级 title/description/og/twitter + 仅 SSR 的 JSON-LD
  ├─ watch(currentLanguage) → 更新 document.title + 重新应用专辑布局
  ├─ onMounted             → initBgMusic / initDataLayout（时间轴渐显）
  ├─ watch([5 个模态 open 态]) → 任意弹窗打开时锁定 body 滚动（须留在协调层，不可下放到子模态）
  ├─ <template>            → 组合 18 个子组件 + 静态背景圈
  └─ <SiteLoader />        → 与内容区同级（避免祖先层叠上下文影响 position: fixed 全屏遮罩）

app/components/*.vue（各区块自管状态与生命周期）
  ├─ AlbumShowcase / TicketModal / CityModal / GalleryModal / VideoModal / SonglistModal
  ├─ HeroSection / StoriesSection / StatsCards / TimelineSection / GuestbookSection / WishWall
  └─ SiteFooter / SiteLoader / LanguageSwitcher / MusicPlayer / FeedbackButton / BackToTopButton
      各自按需调用 useData / useAlbumShowcase / useGallery / useTimeline / useGuestbook …

app/app.vue (setup)
  └─ useHead + useI18n    → 全站语言相关 SEO：<html lang>、canonical、3 语言 hreflang（含 x-default）、
                            og:locale / og:locale:alternate；与语言无关的静态 meta 留在 nuxt.config.ts
```

要点：

- **所有 composable 内的 `useState`/`useAsyncData` 必须懒初始化**（在 composable 函数体内调用，不可在模块顶层），否则 SSR 阶段报 `instance unavailable`。
- 语言切换**不重新请求 API**：`localizedConcerts` 等 computed 依赖 `currentLanguage`，切换只重算前端派生值，零网络请求。
- `app/pages/index.vue` 现为**组合根**：只保留页面级 SEO / JSON-LD、初始化编排与 body 滚动锁；交互与展示已拆到 `app/components/` 的 18 个子组件（各自直连共享 composable，**不用 props 透传** open 态，否则会产生响应式副本并与协调层的 watch 失联）。
- 全站语言 SEO（`<html lang>` / canonical / 3 语言 hreflang / `og:locale`）由 `app/app.vue` **单一发射**（覆盖所有页面）；`index.vue` **不再重复发射 hreflang**，其 SSR `useHead` 只输出本页独有的 JSON-LD。
- **本地化派生请求级共享（`useData` 的 `app:localized` 快照）**：`localizedConcerts/Cities/Wishes/counts` 写入请求级共享态，首个 `useData()` 实例注册一次同步 `watch`，语言切换**只计算一次**（而非「实例数 × N」次）。⚠️ 同步器的去重标记必须挂在**快照 ref 对象**上（而非 `.value`）—— 若放进会被 SSR 序列化的 `useState`，客户端水合后会误判「已注册」而不再注册 watch，本地化快照永不填充（表现为专辑区空白 / 页面 500）。
- **统计数字滚动（`app/composables/useCountUp.ts`）**：展示值是 `computed`——未播放时**惰性透传**目标值（不能在 setup 期取快照：SSR 阶段 `useAsyncData` 尚未 resolve 会取到 0，导致 SSR HTML 输出 0 且水合文本不一致）；客户端 `onMounted` 后下一帧归零并播放（默认 5s，easeOutCubic），可传 `repeatMs` 周期重播（首页为 120s）；命中 `prefers-reduced-motion` 时直接显示终值。
- **错误提示的上下文安全（`app/composables/useAppError.ts`）**：vue-i18n 的 `useI18n()` 在无组件实例时会**直接抛** `Must be called at the top of a 'setup' function`。因此错误文案解析器**只在 setup 阶段注册**，之后 watch / 事件回调 / 全局监听复用它——`handleError(err, ctx, showUser=true, messageKey)` 在回调里可安全调用；新增回调时请勿在其中直接解析 i18n。
- **时间轴 observer 生命周期（`app/composables/useTimeline.ts`）**：`IntersectionObserver` 会**强引用**被 observe 的节点。宿主卸载（`onScopeDispose`）时 `disconnect` 并置空单例，且每次 `initTimelineReveal()` 都先 `disconnect` 再按当前 DOM 重新 observe，避免语言切换重建页面后旧 DOM / 图片节点无法回收。
- **书册加载页与首屏解耦**（详见第 11 章）：`SiteLoader.vue` 由 SSR 直出 `#loader` 并内联关键 CSS，不等待 JS 水合或外部 CDN 样式；15s CSS 兜底仅在 `onMounted` 水合成功后由 `html.book-loader-armed` 武装，慢网下不会提前隐藏遮罩。

### 4.2 服务端数据层

- `GET /api/data`（`server/api/data.get.ts`）：**单端点聚合**，一次返回 `{ concerts, cities, wishes, stats }`。城市场次数复用同一份 concerts 计算（`computeCityConcertCounts`），消除原多端点重复全量查询。
- **两层缓存 + 响应缓存策略**：内层 `defineCachedEventHandler`（生产 1h SWR）只产出与请求者无关的共享数据；外层非缓存，按当前 IP 合并 `liked` 后返回。两点必须注意：
  1. 内层会把缓存条目自带的 `cache-control`（`s-maxage=3600`）写到同一个 event 的响应上，**外层必须显式覆盖为 `private, no-store`**，否则 CDN / 边缘 / nginx 会把「某个 IP 的点赞态」缓存 1 小时并发给其他人；`etag` / `last-modified` 保留以维持条件请求。
  2. 命中条件请求（`If-None-Match` / `If-Modified-Since`）时，Nitro 会自行写入 304 并结束响应、向调用方返回 **`undefined`**，外层须先判空再解引用（否则生产环境抛 `TypeError`；dev 走未缓存分支不会复现）。
- `server/lib/mappers.ts`：`fetchAllConcerts` 把归一化 DB 行（`*_i18n` JSON 列）映射为**多语言结构**（`artist: { zh, en, 'zh-Hant' }`、`location` / `tags` / `songlist` 等同构，由 `parseI18n` / `joinLocation` 解析）；`computeCityConcertCounts` 计算每城市场次数。`mapConcert` 已 `export` 供单测使用。
- 前端 `useData.ts` 的 `pickLocale` / `localizeConcert` 根据 `currentLanguage` 把多语言结构**选为单语言字段**（如 `artist: "五月天"`）；目标语言缺失时按 `请求语言 → zh → en` 回退链兜底（`app/utils/index.ts`，纯函数可直接单测）。

```
useAsyncData('app-data') → GET /api/data
  ├─ concerts[]   (多语言: artist.{zh,en,zh-Hant}, location 等同构)
  ├─ cities[]     (name 多语言 + icon + concerts 场次数)
  ├─ wishes[]     (content 多语言 + likes + liked)
  └─ stats        { totalConcerts, totalArtists, totalCities }
        ↓
localizedConcerts (computed, 按 currentLanguage 选单语言)
```

- 留言板（`server/lib/guestbook.ts`）：`guestbook`（主留言）+ `guestbook_reply`（回复）两张表；写入即 `is_approved=1`（自动通过），回复先校验父留言存在且已通过（否则返回 `null` → 接口 404）；读取仅返回已通过内容，本页回复用一条 `IN (...)` 批量取回（无 N+1）。邮箱仅入库、不对外返回；浏览器/系统/IP 由服务端采集（`ua.ts` / `getClientIp`）。
- `server/lib/turso.ts`：`getTursoClient()` 惰性创建全局单例客户端。根据 `runtimeConfig.turso.databaseUrl` 自动切换：
  - `libsql://xxx.turso.io` → 远程 Turso（生产/线上，需 `NUXT_TURSO_AUTH_TOKEN`）
  - `file:./public/data/data.db` → 本地 SQLite（开发兜底）
  - 写操作仅限点赞（`/api/like`）与留言板（`/api/guestbook`、`/api/guestbook/reply`），其余为 SELECT；`createClient` 不做 `readOnly` 配置。
- `server/plugins/init-db.ts`：Nitro 启动时幂等初始化——**仅当本地 `file:` 且 `concerts` 表不存在时**建空表；**远程 Turso 直接跳过**（避免误建本地空库）。

### 4.3 SEO 动态元信息

`app/pages/index.vue` 中：

- `useSeoMeta` 随 `currentLanguage` 动态输出 title/description/og/twitter。
- **keywords/description 从数据库艺人动态生成**：`localizedConcerts` 提取去重 `artist`，随演唱会增减自动更新。
- `useHead`（仅 `import.meta.server`）注入 **JSON-LD 结构化数据**（WebSite + Person + ItemList + MusicEvent）。注意：hreflang / canonical / `og:locale` 已由 `app/app.vue` 统一发射，**此处不再重复**（旧实现两侧同 key 去重，实为冗余）。
- JSON-LD 用 `JSON.parse(JSON.stringify(toRaw(...)))` 剥离 Vue 响应式 Proxy，用 `computed` 保证在数据就绪后输出完整演唱会列表。
- **JSON-LD 安全序列化**：`innerHTML` 一律经 `app/utils/seo.ts` 的 `serializeJsonLd()`（把 `< > &` 与 U+2028 / U+2029 写成 JSON `\u` 转义），不再直接用 `JSON.stringify`：演唱会名来自 DB，含 script 闭合标签时会提前结束 ld+json 块，造成 SSR 存储型 XSS。unhead 当前的隐式转义不作为安全边界；回归见 `test/unit/seo-utils.test.ts` 与 `test/e2e/security.spec.ts`（详见 14.4）。

### 4.4 首页悬浮按钮：背景音乐 & universe 外链

首页右下角悬浮区有两个圆形按钮，均由 `app/components/MusicPlayer.vue` 渲染（自 `index.vue` 抽出）：

- **背景音乐按钮**：由 `useMusic` 驱动（见 4.1），Font Awesome 音符图标，点击循环切换播放/暂停。
- **universe 外链按钮（宇宙主题）**：紧邻音乐按钮，是一个静态外链 `<a class="music-btn xy-btn" target="_blank" rel="noopener noreferrer" href="http://iliveworld.lyc.la">`，点击在新标签页打开 `http://iliveworld.lyc.la`。
  - 图标为**内联 SVG**（`.xy-icon`，写在 `MusicPlayer.vue` 内）：渐变圆角方块背景（横向紫粉渐变 `#C896B2 → #D993A7`，取自设计稿图片采样色值）+ 白色「星球 + 星环 + 小星星」图形（贴合「universe / 宇宙」主题）。
  - ⚠️ `<audio id="bgMusic">` / `<source id="bgMusicSource">` 的 **id 必须保留**：`useMusic` 的 `initBgMusic` 与语言切换换源均按 id 取元素。
  - 悬浮提示文案取自 i18n `tooltips.universe`，三语言（zh-CN / en / zh-Hant）均需维护该 key。
  - 基础样式在 `public/css/main.css` 的 `.xy-btn` / `.xy-icon`（复用 `.music-btn` 的圆形容器与悬浮脉冲动画）。

---

## 5. 数据库

### 5.1 表结构（`server/db/schema.sql`）

| 表 | 说明 |
|----|------|
| `concerts` | 演唱会主表（可翻译字段为 `*_i18n` JSON 列） |
| `concert_tags` | 演唱会标签（`concert_id` 外键，`tag_i18n`） |
| `concert_images` | 演唱会图片（`src` + `alt_i18n`） |
| `concert_songlist` | 演唱会歌单（`seq` 排序 + `name_i18n` + `link`） |
| `cities` | 城市表（`name_i18n` + `icon`） |
| `wishes` | 许愿墙（`content_i18n` + `likes` + `liked`） |
| `concert_likes` | 演唱会点赞（`concert_id` + `ip` + `created_at`，`UNIQUE(concert_id, ip)` 按 IP 去重、可取消） |
| `friend_links` | 友情链接（`href` + `icon` + `title_i18n` + `description_i18n` + `seq` + `enabled`） |
| `site_settings` | 站点设置（如 `site_url`，优先于环境变量） |
| `site_seo_i18n` | 站点 SEO 多语言（`site_title` / `site_description` / `site_keywords` 等） |
| `guestbook` | 留言板主留言（`nickname` + `email` + `content` + 服务端采集 `browser`/`os`/`user_agent`/`ip` + `is_approved`） |
| `guestbook_reply` | 留言回复（`guestbook_id` 外键级联删除 + `nickname` + 可选 `email` + `content` + 服务端采集字段 + `is_approved`） |

所有可翻译字段统一为 **`*_i18n` JSON 列**，形如 `{"zh-CN":"…","en":"…","zh-Hant":"…"}`（由 `parseI18n` 解析，`zh-CN` 为基语言，缺失语言在 UI 层回退；历史库若残留 `ja`/`ko` 键不参与展示）。`location` 由 `country/province/city/venue` 四段拆分存储，映射时按 **`国家 · 省 · 市 · 场馆`** 逐语言重组（`mappers.ts` 的 `joinLocation` / `mapLocationDetail`，空段自动省略，不跨语言回退）。

### 5.2 初始化

```bash
npm run db:seed   # 或 npm run db:init（等价）—— 先 DROP 后 CREATE，得到空库
```

`seed.mjs` 会**先 DROP 后 CREATE**（按外键依赖顺序），得到一个空库。业务数据由外部导入（SQL / 工具）写入，脚本本身不填充数据。

库结构变更以 `schema.sql` 为**单一真源**：历史上的一次性迁移脚本（双语列 → `*_i18n`、`likes` 冗余列等）已全部移除。已有数据库（本地 `data.db` / 生产 Turso，需 `NUXT_TURSO_DATABASE_URL` / `NUXT_TURSO_AUTH_TOKEN` 且**具写权限**）如需对齐新增表（`guestbook` / `guestbook_reply` / `site_settings` / `site_seo_i18n` / `friend_links` 等），直接执行 `schema.sql` 即可（其为 `CREATE TABLE/INDEX IF NOT EXISTS`，幂等可重复执行），无需迁移脚本。

---

## 6. 环境变量

### 6.1 配置项

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NUXT_TURSO_DATABASE_URL` | 数据库 URL（`libsql:` 远程 或 `file:` 本地） | `file:./public/data/data.db` |
| `NUXT_TURSO_AUTH_TOKEN` | 远程 Turso 鉴权 token | 空 |
| `NUXT_TRUST_PROXY` | 是否信任 `X-Forwarded-For`（**自建**反代 / CDN 前置时设 `true`；Vercel 自动处理，无需设置） | 空（关闭） |
| `VERCEL` | 由 Vercel 平台**自动注入**（`=1`），用于识别平台并优先取 `x-vercel-forwarded-for` | 平台注入 |
| `NUXT_DISABLE_HTML_COMPRESSION` | `=1` 时关闭 `server/plugins/html-compression.ts` 的 SSR HTML 压缩（部署在已压缩的反代 / CDN 之后，避免双重压缩） | 空（启用压缩） |
| `PLAYWRIGHT_USE_EDGE` | `=1` 时复用系统 Edge 跑 E2E，零浏览器下载；同时关闭依赖 ffmpeg 的录屏 / trace / 失败截图 | 空（用自带 Chromium） |
| `PLAYWRIGHT_DOWNLOAD_HOST` | Playwright 浏览器下载镜像（国内可用 `https://cdn.npmmirror.com/binaries/playwright`） | 官方 CDN |
| `E2E_PORT` / `E2E_DB_FILE` | E2E 隔离 dev server 端口 / fixture 库绝对路径（真实库全程只读） | `3000` / `%TEMP%\ilive-e2e\e2e-data.db` |

> **关键**：必须用 **`NUXT_` 前缀**，Nuxt 才会在**运行时**覆盖 `runtimeConfig.turso.*`。若用 `TURSO_` 前缀，`nuxt.config.ts` 求值时 `process.env` 可能读不到，导致落回本地 `file:` 默认值。

### 6.2 本地开发（`.env`）

```bash
# 远程 Turso（推荐）
NUXT_TURSO_DATABASE_URL=libsql://your-db-name.turso.io
NUXT_TURSO_AUTH_TOKEN=your-token

# 或本地 SQLite（免注册）
# NUXT_TURSO_DATABASE_URL=file:./public/data/data.db
```

> ⚠️ Nuxt 4（自 3.15 起）**只加载 `.env`，不加载 `.env.local`**。配置必须放在 `.env`。
> ⚠️ `.env` 含密钥，**必须加入 `.gitignore` 且不可提交**。若被 `git ls-files` 跟踪，立即 `git rm --cached .env` 并**更换 token**（历史提交仍保留旧 token）。

### 6.3 Vercel 部署（环境变量）

在 Vercel 项目后台 **Settings → Environment Variables** 配置：

```
NUXT_TURSO_DATABASE_URL=libsql://your-db-name.turso.io
NUXT_TURSO_AUTH_TOKEN=your-token
```

`.env` 不会上传（gitignore 忽略），Vercel 构建/运行时依赖这些后台变量连接 Turso。

### 6.4 测试环境与压缩开关

```powershell
# 零下载跑 E2E（本机未装 Playwright 自带浏览器时，复用系统 Edge）
$env:PLAYWRIGHT_USE_EDGE = '1'
npm run test:e2e

# 用国内镜像安装最小浏览器组件（替代慢速官方下载）
$env:PLAYWRIGHT_DOWNLOAD_HOST = 'https://cdn.npmmirror.com/binaries/playwright'
npx playwright install chromium-headless-shell ffmpeg

# 关闭 SSR HTML 压缩（前置反代 / CDN 已压缩时）
$env:NUXT_DISABLE_HTML_COMPRESSION = '1'
```

> `NUXT_DISABLE_HTML_COMPRESSION` 只影响动态 SSR HTML；`nitro.compressPublicAssets` 的静态资源压缩不受影响。E2E 通过 `NUXT_TURSO_DATABASE_URL` 指向隔离 fixture 库，真实库 `public/data/data.db` 全程只读。

---

## 7. 开发命令

```bash
npm install        # 安装依赖（含 postinstall: nuxt prepare）
npm run dev        # 启动开发服务器（默认 http://localhost:3000/）
npm run build      # 生产构建（Nitro，可部署到 Vercel）
npm run preview    # 预览生产构建
node .output/server/index.mjs  # 直接启动生产构建（用 PORT 指定端口，如 $env:PORT='3100'）
npm run generate   # 生成静态站点（SSG）
npm run db:seed    # 初始化本地空库（DROP + CREATE，⚠️ 破坏性）
npm run test       # 运行单元测试（vitest run，28 文件 / 401 用例）
npm run test:watch # 监听模式运行测试
npm run test:e2e   # 运行端到端测试（Playwright，10 套件 / 69 用例；自动 seed fixture 库并启动隔离 dev server）
npx playwright test --list     # 仅列出用例，核对套件 / 用例数
npm run thumbs     # 递归生成 public/concert/ 下缺失的缩略图（_thumb.jpg，幂等；新增图片后一键补齐）
```

> ⚠️ `.output` 累积数百文件后，重复构建的清空动作可能触发 IDE 批量删除保护；先清理 `.output` 目录再构建（详见 `test/README.md` 第六节）。
> E2E 与 vitest **不要同批并行**：`playwright.config.ts` 串行执行（`workers: 1`），并行会抢 dev server / fixture 库资源。

---

## 8. API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/data` | 单端点聚合：演唱会（含 `likes` / `liked`）+ 城市 + 许愿 + 统计 + SEO + 友链；可选 `?lang=<locale>` 直接返回单语言本地化结果，响应含 `locale` 字段（= 请求语言或 null） |
| GET | `/api/concerts/:id` | 单场详情（含 tags/images/songlist 与 `likes` / `liked`），非法 id 400、未找到 404 |
| POST | `/api/like` | 演唱会点赞/取消（body `{ id }`，按 IP 去重可反复切换），返回 `{ id, likes, liked }`；非法 id 400、未找到 404 |
| GET | `/api/guestbook` | 分页读取已通过留言及其已通过回复（`?page=` / `?pageSize=`，默认 9、上限 50） |
| POST | `/api/guestbook` | 发布留言（body `{ nickname, email, content }`，提交即自动通过），返回 `{ id, ok }`；字段非法/超限 400、超频 429 |
| POST | `/api/guestbook/reply` | 发布回复（body `{ guestbookId, nickname, content, email? }`，邮箱可选），父留言不存在/未通过 404 |

> 前端调用 `/api/data`、`/api/concerts/:id`、`POST /api/like` 与留言板三接口（`GET /api/guestbook`、`POST /api/guestbook`、`POST /api/guestbook/reply`）。
> 点赞计数并入 `/api/data`（不新增 GET 请求）；为避免共享缓存把「按 IP 的 liked」串给其他访问者，
> `/api/data` 拆为「内层缓存共享数据 + 外层按 IP 合并 liked」，并覆盖响应头为 `private, no-store`；
> 命中条件请求时内层返回 `undefined`（Nitro 已响应 304），外层判空后提前返回。
>
> **`POST /api/like` 的写入在交互式事务内完成**（`client.transaction('write')`，等价 `BEGIN IMMEDIATE`）：
> `DELETE → INSERT → 计数 ±1` 存在「先读后写」依赖，任一语句失败即整体回滚。
> 冗余计数 `concerts.likes` 是**独立的历史基数**（人工维护，反映线下 / 历史累计等来源，其值不必等于 `concert_likes` 行数），
> 因此以 `UPDATE concerts SET likes = MAX(0, COALESCE(likes,0) + ?)` **在做增减**（新增 +1、取消 −1，`MAX(0,…)` 兜底不为负）；
> **切勿改成按 `(SELECT COUNT(*) …)` 重算**——那会在任意一次点击时把几千的基数清零为极小的真实行数（表现为「点赞数时不时突变」）。
> 未迁移库缺少该列时回退实时 `COUNT(*)`，**其它写失败会向上抛**（由前端乐观回滚 + Toast 兜底）。

---

## 9. SEO

### 9.1 静态配置（`nuxt.config.ts`）

- `SITE_URL = 'https://ilive.lyc.la'`，og:url / canonical / og:image / twitter:image 统一为 **https**。
- `app.head` 只保留**与语言无关**的静态信息：`author` / `robots` / `referrer` / `og:type` / `og:url` / `og:image` / `twitter:card` / `twitter:site` / `twitter:creator` / `twitter:image`，以及 favicon / stylesheet / GSAP 等资源引用。
- **资源加载策略（首屏关键路径）**：`<head>` 只保留 `/css/main.css` 一张关键样式表（`main.css` 已移除 `@import`）；Inter / FontAwesome 的 stylesheet 用 `tagPosition: 'bodyClose'` 延后，`fonts.googleapis.com` / `fonts.gstatic.com` 保留 `preconnect`，字体以 `display=swap` + 系统字体栈兜底；GSAP 保留 SRI。`noscript` 内置 15s 隐藏遮罩规则，**必须自行包 `<style>`**（`innerHTML` 是裸内容，否则 CSS 会被当文本渲染），详见第 11 章。
- 原硬编码中文的 `title` / `keywords` / `description` / `og:title` / `og:description` / `twitter:title` / `twitter:description` **已全部移除**（避免与页面级 `useSeoMeta` 重复或冲突）。
- 语言相关 meta：`og:locale` / `og:locale:alternate` 由 `app/app.vue` 输出；`og:site_name` 由页面级 `useSeoMeta` 输出。

### 9.2 静态文件

- `public/robots.txt`：允许所有爬虫，`Disallow: /api/`，引用 sitemap。
- `public/sitemap.xml`：当前仅收录默认语言首页（`https://ilive.lyc.la/`，含 `zh-CN` 一条 `xhtml:link` 备用链接）。3 语言 hreflang 由 `app/app.vue` 在页面 head 中**统一输出**（覆盖所有页面），不依赖 sitemap。

### 9.3 动态元信息（`app/pages/index.vue`）

- `useSeoMeta`：随语言输出 title/description/og/twitter，keywords/description 从数据库艺人动态生成（3 种语言的描述模板见 `app/utils/seo.ts`）。
- JSON-LD：WebSite + Person + ItemList + MusicEvent（每场演唱会）。
- hreflang / canonical：`zh-CN` / `en` / `zh-Hant` + `x-default`（默认语言 `zh` 的 href 为 `https://ilive.lyc.la/`，无 `/zh` 前缀）—— 由 `app/app.vue` 统一发射，页面不再重复。
- `<html lang>` 与 `og:locale` / `og:locale:alternate`：由 `app/app.vue` 统一输出（`app/utils/seo.ts` 的 `LOCALE_LANG` / `toOgLocale` / `buildHreflangLinks` / `toLocaleUrl` 纯函数）。

---

## 10. PWA / Service Worker

由 `@vite-pwa/nuxt` 在 `nuxt.config.ts` 的 `pwa` 字段配置化生成：

- `registerType: 'autoUpdate'`，`injectRegister: 'inline'`
- `devOptions.enabled: false`（开发环境默认不启用 SW）
- Workbox 运行时缓存策略：
  - 图片：`StaleWhileRevalidate`
  - CSS/JS：`NetworkFirst`
  - `/api/*`：`NetworkFirst`（保证实时从数据库获取，离线回退缓存）

### 10.1 图片懒加载与响应式优化

站点含 300+ 张静态 jpg（海报 + 画廊）。当前已实现：

- **3D 专辑封面**（`app/components/AlbumShowcase.vue`）：3D 轮播会一次性渲染**全部**封面，故统一改用 **600px 缩略图**（`thumbSrc()`：`xxx.jpg` → `xxx_thumb.jpg`），避免下载全分辨率原图（188KB–1.4MB/张）；缩略图缺失时由 `@error` 回退原图。选中项（首屏 LCP 候选）`loading="eager"` + `fetchpriority="high"`，其余 `loading="lazy"` + `fetchpriority="low"`，统一 `decoding="async"`。
- **画廊缩略图**：`loading="lazy"` + `decoding="async"`，`.gallery-item` 固定 `width/height`（120×80，移动端 100×67）防 CLS。
- **票根海报**（`app/components/TicketModal.vue`）：`<img class="ticket-poster">` + 缩略图（同样走 `thumbSrc()`，缺失 `@error` 回退原图）；**不使用** `loading="lazy"`——虚拟滚动已限制 DOM 数量，且懒加载在「`.ticket-modal` 默认 `display:none` → 打开切换」下可能不触发实际加载（图片被判定为离屏）。`decoding="async"` 保留。
- **缩略图生成**（`app/utils/thumb.ts` 配套）：`scripts/gen-thumbs.mjs`（`npm run thumbs`）递归遍历 `public/concert/` 的**全部子目录**（poster + 各 `<date>` 画廊），为缺 `_thumb` 变体的原图生成 600px / q72 缩略图，**幂等**（已存在则跳过）；新增图片后一键补齐。前端 `thumbSrc()` 与脚本命名约定严格对应（`_thumb.jpg`）。

> 可选后续（资产级改造，未落地）：将 jpg 转码为 **WebP/AVIF** 并使用 `<picture>` + `srcset` 适配分辨率；或引入 `@nuxt/image` 统一处理响应式图与转码。收益取决于构建/部署管线，改动较大，按需评估。

### 10.2 票根列表虚拟滚动（Ticket virtual scroll）

票根模态框原多列 Grid 一次性渲染全部卡片，数据增长会持续放大 DOM 与图片开销。改为基于 `@tanstack/vue-virtual` 的**按行窗口化渲染**：仅渲染视口附近卡片行（含 `overscan`），保留多列网格视觉。

- **`count` 必须是数字，且 options 必须整体包成 `computed`**（两个坑，缺一不可）：
  1. `count` **传函数**（如 `() => rowCount.value`）会让库内部对 `count` 做 `new Array(count)` / `count - 1`，得到 `NaN` 并抛 `RangeError: Invalid array length`，列表整体空白。
  2. 但**只写 `count: rowCount.value` 且 options 传普通对象同样会出错**：库内部是 `computed(() => ({ ...defaults, ...unref(options) }))`，普通对象在 **setup 期**即被求值，`count` 被钉死为静态数字，之后 `rowCount` 变化**不会**触发 `setOptions`。语言切换会重建页面组件、而新语言数据在 setup 之后才到达，此时 `count` 取到 0 且永不更新 —— 表现为「**切换语言后打开票根模态空白**」。
  - 正确写法：`useVirtualizer(computed(() => ({ count: rowCount.value, getScrollElement: …, estimateSize: …, overscan, gap })))` —— `count` 仍是**数字**，响应式由外层 `computed` 提供（库签名是 `MaybeRef<Options>`，支持传 `Ref`）。
- **动态行高测量**：卡片高度随内容浮动（约 660–720px），固定 `estimateSize` 会导致行重叠。通过 `measureElement` + 行元素上的 `:data-index` 与 `:ref="setTicketRowRef"`，让虚拟器取真实行高；`estimateSize` 仅作首屏估算。
- **固定行间距**：用虚拟器 `gap` 选项（`ROW_GAP`）在行间插入统一间距，比单纯调大 `estimateSize` 更稳，杜绝行重叠。
- **`useVirtualizer` 返回 `shallowRef`**：`<script>` 中访问实例方法需 `virtualizer.value?.<method>()`（模板会自动解包，可直接写 `virtualizer.getVirtualItems()`）；打开模态框时容器尺寸从 0 变化，在 `watch(ticketModalOpen)` 的 `nextTick` 里 `computeColumns()` / `computeRowHeight()` 并 `virtualizer.value.measure()` 重算。

---

## 11. 书册加载页、首屏关键路径与慢网（2026-11-07）

> 背景：慢网实测下首页 SSR HTML 约 248 KB（其中 Nuxt payload 约 121 KB），跨域字体 / 图标 CSS 串行阻塞解析，书册封面曾要十几秒才绘制；旧 15s CSS 兜底从「页面开始加载」计时，JS 尚未水合时还会提前隐藏遮罩。本轮以「最小改动组合」落地 P0 三项，并用 20 KB/s 自动化回归固化。

### 11.1 书册加载页（SiteLoader）

- `app/components/SiteLoader.vue`：旧 spinner 重写为全屏书册（封面 / 左页目录 / 右页演出详情 / 底部进度条），桌面双页、窄视口单页迷你目录；无按钮、无跳过提示，`aria-busy="true"`，`:data-finish` 输出 `ready | timeout | error` 便于排查。
- SSR 直出 `#loader` 并**内联关键 CSS**（不等 JS 水合、不等外部 CDN）；`<SiteLoader />` 与首页内容区同级，避免祖先层叠上下文影响 `position: fixed`。
- 数据全部来自 `/api/data`：目录行数 / 年份、右页演出信息；引文为当前语言 `theme` 的**第一句话**（`app/utils/index.ts` 的 `firstSentence()`：先按换行取首段，再按中英文句末标点切分，英文句点需后接空格 / 大写 / 中文才切）；海报走 `thumbSrc()` 的 `_thumb.jpg`。三语文案在 `i18n/locales/*.ts` 的 `loadingBook`（已移除 `tocFoot` 与静态 `quotes`）。
- 时序与预取抽到 `app/composables/useBookLoader.ts`（纯 TS + 假定时器单测）：

| 常量 | 值 | 作用 |
|------|-----|------|
| `BOOK_COVER_MS` | 900 ms | 封面停留 |
| `BOOK_WINDOW_MS` | 12.6 s | 翻页窗口，页间隔二次递减 `G_MAX 1.32s → G_MIN 0.32s` |
| `BOOK_MIN_SHOW_MS` | 2.4 s | 最短可感知窗口；SSR 数据已就绪也不能瞬间淡出 |
| `BOOK_MAX_MS` | 13.5 s | 硬上限，`timeout` 强制淡出 |
| `BOOK_FADE_MS` | 900 ms | 淡出后移除遮罩，合计 < 15 s |

`setReady()` 过最短窗口即 `finish('ready')`；`setFailed()` 立即 `finish('error')`；整本翻完仍未就绪按 `timeout` 收口。`createPosterPrefetcher()` 去重 + `warmAround()` 预热当前 / 下一页 + `requestIdleCallback` 低优先级补齐。

> ⚠️ `clearAll()` 用 `timers.forEach(...)` 而非 `for...of` 遍历 `Set`：低 TS target 下后者需要 `downlevelIteration`，构建会报错。

### 11.2 首屏关键路径（P0 三项）

1. **外部 CSS 移出关键路径**：删除 `main.css` 首行 Google Fonts `@import` 与旧 `.loader/.spinner`；`nuxt.config.ts` 把 Inter / FontAwesome 的 stylesheet 改为 `tagPosition: 'bodyClose'`，保留 `preconnect` 与 `display=swap` + 系统字体栈。head 只留 `/css/main.css`，20 KB/s 下遮罩随 SSR 内联 CSS 立即生效。
2. **修正 15s CSS 兜底计时起点**：`:global(html.book-loader-armed) .bk-loader { animation: bk-failsafe 0s linear 15s forwards }` —— 仅 `onMounted`（水合成功）后加 `book-loader-armed`，`finish` / 卸载移除；无 JS 时由 `nuxt.config.ts` 的 `noscript > <style>` 规则兜底，仍不会永久盖住首页。
3. **SSR HTML 压缩**：见 11.3。

> 注释里也不要写 `@import` 字面量：静态检测曾因注释中的字样误判 `main.css` 仍有导入声明。

### 11.3 SSR HTML 压缩（`server/plugins/html-compression.ts`）

- `nitro.compressPublicAssets` 只压 `public/**` 静态资源，动态 SSR HTML 仍是明文。插件在 `render:response` 按 `Accept-Encoding` 做 brotli（优先，quality 5）/ gzip（level 6），**异步**压缩；实测首页约 248 KB → **47 KB (br) / 63 KB (gzip)**。
- 纯逻辑在 `server/lib/htmlCompression.ts`（`negotiateEncoding` / `shouldCompress` / `mergeVary` / `resolveStatusCode` / `isNuxtErrorRender` / 大小写不敏感响应头工具），由 `test/unit/htmlCompression.test.ts` 覆盖 19 例。
- 缓存 / 协商语义：所有 HTML 统一声明 `Vary: Accept-Encoding`；解析 q 值与 `q=0`、`*` 通配，br 优先；仅压 `200 + text/html + 字符串 body + ≥ 1 KB + 未编码`；压缩后删除 `ETag` / `Last-Modified` / `Content-Length`，避免 CDN 把 br 版本复用给仅支持 gzip 的客户端。`NUXT_DISABLE_HTML_COMPRESSION=1` 可关闭。
- ⚠️ **404 / 500 错误页必须跳过压缩**：Nuxt 把错误页交给内部 `/__nuxt_error?...&statusCode=404` 路由渲染，`render:response` 触发时 `response.statusCode` 与 `event.node.res.statusCode` **都还是 200**，真实状态只在该内部路径上；且错误渲染路径会把压缩后的 `Buffer` 当作字符串按 UTF-8 重新编码（非法字节替换为 U+FFFD），客户端报 `failed to decompress 'br' encoding`。现由 `isNuxtErrorRender()` 显式识别并跳过，错误页保持明文。

### 11.4 20 KB/s 慢网回归与测试隔离

- `test/e2e/slow-network.spec.ts`：CDP `Network.emulateNetworkConditions` 模拟 **20 KB/s 下行 / 500 ms RTT**，断言遮罩立即成为 fixed 全屏、水合前不被 15s 兜底提前隐藏、恢复带宽后正常淡出；另断言 head 无阻塞外部 CSS、`noscript` 含 `<style>`，以及压缩语义（200 页 br 可解压 / 404 明文 / `q=0` 不压缩）。
- dev server 会把 Vue 依赖拆成大量模块请求，全程限速时水合无法在 120 s 用例超时内完成 → **仅首屏关键路径阶段限速约 8 s**，随后恢复带宽继续验证水合与淡出。
- `test/e2e/book-loader.spec.ts`（6 例）覆盖三语文案、目录数量 / 年份、主题首句、无按钮、进度条、淡出与窄视口单页书册。
- 写状态隔离：E2E 串行共享 fixture 库，点赞限流用例改用**不存在的演唱会 id**（限流判定早于存在性校验，仍触发 429 但零写库），`ui-structure.spec.ts` 的点赞数以 `/api/data` 当前值为动态基准，避免前序用例改动造成假失败。

---

## 12. 部署（Vercel）

1. 在 Vercel 后台配置 `NUXT_TURSO_DATABASE_URL` / `NUXT_TURSO_AUTH_TOKEN`。
2. 绑定域名 `ilive.lyc.la`（Vercel 自动提供 HTTPS SSL）。
3. 推送代码，Vercel 执行 `nuxt build` 生成 Nitro serverless 产物。
4. `public/robots.txt` / `sitemap.xml` 会被 Nitro 打包为静态文件。
5. 首次部署后访问 `/api/data` 确认返回远程 Turso 数据。
6. **真实客户端 IP**：Vercel 运行时自动注入 `VERCEL=1`，`getClientIp()` 会优先取平台覆写的 `x-vercel-forwarded-for`（单值、不可伪造），因此点赞去重 / 限流 / 留言板 IP 采集**无需**额外配置 `NUXT_TRUST_PROXY`。
7. **压缩**：`nitro.compressPublicAssets: true` 已开启，`public/**` 静态资源自动压缩；动态 SSR HTML 由 `server/plugins/html-compression.ts` 按 `Accept-Encoding` 做 br / gzip（约 248 KB → 47 KB），并统一 `Vary: Accept-Encoding`。若 Vercel / CDN 已开启 HTML 压缩，设 `NUXT_DISABLE_HTML_COMPRESSION=1` 避免双重压缩；404 / 500 错误页由插件保持明文（见 11.3）。

---

## 13. 注意事项

- `file:` 本地库相对路径基于 `process.cwd()`（Nuxt 根目录）解析，勿在别处运行导致库文件位置漂移。
- `init-db.ts` 用 `process.cwd() + 'server/db/schema.sql'` 定位 schema，因为 Nitro 编译后 `__dirname` 指向产物而非源码树。
- 所有 `useState`/`useAsyncData` 必须在 composable 函数体内（懒初始化），**禁止模块顶层调用**，否则 SSR 报 `instance unavailable`。
- **环境变量必须用 `NUXT_` 前缀**；`TURSO_` 前缀在 config 求值阶段可能读不到。
- **远程 Turso 时 `init-db.ts` 跳过建库**，避免误建本地空库文件。
- `concert_likes` 已加索引 `idx_concert_likes_ip`（按 `ip` 查询点赞集合/统计加速）。**存量本地库**需在 `schema.sql` 变更后手动执行 `CREATE INDEX IF NOT EXISTS idx_concert_likes_ip ON concert_likes(ip);`（或重跑 `npm run db:seed` 破坏性重建）方生效。
- **留言板为写接口**：`POST /api/guestbook` 与 `POST /api/guestbook/reply` 会写库（提交即 `is_approved=1`），本地 `file:` 模式需保证库文件可写；线上 Turso 需写权限。
- 前端 `useData` 现按当前语言请求 `/api/data?lang=<locale>`（key 含 locale 分语言缓存），`localizedConcerts/Cities/Wishes` 在「服务端已本地化」时直接透传、否则前端 `localizeConcert`；`counts` 单语言时读服务端预置的 `city.concertCount`（不再前端跨语言重算）。
- 修改 `public/css/*` 或 `app/pages/index.vue` 后，无需手动维护缓存清单（Workbox 运行时缓存）；PWA 的 `autoUpdate` 会自动处理更新。
- **统计卡片计数动画**：`STAT_COUNTUP_DURATION`（5s）与 `STAT_COUNTUP_REPEAT`（120s）定义在 `app/components/StatsCards.vue`（自 `index.vue` 抽出）；展示值由 `useCountUp` 惰性派生，SSR 首屏与无 JS 场景可见**真实数值**（不是 0）。三次 `useCountUp` 调用须**原地保留**在该组件内（自带 SSR 透传与定时器生命周期）。
- **`handleError` 可在 watch / 事件回调中安全调用**（错误文案解析器已在 setup 阶段注册）；但切勿在回调里直接调用 `useAppI18n()` / `useI18n()` —— 无组件实例时会抛错。
- **`useTimeline` 的 observer 必须显式释放**：语言切换会重建页面组件，卸载时由 `onScopeDispose` 接管 `disconnect`；新增观察逻辑请走 `initTimelineReveal()`，不要另建 `IntersectionObserver`。
- **已知取舍**：`/api/data` 的点赞数受内层 1 小时共享缓存影响，写入后不会主动失效，他人看到的计数需等缓存/SWR 刷新才更新（不影响当前用户的 `liked` 判定，该值由外层实时合并）。
- **token 安全**：`.env` 已加入 `.gitignore`。若 token 曾提交进 git 历史，应立即到 Turso 控制台**更换新 token**。
- **书册遮罩的 15s 兜底**：CSS 动画仅在 `html.book-loader-armed` 下生效，该类只能由 `SiteLoader.vue` 的 `onMounted`（水合成功）添加，`finish` / 卸载必须移除；否则计时从页面加载开始，慢网下 JS 未水合就提前隐藏遮罩。无 JS 兜底规则必须自行包 `<style>`（见 11.2）。
- **压缩插件不要把二进制交给错误渲染路径**：修改 `render:response` 或新增 HTML 响应时，`shouldCompress()` 必须同时检查状态码与 `isNuxtErrorRender(event.path)`；错误页被压缩会产生不可解压的 br 响应（见 11.3）。
- **E2E 写状态**：fixture 库在多个 spec 间串行共享；会写库的用例应使用不存在的目标 / 相对断言或自行回滚，静态结构断言改读动态基准，避免顺序相关的假失败。
- **报告产物**：`test/report/e2e-artifacts` / `e2e-html` 累积数百文件后，Playwright 启动时的清空动作会触发 IDE 批量删除保护；先删这两个目录再跑（见 `test/README.md` 第六节）。

---

## 14. 安全：客户端 IP 与点赞限流

点赞以「IP 去重」（`UNIQUE(concert_id, ip)`）判定每用户一票并驱动「热门前三」。IP 若可伪造，攻击者可无限刷赞、污染排序。

### 14.1 不可伪造的客户端 IP · Spoof-proof client IP

- **禁止**直接采信 `X-Forwarded-For` 最左值：无条件 `getRequestIP(event, { xForwardedFor: true })` 会读取客户端可随意伪造的 XFF 最左条目，直连部署下可伪造成任意 IP、绕过去重无限刷赞。
- 现统一经 `getClientIp(event)`（`server/lib/concertLikes.ts`）获取 IP，递进信任链为：
  1. **Vercel（运行时自动注入 `VERCEL=1`）**：优先取 `x-vercel-forwarded-for`（平台覆写的**单值真实客户端 IP**，客户端无法伪造），并把 XFF 纳入信任作为兜底；
  2. **其它反代 / CDN**：仅当显式 `NUXT_TRUST_PROXY=true` 时采信 `X-Forwarded-For`；
  3. **否则（默认，含直连部署）**：回退到 TCP 对端 `socket.remoteAddress`——由操作系统给出，客户端无法伪造。
- **直连部署**：不设 `NUXT_TRUST_PROXY`（默认关闭），IP 取 socket 地址，天然不可伪造。
- **Vercel 部署**：**无需**手动设置 `NUXT_TRUST_PROXY`，运行时 `VERCEL=1` 即自动启用平台注入的真实 IP。
- **自建反代 / CDN（Cloudflare、nginx 等）**：设 `NUXT_TRUST_PROXY=true`。**前提**：反代需「覆写」（而非追加）`X-Forwarded-For` 为真实客户端 IP（如 nginx `proxy_set_header X-Forwarded-For $remote_addr;`）。若仅追加，最左条目仍可能含伪造值。

### 14.2 点赞基础限流 · Like rate limiting

- `server/lib/rateLimit.ts`：每 IP 每 60 秒最多 10 次（`rateLimit(ip)`），超出返回 `429` 并带 `Retry-After`（秒）。点赞（`POST /api/like`）与留言板写接口（`POST /api/guestbook`、`POST /api/guestbook/reply`）共用该限流。
- 纯内存、零依赖，单进程内有效；空桶自动清理，无内存泄漏。
- **Serverless 局限**：Vercel / 云函数每实例独立内存、冷启动重置，限流仅在单实例内生效，跨实例不共享。如需全局精确限流，应改用 Redis 等共享存储，并在反代 / CDN 层（如 Cloudflare Rate Limiting）再加一层。
- 阈值可在调用处覆盖：`rateLimit(ip, { windowMs, max })`。

### 14.3 用户生成内容（留言板）· UGC safety

- **存储原文、渲染转义**：留言 / 回复内容原样入库（不做 HTML 转义），前端一律用 Vue 文本插值 `{{ }}` 渲染（自动转义），**不使用 `v-html`** —— 从根本上避免 XSS。
- **服务端采集**：昵称 / 内容之外，浏览器、系统、UA、IP 全部由服务端采集，不信任前端自报（`server/lib/ua.ts` + `getClientIp`）。
- **邮箱仅入库、不对外返回**：`guestbook` / `guestbook_reply` 的 `email` 列不随读接口暴露。
- **长度与格式校验**：昵称 ≤ 40 / 内容 ≤ 1000 / 邮箱 ≤ 120 且格式校验；写接口复用同一条限流。
- **端到端回归**：`test/e2e/guestbook.spec.ts` 断言脚本 / 事件载荷「以纯文本渲染、不执行」。

### 14.4 只读安全审查结论（2026-11-07）· Security review

**本轮已修复 / 加固**：H2（JSON-LD 改用 `serializeJsonLd()` 显式转义 `< > &` 与 U+2028/U+2029，不再依赖 unhead 的隐式转义；见 4.3）、H3（SSR 压缩共用 ETag / 未统一 `Vary`，CDN 串编码）、M6（压缩类型契约、q 值、同步阻塞、状态码边界与 404 br 损坏）、L3（`noscript` 裸 CSS 未包 `<style>`）。实现与回归见 11.3、`test/unit/htmlCompression.test.ts`、`test/unit/seo-utils.test.ts`、`test/e2e/slow-network.spec.ts` 与 `test/e2e/security.spec.ts`。


