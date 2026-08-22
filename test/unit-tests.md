# 单元测试用例（纯函数逻辑）

> 被测对象：`utils/index.ts` 中与 DOM 无关的纯函数（SSR 两端一致）。每类给出去除前端项目后仍可 `node` 运行的验证脚本。

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

## UT-09 mappers — 数据库行→双语结构映射（已自动化）

> 被测对象：`server/lib/mappers.ts` 的纯函数（`mapConcert` / `computeCityConcertCounts`）。
> 已落地为 `test/unit/mappers.test.ts`（12 例，2026-08-22）。

| 用例 | 断言 |
|------|------|
| UT-09a location 国家前缀 | `location.zh` 输出 `中国 · 陕西 · 西安 · 陕西省体育场`（含国家） |
| UT-09b venue 为空省略 | venue 缺省时输出 `中国 · 陕西 · 西安` |
| UT-09c country 为空省略 | country 缺省时输出 `陕西 · 西安 · 陕西省体育场` |
| UT-09d locationDetail | 返回 `country/province/city/venue` 双语分段结构 |
| UT-09e artist/concertName | 双语映射正确 |
| UT-09f 可空字段 | seat/video 等值为 null 时返回 null |
| UT-09g seat 有值 | 返回双语对象 |
| UT-09h tags/images/songlist | 子表正确组装 |
| UT-09i description | 双语描述正确 |
| UT-09j 城市计数 | 按 location 包含城市名计数（中英任一命中） |
| UT-09k 城市计数 en 命中 | 英文 location 命中 name_en |
| UT-09l 无命中 | 返回空对象 |

## UT-10 localize — 双语结构本地化为单语言（已自动化）

> 被测对象：`composables/useData.ts` 的纯函数（`pickText` / `localizeConcert`），
> 对应 `types/index.ts` 的 `BilingualConcert → Concert` 转换逻辑。
> 已落地为 `test/unit/localize.test.ts`（11 例，2026-08-22）。
> 需 vitest 配置 `~`/`@` 别名解析 Nuxt 路径（见 `vitest.config.ts`）。

| 用例 | 断言 |
|------|------|
| UT-10a pickText zh | `lang='zh'` 取 zh 字段 |
| UT-10b pickText en | `lang='en'` 取 en 字段 |
| UT-10c pickText 缺失回退 | 目标字段为 null/undefined 时回退到另一语言（空串不回退） |
| UT-10d pickText null | null/undefined 返回空串 |
| UT-10e localize zh | zh 模式输出中文 field 集（含 location 拼接） |
| UT-10f localize en | en 模式输出英文字段集 |
| UT-10g 可空字段 | seat/price/video 为 null 时输出 null |
| UT-10h images alt | images 的 alt 本地化 |
| UT-10i songlist 转换 | songlist → `{ name, link }`，zh/en 分别取对应字段 |
| UT-10j songlist 回退 | 单语言缺失时回退 |
| UT-10k 非双语字段 | 保留 id/date/time/poster |

---

## 运行方式（已接入 vitest）

```bash
npm test          # 单次运行（vitest run）
npm run test:watch # 监听模式
```

> 已落地为 `test/unit/*.test.ts`，覆盖 `safeHtml` / `formatWishTime` / `CONFIG` / `mappers` / `localize`，共 43 条，全部通过（2026-08-22）。
> 配置见根目录 `vitest.config.ts`（node 环境，包含 `test/unit`）。
> 依赖 Nuxt `useState/useAsyncData` 的 composables（UT-08 等）需 Nuxt 测试环境，暂未纳入；如需可后续引入 `@nuxt/test-utils`。

## 既有用例索引（部分仍为手动/待落实）

- **UT-01 escapeHtml / sanitizeInput / isValidUrl / safeSetUrl / safeCreateElement / handleImageError**：这些导出已在「死代码清理」时从 `utils/index.ts` 移除（项目无引用），相应用例随之作废。
- **UT-02 safeHtml**：已自动化 → `test/unit/safeHtml.test.ts`（11 例）。
- **UT-05 formatWishTime**：已自动化 → `test/unit/formatWishTime.test.ts`（5 例）。
- **UT-07 config**：已自动化 → `test/unit/config.test.ts`（4 例）。
- **UT-06 debounce / throttle**：导出已移除（无引用），故作废。
- **UT-08 composables**：需 Nuxt 环境，待 `@nuxt/test-utils` 支持。
