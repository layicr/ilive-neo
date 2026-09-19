# 单元测试用例（纯函数逻辑）

> 被测对象：与 DOM / Nuxt 运行时无关的纯函数与配置（SSR 两端一致）——
> `app/utils/index.ts`（safeHtml / 时间格式化 / 多语言本地化）、`app/utils/config.ts`（CONFIG）、
> `app/utils/seo.ts`（hreflang / og:locale / 多语言描述）、`server/lib/mappers.ts`（DB 行 → 多语言结构）、
> `nuxt.config.ts`（i18n / head / PWA 配置）。每类给出去除前端项目后仍可 `node`（vitest）运行的验证脚本。

## UT-01 escapeHtml — HTML 转义

| 用例 | 输入 | 预期输出 |
|------|------|----------|
| UT-01a | `'<b>x</b>'` | `&lt;b&gt;x&lt;&#x2F;b&gt;`（`<`→`&lt;`，`>`→`&gt;`，`/`→`&#x2F;`） |
| UT-01b | `'&"'` | `&amp;&quot;` |
| UT-01c | `"it's"` | `it&#x27;s`（`'`→`&#x27;`） |
| UT-01d | 非字符串（如 `null`/数字） | 原样返回 |

## UT-02 safeHtml — 安全 HTML 净化（纯正则，SSR 安全）

> 已按下列 10 例用 node 实测通过（2026-08-22）。白名单：`br b i strong em span p`；仅 `<span>` 保留 `style`（过滤 `javascript:`）。

| 用例 | 输入 | 预期输出 |
|------|------|----------|
| UT-02a | `<b>bold</b>` | `<b>bold</b>` |
| UT-02b | `<br>line1<br/>line2` | `<br>line1<br>line2` |
| UT-02c | `<div>text <b>bold</b></div>` | `text <b>bold</b>`（非白名单剥标签留内容） |
| UT-02d | `<script>alert(1)</script>safe` | `safe`（危险块连同内容移除） |
| UT-02e | `<span style="color:red">hi</span>` | `<span style="color:red">hi</span>` |
| UT-02f | `<span onclick="x()" style="color:red">hi</span>` | `<span style="color:red">hi</span>`（事件属性被剥） |
| UT-02g | `<a href="javascript:alert(1)">x</a>` | `x`（危险链接剥除） |
| UT-02h | `<img src=x onerror=alert(1)>` | ``（自闭合危险标签移除） |
| UT-02i | `<!-- comment -->ok` | `ok`（注释移除） |
| UT-02j | `<p><em>italic</em> &amp; text</p>` | `<p><em>italic</em> &amp; text</p>` |
| UT-02k | 非字符串 | 原样返回 |

## UT-03 sanitizeInput — 输入净化

| 用例 | 输入 | 预期输出 |
|------|------|----------|
| UT-03a | `'  <b>hi</b>  '` | `&lt;b&gt;hi&lt;&#x2F;b&gt;`（trim + 转义） |
| UT-03b | 超过 maxLength（默认 100） | 截断至 100 字符再转义 |
| UT-03c | 非字符串 | `''` |

## UT-04 isValidUrl — URL 安全校验

| 用例 | 输入 | 预期 |
|------|------|------|
| UT-04a | `'https://example.com'` | `true` |
| UT-04b | `'http://a.cn'`、`'mailto:x@y.com'`、`'tel:123'` | `true` |
| UT-04c | `'javascript:alert(1)'` | `false` |
| UT-04d | `'ftp://x'`、`''`、数字/null | `false` |

## UT-05 formatWishTime — 许愿时间格式化

> 相对时间基于 `now` 计算；超 7 天返回本地日期字符串（zh 用 `zh-CN`）。

| 用例 | 输入时间 | 预期 |
|------|----------|------|
| UT-05a | `now - 30s` | `刚刚` / `Just now` |
| UT-05b | `now - 5min` | `5分钟前` / `5 min ago` |
| UT-05c | `now - 3h` | `3小时前` / `3 hours ago` |
| UT-05d | `now - 2d` | `2天前` / `2 days ago` |
| UT-05e | `now - 30d` | `toLocaleDateString('zh-CN')` |

## UT-05b formatWishDate — 固定绝对日期（水合安全）

> 被测对象：`app/utils/index.ts` 的 `formatWishDate`（许愿卡片的稳定绝对日期，避免 SSR/客户端时区差异导致水合 mismatch）。
> 已落地为 `test/unit/formatWishDate.test.ts`（4 例，2026-09-02）。

| 用例 | 断言 |
|------|------|
| UT-05b-a 格式 | 输出 `YYYY.MM.DD` |
| UT-05b-b 补零 | 个位数月/日补零（如 `2026.03.05`） |
| UT-05b-c 解析失败 | 无法解析的时间字符串返回空串 |
| UT-05b-d 水合安全 | 不含空格/UTC 偏移，SSR 与客户端输出一致 |

## UT-06 debounce / throttle — 防抖节流

| 用例 | 说明 | 预期行为 |
|------|------|----------|
| UT-06a debounce | 连续调用多次 | 仅在停止调用 `delay` 后执行一次 |
| UT-06b throttle | 高频触发 | 按 `interval` 间隔执行，首调立即执行 |
| UT-06c 清除 | 防抖在触发前再次调用 | 重置定时器，最终只执行最后一次 |

## UT-07 config — 配置项

| 用例 | 断言 |
|------|------|
| UT-07a `PERFORMANCE_MONITOR` | 仅 `NODE_ENV !== 'production'` 时为 `true`（生产关闭日志） |
| UT-07b `DEBOUNCE_RESIZE_DELAY` | `250` |
| UT-07c `TOAST_DURATION` | Toast 展示时长配置有效（与 UI-030 配合） |

## UT-08 composables 状态（依赖 Nuxt useState/useAsyncData，需 vitest + Nuxt 环境）

| 用例 | 说明 |
|------|------|
| UT-08a useData 本地化 | `localizedConcerts/localizedCities/localizedWishes` 随 `currentLanguage` 切换，数据零请求 |
| UT-08b useI18n 文案 | 中英文切换后 `currentData` 文案正确 |
| UT-08c useAppError | `toastMessage` 置值后在 `TOAST_DURATION` 后清空 |

## UT-09 mappers — 数据库行→多语言结构映射（已自动化）

> 被测对象：`server/lib/mappers.ts` 的纯函数（`parseI18n` / `mapConcert` / `fetchAllConcerts`）。
> 数据库列已由 `*_zh` / `*_en` 改为多语言 JSON 列（`*_i18n`，形如 `{"zh":"…","en":"…"}`）。
> 已落地为 `test/unit/mappers.test.ts`（18 例，2026-09-12）——为此 `mapConcert` 由内部函数改为 `export`，
> 测试使用 `ConcertRow` 接口（`*_i18n` 字符串）+ 最小 `Client` 桩。

| 用例 | 断言 |
|------|------|
| UT-09a parseI18n 解析 | 合法 JSON 解析为对象并保留各语言值 |
| UT-09b parseI18n 补 zh | 缺少 `zh` 键时补空串（`zh` 为基语言） |
| UT-09c parseI18n 空值 | `null` / `undefined` / 空串 → `{ zh: '' }` |
| UT-09d parseI18n 容错 | 非法 JSON 不抛错，回退 `{ zh: '' }` |
| UT-09e location 拼接 | 输出 `中国 · 陕西 · 西安 · 陕西省体育场`（含国家） |
| UT-09f venue 缺失省略 | 输出 `中国 · 陕西 · 西安` |
| UT-09g country 空省略 | 输出 `陕西 · 西安 · 陕西省体育场` |
| UT-09h 未翻译语言 | zh-Hant 的 location 为空串，**不跨语言回退**（回退由 UI 层 `pickLocale` 负责） |
| UT-09i locationDetail | 返回 `country/province/city/venue` 的四段多语言结构 |
| UT-09j 文本字段 | artist / concertName / theme / description 映射为多语言对象 |
| UT-09k 可空字段有值 | seat / price / video 有值时为多语言对象 |
| UT-09l 可空字段为空 | seat / price / video / videoUrl 为 null 时输出 null |
| UT-09m tags | 多行合并为「每语言数组」，缺失语言补空数组 |
| UT-09n images | 映射为 `{ src, alt }` |
| UT-09o songlist | 映射为 `{ name, link }` |
| UT-09p 非翻译字段 | 保留 id / date / time / poster |
| UT-09q fetchAllConcerts 空数据 | 无数据时返回空数组（最小 client 桩） |
| UT-09r fetchAllConcerts 装配 | 按 `concert_id` 把 tags / images / songlist 装配到各场演唱会 |

## UT-10 localize — 多语言结构本地化为单语言（已自动化）

> 被测对象：`app/utils/index.ts` 的纯函数（`pickLocale` / `localizeConcert` / `localizeCity` / `localizeWish` /
> `computeCityConcertCounts`），对应 `app/types/index.ts` 的 `LocalizedConcert → Concert` 转换逻辑。
> 旧 API 名 `pickText`（现为 `pickLocale`）、`BilingualConcert`（现为 `LocalizedConcert`）已不存在。
> 已落地为 `test/unit/localize.test.ts`（29 例，2026-09-13 增补 `pickHotConcertIds`）——直接测 `app/utils`，不依赖 Nuxt 运行时（避开 `#app`）。
> 需 vitest 配置 `~`/`@` 别名解析 Nuxt 路径（见 `vitest.config.ts`）。

| 用例 | 断言 |
|------|------|
| UT-10a pickLocale 命中 | 命中目标语言时直接返回该语言值 |
| UT-10b pickLocale 回退 zh | 目标语言缺失时回退到 `zh` |
| UT-10c pickLocale 回退 en | `zh` 也缺失时回退到 `en` |
| UT-10d pickLocale 空白串 | 目标语言为空白串时同样触发回退 |
| UT-10e pickLocale 空输入 | `null` / `undefined` 输入返回空串 |
| UT-10f pickLocale 全空 | 所有语言均为空时返回空串 |
| UT-10g localizeConcert zh | zh 模式输出中文字段集（含 location 拼接） |
| UT-10h localizeConcert en | en 模式输出英文字段集 |
| UT-10i 未翻译语言回退 | zh-Hant 整体回退到 zh |
| UT-10j locationDetail 四段 | 四段分别本地化 |
| UT-10k 可空字段 | seat / price / video / videoUrl 为 null 时输出 null |
| UT-10l images | images 的 alt 按语言本地化 |
| UT-10m songlist | songlist → `{ name, link }` 并本地化 name |
| UT-10n songlist 回退 | 目标语言缺失时回退 |
| UT-10o tags | tags 按索引逐项回退 |
| UT-10p 非翻译字段 | 保留 id / date / time / poster |
| UT-10q localizeCity en | en 模式取英文名，`concertCount` 由调用方填充（默认 0） |
| UT-10r localizeCity 回退 | 未翻译语言回退到 zh |
| UT-10s localizeWish en | en 模式取英文内容，其余字段原样保留 |
| UT-10t localizeWish 回退 | 未翻译语言回退到 zh |
| UT-10u 计数·任一语言 | 按 location 包含城市名计数（zh / en 任一命中） |
| UT-10v 计数·仅 en | zh 为空、仅 en 命中时按 en 计数 |
| UT-10w 计数·无命中 | 无城市命中时返回空对象 |
| UT-10x 计数·跳过缺失 | location 缺失的条目被跳过 |

## UT-11 i18n / SEO — 多语言路由与 SSR head（已自动化）

> 被测对象：`app/utils/seo.ts` 纯函数 + `nuxt.config.ts` 的 i18n / head / PWA 配置 +
> `app/app.vue`、`app/pages/index.vue` 源码级回归。
> 已落地为 `test/unit/i18n.test.ts`（25 例，2026-09-12），覆盖 i18n-handoff.md 的 P1-3 / P1-4 / P1-5 / P1-6 / P2-8。

| 分组 | 断言 |
|------|------|
| i18n 配置 | 3 个 locale（zh-CN / en / zh-Hant）、每个 locale 的 BCP-47 `lang` 与 `LOCALE_LANG` 一致、`defaultLocale='zh-CN'`、`strategy='prefix_except_default'`、`fallbackLocale='zh-CN'` |
| head 清理（P1-4） | `app.head` 不再含 title / keywords / description / og:title / og:description / og:site_name / twitter:title / twitter:description；保留 og:type / og:image / og:url / robots / twitter:card；静态 meta 不含中文 |
| PWA（P2-8） | manifest `name='Layicr Concert Journey'`、`short_name='Layicr'`（无中文）；`workbox.navigateFallback=null`、`experimental.entryImportMap=false`、head 中 `/img/logo.jpg` 与 `/css/main.css` 未被回退 |
| hreflang（P1-5） | `buildHreflangLinks()` 输出 3 语言 + `x-default` 共 4 条，URL 与 `SITE_URL` 对应且默认语言无前缀，去重 key 唯一且稳定，支持按 locale 列表裁剪 |
| og:locale | `toOgLocale()` 输出 `zh_CN` / `en` / `zh_Hant`，每个语言互不相同 |
| 站点描述（P1-6） | 3 种语言描述互不相同、无 `{artists}` 残留、有艺人时插入当前语言艺人串、繁简文案各异、模板与分隔符覆盖全部语言 |
| 源码回归（P1-3 / P1-5） | `app.vue` 含 `htmlAttrs` / `og:locale` / `og:locale:alternate` / `buildHreflangLinks`；`index.vue` 复用 `buildHreflangLinks` 且不再硬编码单条 `hreflang: 'zh-CN'` |

## UT-12 SEO 参数数据库化 — DB 优先 + 代码级回退（已自动化）

> 被测对象：`server/lib/mappers.ts` 的 `fetchSiteSeo`、`app/utils/seo.ts` 的 `resolveSiteUrl` / `toLocaleUrl` /
> `toAbsoluteImageUrl`，以及迁移前的硬编码默认值。
> 已落地为 `test/unit/seo-settings.test.ts`（15 例，2026-09-12），覆盖 SEO_DB_MIGRATION.md「六、坑 1」的回退链
> 与「七、canonical 未带语言前缀」修复。

| 分组 | 断言 |
|------|------|
| DB 优先 | 库中有值时按字段取回；运营改写后的值优先于代码默认值（不覆盖、不回退） |
| 回退链（坑 1） | 两表为空 / 单行缺失 / 字段为 null·空串·空白串 / 查询整体失败（表不存在、DB 不可用）/ 未知 key / 非法 JSON —— 均逐字段回退默认值且不抛错 |
| 回退默认值一致性 | `SEO_FALLBACK` 与迁移前硬编码值逐字段一致（og:image / twitter:site / twitter:creator / author / robots） |
| 多语言取值 | DB 含 3 语言时各 locale 取到各自文案且互不相同；缺某语言时按 `pickLocale` 回退链兜底（不返回空） |
| 空 DB 场景 | 空库时页面回退链仍产出非空 title / description；3 语言描述模板回退均非空 |
| 部署维度 | `resolveSiteUrl` 未配置回退代码兜底、已配置去尾部斜杠（`SITE_URL` 不入库） |
| canonical 语言前缀 | `toLocaleUrl`：默认语言无前缀（`https://ilive.lyc.la/`），其余带前缀（`https://ilive.lyc.la/en` …） |
| og:image 绝对化 | `toAbsoluteImageUrl` 对站点相对路径与绝对 URL 均可用 |

> 端到端对应：根目录 `verify-seo.mjs` / `dump-head.mjs` 抓取 SSR head，核对三语言 title / description / keywords
> 与 canonical / hreflang 的实际输出。

> 真实 SSR 输出（`<html lang>` / hreflang / og:locale）由项目根的 `verify-seo.mjs`、`dump-head.mjs`、
> `html-head.mjs` 对运行中的 dev / prod server 做端到端校验；单测只覆盖其中可纯函数化的部分。

## UT-14 演唱会点赞 — 读写模块（已自动化）

> 被测对象：`server/lib/concertLikes.ts`（`resolveClientIp` / `fetchLikeCounts` / `fetchLikeCount` /
> `fetchLikedConcertIds` / `toggleConcertLike`），用最小 Client 桩（内存表）执行。
> 已落地为 `test/unit/concertLikes.test.ts`（11 例）。

| 分组 | 断言 |
|------|------|
| IP 归一化 | 去空白；缺失 / 空串 → `unknown`；超长（异常头）截断到 64 字符 |
| 点赞切换 | 首次点赞 `liked=true` 计数 1；再次点击取消 `liked=false` 计数 0；可反复切换 |
| 去重与隔离 | 不同 IP 各自计数互不影响；不同演唱会计数独立；同一 `(concert_id, ip)` 仅一条 |
| 聚合查询 | `fetchLikeCounts` 一次 GROUP BY 返回每场计数；`fetchLikedConcertIds` 按 IP 返回 id 集合；`isConcertLiked`（单场 EXISTS）判断某一场是否被该 IP 点赞 |
| 容错 | `concert_likes` 表缺失（未迁移）时读接口不抛错，视为无点赞 |

> 端到端对应：`POST /api/like` 与 `/api/data` 的 `likes` / `liked`，见 `test/ui-tests.md` 的 UI-045 ~ UI-048。

## UT-15 留言板 — 读写模块（已自动化）

> 被测对象：`server/lib/guestbook.ts`（`createGuestbookMessage` / `createGuestbookReply` /
> `fetchGuestbookMessages`）与 `server/lib/ua.ts`（`parseUserAgent`），用内存 Client 桩执行。
> 已落地为 `test/unit/guestbook.test.ts`（17 例）。

| 分组 | 断言 |
|------|------|
| 主留言写入 | 提交即 `is_approved=1`（自动通过）并回显自增 id；UGC 原样落库（含 HTML 不转义，转义交前端 `{{ }}` 负责） |
| 回复写入 | 校验父留言存在且已通过，否则返回 `null`（不存在 / 未通过均拒绝，避免孤立回复）；邮箱为可选字段（提供则写入 `guestbook_reply.email`，缺省为 null） |
| 读取 | 仅返回 `is_approved=1` 的主留言与回复；按 `created_at DESC, id DESC` 分页；本页回复用一条 `IN (...)` 批量取回（无 N+1） |
| UA 解析 | 浏览器判定（Edge 优先于 Chrome / Firefox / Safari）；系统判定（Windows 10-11 / macOS / Android / iOS / Linux）；空 / 缺失 UA → `Unknown` |

> 端到端对应：`test/e2e/guestbook.spec.ts`（留言板结构、回复折叠「更多」分页、回复表单邮箱与表情、邮箱校验 `novalidate`、UGC 文本渲染安全），见 `test/ui-tests.md` 的 UI-049 ~ UI-056。

---

## 运行方式（已接入 vitest）

```bash
npm test          # 单次运行（vitest run）
npm run test:watch # 监听模式
```

> 已落地为 `test/unit/*.test.ts`，覆盖 `safeHtml` / `formatWishDate` / `formatWishTime` / `CONFIG` / `mappers` /
> `localize` / `i18n + SEO` / `SEO 回退链` / 友情链接 / `concertLikes`，共 **10 文件 / 143 条**
> （2026-09-13：126 通过 / 15 失败，失败为既有 `zh` vs `zh-CN` 键名与 `app.vue` 源码回归，与点赞改动无关）：
> `safeHtml 11` / `formatWishDate 4` / `formatWishTime 5` / `config 4` / `mappers 19` / `localize 29` / `i18n 25` /
> `seo-settings 15` / `friend-links 17` / `concertLikes 13`。
> 配置见根目录 `vitest.config.ts`（node 环境，包含 `test/unit`，`~`/`@` 别名指向 `app/`）。
> 依赖 Nuxt `useState/useAsyncData` 的 composables（UT-08 等）需 Nuxt 测试环境，暂未纳入；如需可后续引入 `@nuxt/test-utils`。
> SSR head（`<html lang>` / hreflang / og:locale）的可测部分已在 `test/unit/i18n.test.ts` 覆盖，
> 端到端输出另由根目录 `verify-seo.mjs` 对 dev / prod server 校验。

## 既有用例索引（部分仍为手动/待落实）

- **UT-01 escapeHtml / sanitizeInput / isValidUrl / safeSetUrl / safeCreateElement / handleImageError**：这些导出已在「死代码清理」时从 `app/utils/index.ts` 移除（项目无引用），相应用例随之作废。
- **UT-02 safeHtml**：已自动化 → `test/unit/safeHtml.test.ts`（11 例）。
- **UT-05 formatWishTime**：已自动化 → `test/unit/formatWishTime.test.ts`（5 例）。
- **UT-05b formatWishDate**：已自动化 → `test/unit/formatWishDate.test.ts`（4 例）。
- **UT-07 config**：已自动化 → `test/unit/config.test.ts`（4 例）。
- **UT-06 debounce / throttle**：导出已移除（无引用），故作废。
- **UT-08 composables**：需 Nuxt 环境，待 `@nuxt/test-utils` 支持。
- **UT-09 mappers**：已自动化 → `test/unit/mappers.test.ts`（18 例，覆盖 `*_i18n` 多语言列与 `fetchAllConcerts` 装配）。
- **UT-10 localize**：已自动化 → `test/unit/localize.test.ts`（29 例，`pickLocale` / `localizeConcert` / `localizeCity` / `localizeWish` / `computeCityConcertCounts` / `pickHotConcertIds`）。
- **UT-11 i18n / SEO**：已自动化 → `test/unit/i18n.test.ts`（25 例，i18n 配置 + head 清理 + hreflang / og:locale + 3 语言描述 + 源码回归）。
- **UT-12 SEO 参数数据库化 / 回退链**：已自动化 → `test/unit/seo-settings.test.ts`（15 例，`fetchSiteSeo` DB 优先 + 空库 / 单行缺失 / 字段空值 / 查询失败的回退链 + 多语言取值 + canonical 语言前缀）。端到端对应见 `test/ui-tests.md` 的 UI-041 ~ UI-044。
- **UT-13 友情链接**：已自动化 → `test/unit/friend-links.test.ts`（17 例，DB 优先 + 空库/查询失败回退 + 多语言取值 + 字段级兜底）。
- **UT-14 演唱会点赞**：已自动化 → `test/unit/concertLikes.test.ts`（11 例，IP 归一化 + 点赞/取消切换 + 计数聚合 + 表缺失容错）。端到端对应见 `test/ui-tests.md` 的 UI-045 ~ UI-048。
- **UT-15 留言板**：已自动化 → `test/unit/guestbook.test.ts`（17 例，主留言自动通过 + UGC 原样落库 + 回复父留言校验 + 可选邮箱 + `IN (...)` 批量取回复 + UA 解析）。端到端对应见 `test/e2e/guestbook.spec.ts` 与 `test/ui-tests.md` 的 UI-049 ~ UI-056。
