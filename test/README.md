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

最后更新：**2026-09-19**

## 一、目录结构

| 路径 | 说明 |
|------|------|
| `unit/` | 单元 / 功能 / 安全测试源码（`*.test.ts`，由 vitest 运行），共 **24 文件 / 334 用例** |
| `unit/*.mjs` | 手工辅助脚本：`verify-seo.mjs` / `dump-head.mjs` / `html-head.mjs`（SSR head 与 SEO 探测）、`seed-test.mjs`（本地测试数据准备） |
| `e2e/` | 端到端测试源码（`*.spec.ts`，由 Playwright 运行），共 **6 套件 / 54 用例** |
| `e2e/helpers.ts` | E2E 公共辅助（首页导航、hydration 等待等） |
| `e2e/fixtures/e2e-env.ts` | E2E 环境常量（测试库路径 / 端口 / baseURL 单点定义） |
| `e2e/fixtures/seed-e2e-db.mjs` | E2E 专用 fixture 库种子脚本（幂等、含恶意用例数据） |
| `stubs/nuxt-app.ts` | vitest 用 `#app` / `#imports` 桩（useState / useAsyncData / $fetch 等） |
| `setup/nuxt-auto-imports.ts` | vitest setupFiles：把 Nuxt 自动导入的裸标识符挂到 `globalThis` |
| `report/` | 测试产物：`vitest.json`、`e2e-playwright.json`、HTML 报告、失败附件与测试报告 |
| `ui-tests.md` | UI / 交互回归用例（浏览器手动验证清单） |
| `unit-tests.md` | 单元测试用例说明（历史版本，最新口径以本 README 为准） |

## 二、测试环境

| 项 | 内容 |
|----|------|
| 应用形态 | Nuxt 4.5.2 SSR + Vue 3.5.42 + Nitro，数据库 @libsql/client 0.17.4（Turso / LibSQL） |
| 单元测试框架 | Vitest 4.1.11（`vitest.config.ts`，`test/unit/**`，happy-dom） |
| 端到端框架 | Playwright 1.63.0（`playwright.config.ts`，`test/e2e/**`，Chromium） |
| 运行环境 | Node.js v24.20.0，Windows 10 |
| 多语言路由 | `/`（zh 默认，无前缀）、`/en`、`/zh-Hant`（`prefix_except_default`） |
| 生产数据 | `public/data/data.db`（**测试全程不读写**） |

## 三、运行方式

```bash
# 单元测试（24 文件 / 334 用例）
npm test
npm run test:watch            # 监听模式

# 端到端测试（自动 seed fixture 库 → 启动隔离 dev server → 双 project 执行）
npm run test:e2e

# 只跑某个套件 / 某个 project
npx playwright test test/e2e/security.spec.ts
npx playwright test --project=chromium-desktop
npx playwright test --project=chromium-mobile

# 复用已启动的隔离 dev server（默认 3000 端口，可用 E2E_PORT 覆盖）
$env:E2E_PORT="3000"; npx playwright test        # PowerShell
E2E_PORT=3000 npx playwright test                # Bash
```

> 首次运行 E2E 需安装浏览器：`npx playwright install chromium`。
> `playwright.config.ts` 已内置 fixture 库注入、seed 前置执行与桌面 / 移动双 project 分流，无需手工准备数据。

## 四、测试隔离与稳定性设计

| 措施 | 说明 |
|------|------|
| 数据库隔离 | E2E 通过 `NUXT_TURSO_DATABASE_URL` 指向 fixture 库（默认 `%TEMP%\ilive-e2e\e2e-data.db`，可用 `E2E_DB_FILE` 覆盖），由 `seed-e2e-db.mjs` 确定性重建，**绝不读写 `public/data/data.db`** |
| 双 project 分流 | `chromium-desktop`（1440×900，排除移动端用例）与 `chromium-mobile`（Pixel 5 / iPhone 12，`isMobile` + `hasTouch`） |
| 串行执行 | `workers: 1` + `fullyParallel: false`，规避共享 fixture 库写竞争；**不与 vitest 并行同批启动** |
| 超时放宽 | 用例 120s、导航 45s、断言 15s（dev 模式首次编译与 hydration 较慢，避免假失败） |
| 噪声屏蔽 | 注入 `--autoplay-policy=no-user-gesture-required`，消除背景音乐 `play()` 被拦截产生的 console error |
| Nuxt 环境桩 | vitest 通过 `test/stubs/nuxt-app.ts` + `test/setup/nuxt-auto-imports.ts` 提供 `#app` / `#imports` 与自动导入桩，使依赖 `useState` / `useAsyncData` 的 composables 可被单测 |

## 五、覆盖范围

**单元 / 功能 / 安全（`unit/`，24 文件 334 用例）**：`safeHtml`（含 XSS 绕过专项：实体编码混淆、`expression()` / `behavior:`、事件属性丢弃、幂等性）、`localize`、`mappers`、`parse`、`rateLimit`、`clientIp`、`db-config`、`concertLikes`（含事务原子性与 `COUNT(*)` 自愈重算）、`guestbook`（留言 / 回复读写、父留言校验、IN 批量取回复、可选邮箱与 UGC 原样存储、UA 解析）、`hotConcerts`、`friend-links`（含 `sanitizeHref` 协议白名单）、`seo-utils`、`seo-settings`、`i18n`、`config`、`formatWishDate` / `formatWishTime`、`data-get-handler`（`GET /api/data` 外层 handler：304 判空提前返回、`cache-control` 覆盖为 `private, no-store`）、`composables`（useSharedState / useAppError / useNavigation / useFriendLink / useMusic）、`useAppError.context`（回调上下文安全，防 i18n 抛错回归）、`useCountUp`（数字滚动：SSR 透传真值 / 缓动 / 周期重播 / reduced-motion）、`useTimeline`（observer 生命周期：卸载释放 + init 前 disconnect）、`useData`、`useAppI18n`。

**端到端（`e2e/`，6 套件 54 用例）**：

| 套件 | 用例数 | 主要覆盖 |
|------|--------|----------|
| `ui-structure.spec.ts` | 10 | hero / 相册 / 时间轴结构、静态资源 200、语言下拉与音乐按钮行为 |
| `i18n-seo.spec.ts` | 8 | 多语言路由、SEO head 实渲染（title / canonical / hreflang / og:locale）、语言切换 |
| `ue-interaction.spec.ts` | 11 | 加载态、点赞（防连点 / 持久化 / 取消）、模态与筛选、运行期无 console error |
| `guestbook.spec.ts` | 8 | 留言板结构、回复折叠「更多」分页（3→13→15）、回复表单邮箱与表情、邮箱校验、UGC 文本渲染安全 |
| `security.spec.ts` | 9 | XSS 载荷真实渲染不执行、外链 rel 与伪协议白名单、API 非法参数、静态目录暴露面 |
| `mobile-responsive.spec.ts` | 8 | 移动视口与触摸、横向溢出、触摸交互（Pixel 5 六条 + iPhone 12 两条） |

## 六、测试报告

- 最新报告：[`report/2026-09-14-测试报告.md`](./report/2026-09-14-测试报告.md)
- 机器可读结果：`report/vitest.json`、`report/e2e-playwright.json`
- HTML 报告：`report/e2e-html/`（`npx playwright show-report test/report/e2e-html`）
- 失败现场：`report/e2e-artifacts/`（trace / 截图 / 视频，仅失败时保留）

## 八、用例状态约定

每个用例标注：`[ ] 待验证` / `[x] 通过` / `[!] 失败`。验证后在对应方框打勾并记录日期。

---
*（内容由AI生成，仅供参考）*
