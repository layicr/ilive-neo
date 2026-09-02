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
> `plugins/`、`utils/`、`locales/`、`types/` 均位于 `app/` 下；`server/`、`public/`、
> `test/`、`nuxt.config.ts` 仍位于项目根。因此 vitest 的 `~`/`@` 别名指向 `app/`。

关键原则：

- **数据完全来自数据库 API**，前端不做静态数据降级。演唱会、城市、许愿数据一律从 `/api/*` 拉取。
- **语言切换零请求**：前端 `useI18n` + `pickText` 在已拉取的双语数据上派生，不额外请求。
- **数据库以远程 Turso 为准**：线上（Vercel）通过 `NUXT_TURSO_DATABASE_URL=libsql://...` 连接远程库；本地开发可回退到 `file:` SQLite。

---

## 2. 技术清单

| 类别 | 技术 |
|------|------|
| 框架 | Nuxt 4 (`^4.5`)、Vue 3 (`^3.5`)、Vue Router 5 |
| 数据库 | Turso / LibSQL (`@libsql/client ^0.17`) |
| PWA | `@vite-pwa/nuxt`（配置化 Service Worker，`/api/*` NetworkFirst）|
| 语言 | TypeScript（`strict` 开启，构建期 `typeCheck: false`）|
| 动画 | GSAP 3.12.2（CDN）|
| 样式 | Tailwind CSS（CDN）、Font Awesome 6.4.0（CDN）、`public/css/*.css` |
| SEO | Nuxt 内置 `useSeoMeta` / `useHead` + 静态 `robots.txt` / `sitemap.xml` |
| 测试 | Vitest（单元测试，node 环境，43 用例）|

### 核心依赖（package.json）

- `@libsql/client`：Turso / SQLite 客户端
- `@vite-pwa/nuxt`：PWA / Service Worker
- `nuxt`、`vue`、`vue-router`：框架
- 开发依赖：`vitest`、`typescript`、`@types/node`

---

## 3. 目录结构

```
ilive_neo/
├── nuxt.config.ts             # Nuxt 总配置（SSR/runtimeConfig/head/PWA/SEO）
├── app/                       # [Nuxt 4 srcDir] 应用层
│   ├── app.vue                # 根组件（渲染 <NuxtPage/> + 全局错误处理）
│   ├── pages/
│   │   └── index.vue          # 首页（Vue 组件，composables 驱动 + SEO 动态 meta）
│   ├── composables/           # [核心] 全部交互逻辑（Vue composables）
│   │   ├── useData.ts         # SSR 预取 /api/data + 单语言派生（pickText/localizeConcert）
│   │   ├── useI18n.ts         # 中英文切换（useState 懒初始化）
│   │   ├── useGallery.ts      # 图片画廊（懒初始化缓存 localizedConcerts）
│   │   ├── useSonglist.ts     # 歌单弹层
│   │   ├── useTimeline.ts     # 时间线渲染
│   │   ├── useNavigation.ts   # 角色导航滚动
│   │   ├── useTicketModal.ts  # 票务模态框
│   │   ├── useAlbumShowcase.ts  # 专辑展示轮播（GSAP）
│   │   ├── useMusic.ts        # 背景音乐播放/暂停
│   │   ├── useKeyboard.ts     # 键盘手势
│   │   ├── useSharedState.ts  # 跨组件共享状态（useState 封装）
│   │   ├── useFriendLink.ts   # 友情链接
│   │   └── useAppError.ts     # 全局错误处理 + Toast
│   ├── plugins/
│   │   └── statis.client.ts   # 第三方统计注入（百度/GA/51.la，客户端插件）
│   ├── locales/               # 静态 UI 文案（中英文字面量，非数据库数据）
│   │   ├── zh.ts
│   │   └── en.ts
│   ├── types/
│   │   └── index.ts           # 前端数据类型（Bilingual* / Concert / AppData 等）
│   └── utils/
│       ├── config.ts          # 全局配置常量 CONFIG
│       └── index.ts           # 工具函数（safeHtml / formatWishTime）
├── public/                    # 静态资源
│   ├── css/  main.css
│   ├── img/  logo.jpg
│   ├── music/ bgm_cn.mp3 · bgm_en.mp3
│   ├── concert/  海报与现场照片
│   ├── robots.txt             # 爬虫规则 + sitemap 引用
│   └── sitemap.xml            # 站点地图（含中英 hreflang）
├── server/                    # Nitro 服务端
│   ├── api/
│   │   ├── data.get.ts        # GET /api/data（单端点聚合：concerts/cities/wishes/stats）
│   │   └── concerts/[id].get.ts  # GET /api/concerts/:id（单场详情）
│   ├── lib/
│   │   ├── turso.ts           # LibSQL 客户端单例（file:/libsql: 切换，纯只读）
│   │   └── mappers.ts         # DB 行 → 双语结构映射 + 城市场次数计算
│   ├── plugins/
│   │   └── init-db.ts         # Nitro 启动时幂等初始化（远程 Turso 跳过）
│   └── db/
│       ├── schema.sql         # 表结构（6 张表）
│       └── seed.mjs           # 建空库脚本（DROP + CREATE，不含业务数据）
├── test/                      # 测试
│   ├── unit/                 # Vitest 单元测试（safeHtml/formatWishTime/config/mappers/localize）
│   ├── ui-tests.md           # UI 验收清单（手动 + 自动化）
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
  ├─ useNavigation()/useKeyboard()/useSonglist()/useTicketModal()/useTimeline()/useFriendLink()
  ├─ useSeoMeta()         → 动态 title/description/og/twitter（随语言切换 + 数据库艺人）
  └─ onMounted            → initLanguage/initBgMusic/startDynamicTextTimers/initDataLayout
```

要点：

- **所有 composable 内的 `useState`/`useAsyncData` 必须懒初始化**（在 composable 函数体内调用，不可在模块顶层），否则 SSR 阶段报 `instance unavailable`。
- 语言切换**不重新请求 API**：`localizedConcerts` 等 computed 依赖 `currentLanguage`，切换只重算前端派生值，零网络请求。
- `app/pages/index.vue` 的 `<script setup>` 承载全部交互逻辑 + SEO 动态 meta。

### 4.2 服务端数据层（单端点）

- `GET /api/data`（`server/api/data.get.ts`）：**单端点聚合**，一次返回 `{ concerts, cities, wishes, stats }`。城市场次数复用同一份 concerts 计算（`computeCityConcertCounts`），消除原多端点重复全量查询。
- `server/lib/mappers.ts`：`fetchAllConcerts` 把归一化 DB 行映射为**双语结构**（`artist: { zh, en }`、`location: { zh, en }` 等）；`computeCityConcertCounts` 计算每城市场次数。
- 前端 `useData.ts` 的 `pickText` / `localizeConcert` 根据 `currentLanguage` 把双语结构**选为单语言字段**（如 `artist: "五月天"`）。

```
useAsyncData('app-data') → GET /api/data
  ├─ concerts[]   (双语: artist.zh/en, location.zh/en, ...)
  ├─ cities[]     (name.zh/en + icon + concerts 场次数)
  ├─ wishes[]     (content.zh/en + likes + liked)
  └─ stats        { totalConcerts, totalArtists, totalCities }
        ↓
localizedConcerts (computed, 按 currentLanguage 选单语言)
```

- `server/lib/turso.ts`：`getTursoClient()` 惰性创建全局单例客户端。根据 `runtimeConfig.turso.databaseUrl` 自动切换：
  - `libsql://xxx.turso.io` → 远程 Turso（生产/线上，需 `NUXT_TURSO_AUTH_TOKEN`）
  - `file:./public/data/data.db` → 本地 SQLite（开发兜底）
  - 项目 API 全为 SELECT（纯只读），`createClient` 不做 `readOnly` 配置。
- `server/plugins/init-db.ts`：Nitro 启动时幂等初始化——**仅当本地 `file:` 且 `concerts` 表不存在时**建空表；**远程 Turso 直接跳过**（避免误建本地空库）。

### 4.3 SEO 动态元信息

`app/pages/index.vue` 中：

- `useSeoMeta` 随 `currentLanguage` 动态输出 title/description/og/twitter。
- **keywords/description 从数据库艺人动态生成**：`localizedConcerts` 提取去重 `artist`，随演唱会增减自动更新。
- `useHead`（仅 `import.meta.server`）注入 **JSON-LD 结构化数据**（WebSite + Person + ItemList + MusicEvent）+ **hreflang** 中英版本。
- JSON-LD 用 `JSON.parse(JSON.stringify(toRaw(...)))` 剥离 Vue 响应式 Proxy，用 `computed` 保证在数据就绪后输出完整演唱会列表。

---

## 5. 数据库

### 5.1 表结构（`server/db/schema.sql`）

| 表 | 说明 |
|----|------|
| `concerts` | 演唱会主表（双语字段 `*_zh` / `*_en`） |
| `concert_tags` | 演唱会标签（`concert_id` 外键） |
| `concert_images` | 演唱会图片（`src` + `alt_zh/en`） |
| `concert_songlist` | 演唱会歌单（`seq` 排序 + `link`） |
| `cities` | 城市表（`name_zh/en` + `icon`） |
| `wishes` | 许愿墙（`content_zh/en` + `likes` + `liked`） |

所有双语字段沿用原 `{zh,en}` 结构。`location` 由 `country/province/city/venue` 四段拆分存储，映射时按 **`国家 · 省 · 市 · 场馆`** 重组（`mappers.ts` 的 `joinLocation`，空段自动省略）。

### 5.2 初始化

```bash
npm run db:seed   # 或 npm run db:init（等价）—— 先 DROP 后 CREATE，得到空库
```

`seed.mjs` 会**先 DROP 后 CREATE**（按外键依赖顺序），得到一个空库。业务数据由外部导入（SQL / 工具）写入，脚本本身不填充数据。

---

## 6. 环境变量

### 6.1 配置项

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NUXT_TURSO_DATABASE_URL` | 数据库 URL（`libsql:` 远程 或 `file:` 本地） | `file:./public/data/data.db` |
| `NUXT_TURSO_AUTH_TOKEN` | 远程 Turso 鉴权 token | 空 |

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
npm run db:seed    # 初始化本地空库
npm run test       # 运行单元测试（vitest run，43 用例）
npm run test:watch # 监听模式运行测试
```

---

## 8. API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/data` | 单端点聚合：演唱会列表 + 城市 + 许愿 + 统计 `{ concerts, cities, wishes, stats }` |
| GET | `/api/concerts/:id` | 单场详情（含 tags/images/songlist），非法 id 400、未找到 404 |

> 前端实际只调用 `/api/data` 与 `/api/concerts/:id` 两个端点。

---

## 9. SEO

### 9.1 静态配置（`nuxt.config.ts`）

- 引入 `SITE_URL = 'https://ilive.lyc.la'`，og:url / canonical / og:image / twitter:image 统一为 **https**。
- 补充 `og:site_name`、`og:locale` / `og:locale:alternate`、`twitter:site` / `twitter:creator`。

### 9.2 静态文件

- `public/robots.txt`：允许所有爬虫，`Disallow: /api/`，引用 sitemap。
- `public/sitemap.xml`：含首页 + 中英 hreflang 版本。

### 9.3 动态元信息（`app/pages/index.vue`）

- `useSeoMeta`：随语言输出 title/description/og/twitter，keywords/description 从数据库艺人动态生成。
- JSON-LD：WebSite + Person + ItemList + MusicEvent（每场演唱会）。
- hreflang：zh-CN / en / x-default。

---

## 10. PWA / Service Worker

由 `@vite-pwa/nuxt` 在 `nuxt.config.ts` 的 `pwa` 字段配置化生成：

- `registerType: 'autoUpdate'`，`injectRegister: 'inline'`
- `devOptions.enabled: false`（开发环境默认不启用 SW）
- Workbox 运行时缓存策略：
  - 图片：`StaleWhileRevalidate`
  - CSS/JS：`NetworkFirst`
  - `/api/*`：`NetworkFirst`（保证实时从数据库获取，离线回退缓存）

---

## 11. 测试

### 11.1 单元测试（Vitest）

```bash
npm run test
```

覆盖纯函数（`node` 环境，无 DOM），共 **43 用例**：

- `safeHtml.test.ts`（11 用例）：HTML 净化
- `formatWishTime.test.ts`（5 用例）：许愿时间格式化
- `config.test.ts`（4 用例）：CONFIG 字段正确性
- `mappers.test.ts`（12 用例）：DB 行 → 双语结构映射（含国家前缀 location）
- `localize.test.ts`（11 用例）：Bilingual → Concert 本地化

配置见根目录 `vitest.config.ts`（node 环境，配置 `~`/`@` 别名解析 Nuxt 路径）。

### 11.2 UI 验收（`test/ui-tests.md`）

手动 + 自动化验收清单，覆盖首屏 SSR、统计卡片、双语切换、API 接口（含 404/400 错误码）等。

### 11.3 依赖 Nuxt 环境的测试

依赖 `useState/useAsyncData` 的 composables（如 useData 本地化、useI18n 切换）需 Nuxt 测试环境，暂未纳入；如需可引入 `@nuxt/test-utils`。

---

## 12. 部署（Vercel）

1. 在 Vercel 后台配置 `NUXT_TURSO_DATABASE_URL` / `NUXT_TURSO_AUTH_TOKEN`。
2. 绑定域名 `ilive.lyc.la`（Vercel 自动提供 HTTPS SSL）。
3. 推送代码，Vercel 执行 `nuxt build` 生成 Nitro serverless 产物。
4. `public/robots.txt` / `sitemap.xml` 会被 Nitro 打包为静态文件。
5. 首次部署后访问 `/api/data` 确认返回远程 Turso 数据。

---

## 13. 注意事项

- `file:` 本地库相对路径基于 `process.cwd()`（Nuxt 根目录）解析，勿在别处运行导致库文件位置漂移。
- `init-db.ts` 用 `process.cwd() + 'server/db/schema.sql'` 定位 schema，因为 Nitro 编译后 `__dirname` 指向产物而非源码树。
- 所有 `useState`/`useAsyncData` 必须在 composable 函数体内（懒初始化），**禁止模块顶层调用**，否则 SSR 报 `instance unavailable`。
- **环境变量必须用 `NUXT_` 前缀**；`TURSO_` 前缀在 config 求值阶段可能读不到。
- **远程 Turso 时 `init-db.ts` 跳过建库**，避免误建本地空库文件。
- 修改 `public/css/*` 或 `app/pages/index.vue` 后，无需手动维护缓存清单（Workbox 运行时缓存）；PWA 的 `autoUpdate` 会自动处理更新。
- **token 安全**：`.env` 已加入 `.gitignore`。若 token 曾提交进 git 历史，应立即到 Turso 控制台**更换新 token**。
