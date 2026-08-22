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

---

## 运行方式（已接入 vitest）

```bash
npm test          # 单次运行（vitest run）
npm run test:watch # 监听模式
```

> 已落地为 `test/unit/*.test.ts`，覆盖 `safeHtml` / `formatWishTime` / `CONFIG`，共 20 条，全部通过（2026-08-22）。
> 配置见根目录 `vitest.config.ts`（node 环境，包含 `test/unit`）。
> 依赖 Nuxt `useState/useAsyncData` 的 composables（UT-08 等）需 Nuxt 测试环境，暂未纳入；如需可后续引入 `@nuxt/test-utils`。

## 既有用例索引（部分仍为手动/待落实）

- **UT-01 escapeHtml / sanitizeInput / isValidUrl / safeSetUrl / safeCreateElement / handleImageError**：这些导出已在「死代码清理」时从 `utils/index.ts` 移除（项目无引用），相应用例随之作废。
- **UT-02 safeHtml**：已自动化 → `test/unit/safeHtml.test.ts`（11 例）。
- **UT-05 formatWishTime**：已自动化 → `test/unit/formatWishTime.test.ts`（5 例）。
- **UT-07 config**：已自动化 → `test/unit/config.test.ts`（4 例）。
- **UT-06 debounce / throttle**：导出已移除（无引用），故作废。
- **UT-08 composables**：需 Nuxt 环境，待 `@nuxt/test-utils` 支持。
