---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 9d2199a010da227b7f5130c5e523a5b4_3569ebdcb02711f18874525400287e28
    ReservedCode1: neKe6uCr2TtdL5LZp/jrQlaHjFMWU/6KKJaUvLdnSITm2xDX6zuZWkr474mF0yV+IX1OaJcHiEGV/p/ggn0V/mIOkzEoLbhr4leBskamg4EH+VH+aZ+vQ1phs1WYDcY6xMCcdBBk8pxIe5keJ5hWfzH36aHbr3DxKm0dMYoHyVhZ9Ig0u5sEKmtvuik=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 9d2199a010da227b7f5130c5e523a5b4_3569ebdcb02711f18874525400287e28
    ReservedCode2: neKe6uCr2TtdL5LZp/jrQlaHjFMWU/6KKJaUvLdnSITm2xDX6zuZWkr474mF0yV+IX1OaJcHiEGV/p/ggn0V/mIOkzEoLbhr4leBskamg4EH+VH+aZ+vQ1phs1WYDcY6xMCcdBBk8pxIe5keJ5hWfzH36aHbr3DxKm0dMYoHyVhZ9Ig0u5sEKmtvuik=
---

# 测试用例（ilive_neo）

> Nuxt4 + Turso 演唱会足迹站点的测试体系存档 · 单元测试（Vitest）+ 端到端测试（Playwright，桌面 / 移动双端）。

最后更新：**2026-11-07**

## 一、目录结构

| 路径 | 说明 |
|------|------|
| `unit/` | 单元 / 功能 / 安全测试源码（`*.test.ts`，由 vitest 运行），共 **28 文件 / 402 用例** |
| `unit/*.mjs` | 手工辅助脚本：`verify-seo.mjs` / `dump-head.mjs` / `html-head.mjs`（SSR head 与 SEO 探测）、`seed-test.mjs`（本地测试数据准备） |
| `e2e/` | 端到端测试源码（`*.spec.ts`，由 Playwright 运行），共 **10 套件 / 69 用例** |
| `e2e/book-loader.spec.ts` | **新增** 书册加载页回归：三语文案、目录行数与年份、主题首句引文、无按钮、进度条、淡出、窄视口单页书册 |
| `e2e/slow-network.spec.ts` | **新增** 20 KB/s 慢网首屏、CSS 关键路径、noscript 兜底与 HTML 压缩语义回归（含 404 错误页不压缩） |
| `e2e/helpers.ts` | E2E 公共辅助（首页导航、hydration 等待、错误采集、溢出检测） |
| `e2e/fixtures/e2e-env.ts` | E2E 环境常量（测试库路径 / 端口 / baseURL 单点定义） |
| `e2e/fixtures/seed-e2e-db.mjs` | E2E 专用 fixture 库种子脚本（幂等、含恶意用例数据） |
| `stubs/nuxt-app.ts` | vitest 用 `#app` / `#imports` 桩（useState / useAsyncData / $fetch 等） |
| `setup/nuxt-auto-imports.ts` | vitest setupFiles：把 Nuxt 自动导入的裸标识符挂到 `globalThis` |
| `report/` | 测试产物：`vitest.json`、`e2e-playwright.json`、HTML 报告、失败附件与测试报告 |
| `ui-tests.md` | UI / 交互回归用例（浏览器手动验证清单，含第 18 节加载页与慢网） |
| `unit-tests.md` | 单元测试用例说明（历史存档，最新口径以本 README 为准） |

## 二、测试环境

| 项 | 内容 |
|----|------|
| 应用形态 | Nuxt 4.5.2 SSR + Vue 3.5.42 + Nitro 2.13.4，数据库 @libsql/client 0.17.4（Turso / LibSQL） |
| 单元测试框架 | Vitest 4.1.11（`vitest.config.ts`，`test/unit/**`，happy-dom） |
| 端到端框架 | Playwright 1.63.0（`playwright.config.ts`，`test/e2e/**`，Chromium + Chromium Mobile） |
| 运行环境 | Node.js v24.20.0，Windows 10 |
| 多语言路由 | `/`（zh 默认，无前缀）、`/en`、`/zh-Hant`（`prefix_except_default`） |
| 生产数据 | `public/data/data.db`（**测试全程不读写**；其可被静态下载属已知安全缺陷，见第七节） |

## 三、运行方式

```bash
# 单元测试（28 文件 / 402 用例）
npm test
npm run test:watch            # 监听模式

# 端到端测试（自动 seed fixture 库 → 启动隔离 dev server → 双 project 执行）
npm run test:e2e

# 只跑某个套件 / 某个 project / 只列出用例
npx playwright test test/e2e/security.spec.ts
npx playwright test --project=chromium-desktop
npx playwright test --project=chromium-mobile
npx playwright test --list

# 复用已启动的隔离 dev server（默认 3000 端口，可用 E2E_PORT 覆盖）
$env:E2E_PORT="3000"; npx playwright test        # PowerShell
E2E_PORT=3000 npx playwright test                # Bash
```

> 首次运行 E2E 需安装浏览器：`npx playwright install chromium-headless-shell ffmpeg`。
> 国内下载慢时可设 `$env:PLAYWRIGHT_DOWNLOAD_HOST='https://cdn.npmmirror.com/binaries/playwright'`。

**零下载模式**：本机未装 Playwright 浏览器时，设 `PLAYWRIGHT_USE_EDGE=1` 复用系统 Edge，并自动关闭依赖 ffmpeg 的录屏 / trace / 失败截图；默认不启用，CI 行为不变。

**服务端压缩开关**：`NUXT_DISABLE_HTML_COMPRESSION=1` 可关闭 `server/plugins/html-compression.ts` 的 SSR HTML 压缩（部署在已压缩的反代后使用）。

## 四、测试隔离与稳定性设计

| 措施 | 说明 |
|------|------|
| 数据库隔离 | E2E 通过 `NUXT_TURSO_DATABASE_URL` 指向 fixture 库（默认 `%TEMP%\ilive-e2e\e2e-data.db`，可用 `E2E_DB_FILE` 覆盖），由 `seed-e2e-db.mjs` 确定性重建，**绝不读写 `public/data/data.db`** |
| 双 project 分流 | `chromium-desktop`（1440×900，排除移动端用例）与 `chromium-mobile`（Pixel 5 / iPhone 12，`isMobile` + `hasTouch`） |
| 串行执行 | `workers: 1` + `fullyParallel: false`，规避共享 fixture 库写竞争；**不与 vitest 并行同批启动** |
| 超时放宽 | 用例 120s、导航 45s、断言 15s（dev 模式首次编译与 hydration 较慢，避免假失败） |
| 噪声屏蔽 | 注入 `--autoplay-policy=no-user-gesture-required`，消除背景音乐 `play()` 被拦截产生的 console error |
| Nuxt 环境桩 | vitest 通过 `test/stubs/nuxt-app.ts` + `test/setup/nuxt-auto-imports.ts` 提供 `#app` / `#imports` 与自动导入桩 |
| 慢网用例 | `slow-network.spec.ts` 用 CDP 限速 **20 KB/s / 500ms RTT**，仅作用于首屏关键路径阶段；dev server 会把 Vue 依赖拆成大量模块请求，故验证完遮罩与关键 CSS 后恢复带宽，再验证水合与淡出，避免用例超时 |
| 写状态隔离 | 点赞限流用例改用**不存在的演唱会 id**（限流判定早于存在性校验，仍能触发 429 但零写库）；`ui-structure.spec.ts` 的点赞数以 `/api/data` 当前值为动态基准，避免串行执行时共享 fixture 被前序用例改动导致假失败 |

## 五、覆盖范围

**单元 / 功能 / 安全（`unit/`，28 文件 402 用例）**：`safeHtml`（含 XSS 绕过专项）、`localize`（含 **新增 `firstSentence` 主题首句 6 例**）、`mappers`、`parse`、`rateLimit`、`clientIp`、`db-config`、`concertLikes`、`guestbook`、`hotConcerts`、`friend-links`（含 `sanitizeHref` 协议白名单）、**`seo-utils`（含 `serializeJsonLd` JSON-LD 反逃逸 5 例）**、`seo-settings`、`i18n`、`config`、`formatWishDate`、`data-get-handler`、`artistStats`、`composables`、`useAppError.context`、`useCountUp`、`useTimeline`、`useData`、`useAppI18n`、**`useBookLoader`（16 例：加速翻页时间表 / 最短展示 >10s / 就绪即淡出 / 超时与失败兜底 / 清理 / 海报预取去重补齐）**、**`htmlCompression`（19 例：Accept-Encoding q 值、304/错误页、大小写响应头、统一 Vary、ETag/长度清理、部署开关，以及 `resolveStatusCode` / `isNuxtErrorRender` 错误页不压缩回归）**。

**端到端（`e2e/`，10 套件 69 用例）**：

| 套件 | 用例数 | 主要覆盖 |
|------|--------|----------|
| `ui-structure.spec.ts` | 10 | hero / 相册 / 时间轴结构（点赞数以 `/api/data` 动态基准断言）、静态资源 200、语言下拉与音乐按钮行为 |
| `i18n-seo.spec.ts` | 8 | 多语言路由、SEO head 实渲染（title / canonical / hreflang / og:locale）、语言切换 |
| `ue-interaction.spec.ts` | 11 | 加载态、点赞（防连点 / 持久化 / 取消）、模态与筛选、运行期无 console error |
| `guestbook.spec.ts` | 8 | 留言板结构、回复折叠分页、回复表单邮箱与表情、邮箱校验、UGC 文本渲染安全 |
| `security.spec.ts` | 10 | XSS 载荷真实渲染不执行、JSON-LD 反逃逸（SSR 原始 HTML 无字面闭合标签 + 转义可逆）、外链 rel 与伪协议白名单、API 非法参数、点赞限流（用不存在的 id，零写库）、静态目录暴露面（含 `test.fail` 登记的已知缺陷） |
| `mobile-responsive.spec.ts` | 8 | 移动视口与触摸、横向溢出、触摸交互（Pixel 5 六条 + iPhone 12 两条） |
| `ticket-modal.spec.ts` | 4 | 票根虚拟滚动渲染、海报缩略图非 lazy、行间距无重叠、切换语言后内容仍完整且**不重播书册遮罩** |
| `p0-verify.spec.ts` | 1 | 3D 专辑封面使用 `_thumb` 缩略图且无破图 |
| **`book-loader.spec.ts`** | **6** | **新增** 三语文案 / 目录与年份 / 主题首句 / 无按钮 / 淡出（最短展示 >10s）/ 窄视口单页书册 |
| **`slow-network.spec.ts`** | **3** | **新增** 20 KB/s 首屏关键路径、水合前不被 CSS 兜底提前隐藏、head 无阻塞外部 CSS、noscript `<style>` 兜底、HTML 压缩语义（200 br 可解压 / 404 不压缩 / `q=0`） |

## 六、测试报告

- 最新报告：[`report/2026-09-14-测试报告.md`](./report/2026-09-14-测试报告.md)
- 机器可读结果：`report/vitest.json`、`report/e2e-playwright.json`
- HTML 报告：`report/e2e-html/`（`npx playwright show-report test/report/e2e-html`）
- 失败现场：`report/e2e-artifacts/`（trace / 截图 / 视频，仅失败时保留）

> 产物目录累积到数百个文件后，Playwright 启动时的清空动作可能触发 IDE 的批量删除保护；
> 出现 `SAFE_DELETE_BULK_CONFIRM_REQUIRED` 时，先删除 `report/e2e-artifacts` 与 `report/e2e-html` 再跑。

**2026-11-07 全量执行结果**：`npm test` → **28 文件 / 402 用例全通过**；`npx playwright test --reporter=line` → **10 套件 / 69 用例全通过（0 失败）**；`npm run build` 成功。生产服务实测：`/`、`/en` 的 `br` 响应可正常解压（约 47/49 KB），404 错误页保持明文（不压缩），`q=0` 不压缩由 e2e 压缩语义用例验证；JSON-LD 载荷以 `\u` 转义输出、SSR HTML 无字面 script 闭合标签，`JSON.parse` 仍可还原原文。书册加载页最短展示 11s（>10s）与 SPA 语言切换不重播遮罩已由单测 / E2E 固化。

## 七、已知安全问题（2026-11-07 只读代码审查）

> 以下为「扫描结论」，除本轮已修复的若干项（H2 / H3 / M6 / L3 / 404 br）外，**未擅自改动业务代码**；其余修复涉及部署形态 / 权限模型，需先决策。
> `security.spec.ts` 已用 `test.fail(true)` 登记 H1，修复后会提示 `expected to fail but passed`，届时移除标记即可转正向断言。

| 级别 | 问题 | 状态 |
|------|------|------|
| 高危 H1 | `public/data/data.db` 位于静态目录可被匿名下载（含留言者邮箱 / IP / UA）；`compressPublicAssets` 还会生成 `.br/.gz` 副本 | 未修复（需决策：DB 移出 `public/` + `/data/**` 404） |
| 高危 H2 | JSON-LD 曾直接用 `JSON.stringify` 注入 `script.innerHTML`，DB 数据里的 script 闭合标签可提前结束 ld+json 块 → SSR 存储型 XSS | **已加固**：`serializeJsonLd()` 显式把 `< > &` / U+2028 / U+2029 写成 JSON `\u` 转义（可逆、数据保真）；生产实测无字面闭合标签、JSON 可解析。原先仅靠 unhead 隐式转义，不作为安全边界 |
| 高危 H3 | SSR HTML 压缩曾共用 ETag / 未统一 `Vary`，CDN 可能串编码 | **本轮已修复**（统一 Vary、删除 ETag/Last-Modified/Content-Length、大小写不敏感响应头） |
| 中危 M1 | 写接口（留言 / 回复 / 点赞）无 CSRF / Origin 校验，UGC 提交即 `is_approved=1` | 未修复 |
| 中危 M2 | 正常页面缺少 CSP / HSTS / nosniff / X-Frame-Options 等安全响应头（生产实测仅 404 错误页带 Nitro 默认头） | 未修复 |
| 中危 M3 | 限流为进程内 Map，多实例/冷启动可绕过；XFF 最左值可伪造 | 未修复 |
| 中危 M6 | 压缩插件旧实现的类型契约、q 值、同步阻塞、状态码边界；404 错误页被压缩导致 `br` 流损坏 | **本轮已修复**（异步压缩、q 值协商、仅 200、跳过 `/__nuxt_error` 内部错误渲染、纯函数单测 19 例 + e2e 压缩语义回归） |
| 低危 L3 | `noscript.innerHTML` 曾是裸 CSS 文本，未包 `<style>` 导致无 JS 兜底不生效 | **本轮已修复**（`slow-network.spec.ts` 回归） |
| 低危 L1 | `GET /api/guestbook` 的 `page` 无上限，大 OFFSET 可致慢查询 | 未修复 |

> **404 br 解压失败的根因（本轮修复）**：Nuxt 把 404/500 交给内部 `/__nuxt_error?...&statusCode=404` 路由渲染，`render:response` 触发时 `response.statusCode` 与 `event.node.res.statusCode` 都还是 200，真实状态只在该内部路径上；且错误渲染路径会把压缩后的 `Buffer` 当字符串按 UTF-8 重新编码（非法字节变成 U+FFFD），客户端按 `br` 解压报 `Decompression failed`。现由 `isNuxtErrorRender()` 显式跳过，并由 `slow-network.spec.ts` 的压缩语义用例回归。

**已做对的防护**：SQL 全参数化、输入类型/长度/白名单校验、UGC 用 `{{ }}` 自动转义、邮箱不随读接口返回、友链协议白名单、点赞事务去重与 `private, no-store`、GSAP SRI、`.env*` 已忽略、无服务端 SSRF / 文件上传通道。

## 八、用例状态约定

每个用例标注：`[ ] 待验证` / `[x] 通过` / `[!] 失败`。验证后在对应方框打勾并记录日期。

---
*（内容由AI生成，仅供参考）*
