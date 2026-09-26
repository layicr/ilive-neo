# 演唱会足迹（ilive_neo）开发文档

> Nuxt4 + Turso(LibSQL) 迁移版本 · 记录每一次演唱会的感动与回忆
>
> [English Version](./README_DEV_EN.md) | 中文文档

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

---

## 2. 技术清单

| 类别 | 技术 |
|------|------|
| 框架 | Nuxt 4 (`^4.5`)、Vue 3 (`^3.5`)、Vue Router 5 |
| 数据库 | Turso / LibSQL (`@libsql/client ^0.17`) |
| PWA | `@vite-pwa/nuxt`（配置化 Service Worker，`/api/*` NetworkFirst）|
| 多语言 | `@nuxtjs/i18n` v10（3 语言：zh / en / zh-Hant，`strategy: prefix_except_default`，默认 zh 无前缀）|
| 语言 | TypeScript（`strict` 开启，构建期 `typeCheck: false`）|
| 动画 | GSAP 3.12.2（CDN）|
| 样式 | `public/css/main.css`（含从 Tailwind CDN 迁移的手写工具类）、Font Awesome 6.4.0（CDN） |
| SEO | Nuxt 内置 `useSeoMeta` / `useHead`（多语言 hreflang / og:locale）+ 静态 `robots.txt` / `sitemap.xml` |
| 测试 | Vitest（单元测试，happy-dom，**24 文件 / 334 用例**）+ Playwright（E2E，**6 套件 / 54 用例**）+ `verify-seo.mjs`（SSR head 校验脚本）|

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
├── nuxt.config.ts             # Nuxt 总配置（SSR/runtimeConfig/head/PWA/SEO）
├── app/                       # [Nuxt 4 srcDir] 应用层
│   ├── app.vue                # 根组件（NuxtPage + 全局错误处理 + 全站语言 SEO：html lang/hreflang/og:locale）
│   ├── pages/
│   │   └── index.vue          # 首页（Vue 组件，composables 驱动 + 按 locale 输出动态 meta）
│   ├── composables/           # [核心] 全部交互逻辑（Vue composables）
│   │   ├── useData.ts         # SSR 按当前语言请求 /api/data?lang= 单语言本地化（服务端已本地化则透传，否则前端 localizeConcert）+ 点赞覆盖
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
│       ├── index.ts           # 工具函数（safeHtml / 时间格式化 / pickLocale / localize* / computeCityConcertCounts）
│       └── seo.ts             # SEO 纯函数（hreflang 链接 / og:locale / 多语言描述模板与艺人分隔符）
├── i18n/                      # [根目录] 多语言文案（@nuxtjs/i18n v10 布局，langDir 相对此目录）
│   └── locales/               # zh-CN.ts · en.ts · zh-Hant.ts（各语言 message）
├── public/                    # 静态资源
│   ├── css/  main.css
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
│   │   └── locales.ts         # 语言定义（LOCALES）
│   ├── plugins/
│   │   └── init-db.ts         # Nitro 启动时幂等初始化（远程 Turso 跳过）
│   └── db/
│       ├── schema.sql         # 表结构（12 张表，可翻译字段为 *_i18n JSON 列）
│       └── seed.mjs           # 建空库脚本（DROP + CREATE，不含业务数据）
├── verify-seo.mjs · dump-head.mjs · html-head.mjs   # SSR head / SEO 校验脚本（node 直接运行）
├── test/                      # 测试
│   ├── unit/                  # Vitest 单元测试（24 文件 / 334 用例）
│   ├── e2e/                   # Playwright 端到端测试（6 套件 / 54 用例，桌面/移动双 project + fixture 库种子）
│   ├── ui-tests.md            # UI 验收清单（手动 + 自动化）
│   └── unit-tests.md / README.md
└── doc/
    ├── README_DEV.md          # 本文档（中文）
    └── README_DEV_EN.md       # English version
```

---

## 4. 核心架构与数据流

### 4.1 前端启动链路（Vue 化）

不再有经典脚本注入器。页面由 `app/pages/index.vue` 的 `<script setup>` 直接驱动：

```
app/pages/index.vue (setup)
  ├─ useData()           → useAsyncData('app-data') 在 SSR 阶段预取 GET /api/data
  │                       → useState 缓存 concerts/cities/wishes/stats
  │                       → localizedConcerts 等 computed 按 currentLanguage 派生单语言结构
  ├─ useI18n()            → currentLanguage（useState 懒初始化），切换仅重算派生值
  ├─ useMusic()           → 背景音乐（onMounted 初始化，跟随语言切换音轨）
  ├─ useGallery()         → 画廊（懒取一次 localizedConcerts，避免重复 useData）
  ├─ useAlbumShowcase()   → 专辑轮播（GSAP）
  ├─ useCountUp()         → 统计卡片数字滚动（城市/艺人/场次，挂载后从 0 播放，每 120s 重播）
  ├─ useNavigation()/useKeyboard()/useSonglist()/useTicketModal()/useTimeline()/useFriendLink()/useGuestbook()
  ├─ useSeoMeta()         → 页面级动态 title/description/og/twitter（随 locale 切换 + 数据库艺人）
  └─ onMounted            → initLanguage/initBgMusic/startDynamicTextTimers/initDataLayout

app/app.vue (setup)
  └─ useHead + useI18n    → 全站语言相关 SEO：<html lang>、3 语言 hreflang（含 x-default）、
                            og:locale / og:locale:alternate；与语言无关的静态 meta 留在 nuxt.config.ts
```

要点：

- **所有 composable 内的 `useState`/`useAsyncData` 必须懒初始化**（在 composable 函数体内调用，不可在模块顶层），否则 SSR 阶段报 `instance unavailable`。
- 语言切换**不重新请求 API**：`localizedConcerts` 等 computed 依赖 `currentLanguage`，切换只重算前端派生值，零网络请求。
- `app/pages/index.vue` 的 `<script setup>` 承载全部交互逻辑 + 页面级 SEO 动态 meta；全站语言 SEO（`<html lang>` / hreflang / `og:locale`）由 `app/app.vue` 输出，两侧用同名 `key` 合并去重，避免 head 中出现重复 meta。
- **统计数字滚动（`app/composables/useCountUp.ts`）**：展示值是 `computed`——未播放时**惰性透传**目标值（不能在 setup 期取快照：SSR 阶段 `useAsyncData` 尚未 resolve 会取到 0，导致 SSR HTML 输出 0 且水合文本不一致）；客户端 `onMounted` 后下一帧归零并播放（默认 5s，easeOutCubic），可传 `repeatMs` 周期重播（首页为 120s）；命中 `prefers-reduced-motion` 时直接显示终值。
- **错误提示的上下文安全（`app/composables/useAppError.ts`）**：vue-i18n 的 `useI18n()` 在无组件实例时会**直接抛** `Must be called at the top of a 'setup' function`。因此错误文案解析器**只在 setup 阶段注册**，之后 watch / 事件回调 / 全局监听复用它——`handleError(err, ctx, showUser=true, messageKey)` 在回调里可安全调用；新增回调时请勿在其中直接解析 i18n。
- **时间轴 observer 生命周期（`app/composables/useTimeline.ts`）**：`IntersectionObserver` 会**强引用**被 observe 的节点。宿主卸载（`onScopeDispose`）时 `disconnect` 并置空单例，且每次 `initTimelineReveal()` 都先 `disconnect` 再按当前 DOM 重新 observe，避免语言切换重建页面后旧 DOM / 图片节点无法回收。

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
- `useHead`（仅 `import.meta.server`）注入 **JSON-LD 结构化数据**（WebSite + Person + ItemList + MusicEvent）+ **hreflang**（3 语言 + `x-default`，与 `app.vue` 用同名 key 合并去重）。
- JSON-LD 用 `JSON.parse(JSON.stringify(toRaw(...)))` 剥离 Vue 响应式 Proxy，用 `computed` 保证在数据就绪后输出完整演唱会列表。

### 4.4 首页悬浮按钮：背景音乐 & universe 外链

首页右下角悬浮区有两个圆形按钮，均由 `app/pages/index.vue` 渲染：

- **背景音乐按钮**：由 `useMusic` 驱动（见 4.1），Font Awesome 音符图标，点击循环切换播放/暂停。
- **universe 外链按钮（宇宙主题）**：紧邻音乐按钮，是一个静态外链 `<a class="music-btn xy-btn" target="_blank" rel="noopener noreferrer" href="http://iliveworld.lyc.la">`，点击在新标签页打开 `http://iliveworld.lyc.la`。
  - 图标为**内联 SVG**（`.xy-icon`，写在 `index.vue` 内）：渐变圆角方块背景（横向紫粉渐变 `#C896B2 → #D993A7`，取自设计稿图片采样色值）+ 白色「星球 + 星环 + 小星星」图形（贴合「universe / 宇宙」主题）。
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

---

## 7. 开发命令

```bash
npm install        # 安装依赖（含 postinstall: nuxt prepare）
npm run dev        # 启动开发服务器（默认 http://localhost:3000/）
npm run build      # 生产构建（Nitro，可部署到 Vercel）
npm run preview    # 预览生产构建
npm run generate   # 生成静态站点（SSG）
npm run db:seed    # 初始化本地空库（DROP + CREATE，⚠️ 破坏性）
npm run test       # 运行单元测试（vitest run，24 文件 / 334 用例）
npm run test:watch # 监听模式运行测试
npm run test:e2e   # 运行端到端测试（Playwright，6 套件；自动 seed fixture 库并启动隔离 dev server）
```

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
> `DELETE → INSERT → 重算冗余列` 存在「先读后写」依赖，任一语句失败即整体回滚。
> 冗余计数 `concerts.likes` 以 `UPDATE ... likes = (SELECT COUNT(*) ...)` **重算**（自愈），而非旧的 `±1`（并发下会永久漂移）；
> 未迁移库缺少该列时回退实时 `COUNT(*)`，**其它写失败会向上抛**（由前端乐观回滚 + Toast 兜底）。

---

## 9. SEO

### 9.1 静态配置（`nuxt.config.ts`）

- `SITE_URL = 'https://ilive.lyc.la'`，og:url / canonical / og:image / twitter:image 统一为 **https**。
- `app.head` 只保留**与语言无关**的静态信息：`author` / `robots` / `referrer` / `og:type` / `og:url` / `og:image` / `twitter:card` / `twitter:site` / `twitter:creator` / `twitter:image`，以及 favicon / stylesheet / GSAP 等资源引用。
- 原硬编码中文的 `title` / `keywords` / `description` / `og:title` / `og:description` / `twitter:title` / `twitter:description` **已全部移除**（避免与页面级 `useSeoMeta` 重复或冲突）。
- 语言相关 meta：`og:locale` / `og:locale:alternate` 由 `app/app.vue` 输出；`og:site_name` 由页面级 `useSeoMeta` 输出。

### 9.2 静态文件

- `public/robots.txt`：允许所有爬虫，`Disallow: /api/`，引用 sitemap。
- `public/sitemap.xml`：当前仅收录默认语言首页（`https://ilive.lyc.la/`，含 `zh-CN` 一条 `xhtml:link` 备用链接）。3 语言 hreflang 由 `app/app.vue` 与 `app/pages/index.vue` 在页面 head 中输出，不依赖 sitemap。

### 9.3 动态元信息（`app/pages/index.vue`）

- `useSeoMeta`：随语言输出 title/description/og/twitter，keywords/description 从数据库艺人动态生成（3 种语言的描述模板见 `app/utils/seo.ts`）。
- JSON-LD：WebSite + Person + ItemList + MusicEvent（每场演唱会）。
- hreflang：`zh-CN` / `en` / `zh-Hant` + `x-default`（默认语言 `zh` 的 href 为 `https://ilive.lyc.la/`，无 `/zh` 前缀）。
- `<html lang>` 与 `og:locale` / `og:locale:alternate`：由 `app/app.vue` 统一输出（`app/utils/seo.ts` 的 `LOCALE_LANG` / `toOgLocale` / `buildHreflangLinks` 纯函数）。

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

- **3D 专辑封面**（`app/pages/index.vue`）：选中项（首屏 LCP 候选）`loading="eager"` + `fetchpriority="high"`，其余离屏封面 `loading="lazy"` + `fetchpriority="low"`，并统一 `decoding="async"`。
- **画廊缩略图**：`loading="lazy"` + `decoding="async"`，`.gallery-item` 固定 `width/height`（120×80，移动端 100×67）防 CLS。
- **票根海报**：CSS `background-image` 且 `.ticket-modal` 默认 `display:none`，仅在模态框打开时加载，不会首屏急加载。

> 可选后续（资产级改造，未落地）：将 jpg 转码为 **WebP/AVIF** 并使用 `<picture>` + `srcset` 适配分辨率；或引入 `@nuxt/image` 统一处理响应式图与转码。收益取决于构建/部署管线，改动较大，按需评估。



---

## 12. 部署（Vercel）

1. 在 Vercel 后台配置 `NUXT_TURSO_DATABASE_URL` / `NUXT_TURSO_AUTH_TOKEN`。
2. 绑定域名 `ilive.lyc.la`（Vercel 自动提供 HTTPS SSL）。
3. 推送代码，Vercel 执行 `nuxt build` 生成 Nitro serverless 产物。
4. `public/robots.txt` / `sitemap.xml` 会被 Nitro 打包为静态文件。
5. 首次部署后访问 `/api/data` 确认返回远程 Turso 数据。
6. **真实客户端 IP**：Vercel 运行时自动注入 `VERCEL=1`，`getClientIp()` 会优先取平台覆写的 `x-vercel-forwarded-for`（单值、不可伪造），因此点赞去重 / 限流 / 留言板 IP 采集**无需**额外配置 `NUXT_TRUST_PROXY`。
7. 静态资源压缩：`nitro.compressPublicAssets: true` 已开启，`public/**` 静态资源自动压缩。

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
- **统计卡片计数动画**：`STAT_COUNTUP_DURATION`（5s）与 `STAT_COUNTUP_REPEAT`（120s）定义在 `app/pages/index.vue`；展示值由 `useCountUp` 惰性派生，SSR 首屏与无 JS 场景可见**真实数值**（不是 0）。
- **`handleError` 可在 watch / 事件回调中安全调用**（错误文案解析器已在 setup 阶段注册）；但切勿在回调里直接调用 `useAppI18n()` / `useI18n()` —— 无组件实例时会抛错。
- **`useTimeline` 的 observer 必须显式释放**：语言切换会重建页面组件，卸载时由 `onScopeDispose` 接管 `disconnect`；新增观察逻辑请走 `initTimelineReveal()`，不要另建 `IntersectionObserver`。
- **已知取舍**：`/api/data` 的点赞数受内层 1 小时共享缓存影响，写入后不会主动失效，他人看到的计数需等缓存/SWR 刷新才更新（不影响当前用户的 `liked` 判定，该值由外层实时合并）。
- **token 安全**：`.env` 已加入 `.gitignore`。若 token 曾提交进 git 历史，应立即到 Turso 控制台**更换新 token**。

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


