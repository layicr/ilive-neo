# 测试用例（ilive_neo）

> Nuxt4 + Turso 演唱会足迹站点的测试用例存档 · 分「UI 测试」与「单元测试」两类。

## 目录

| 文件 | 说明 |
|------|------|
| [`ui-tests.md`](./ui-tests.md) | UI / 交互回归测试用例（浏览器手动验证） |
| [`unit-tests.md`](./unit-tests.md) | 单元测试用例说明（纯函数 / 配置 / i18n SEO 逻辑，已落地为 `test/unit/*.test.ts`） |
| [`unit/`](./unit/) | 自动化单元测试源码（`*.test.ts`，由 vitest 运行） |

## 测试环境

- 开发服务：`npm run dev`（默认 `http://localhost:3000/`，端口被占用时自动切换到 3001）
- 多语言路由：`/`（zh 默认，无前缀）、`/en`、`/zh-Hant`（`prefix_except_default`）
- 数据库：`public/data/data.db`（Turso / LibSQL），由 `npm run db:seed` 初始化、业务数据外部导入
- 当前数据基线：演唱会 14 场、歌手 12 位、城市 9 座、许愿 21 条（见 `/api/data` 的 `stats`）

## 运行方式

- **UI 测试**：启动 dev server，按 [`ui-tests.md`](./ui-tests.md) 逐步手动验证；建议同时打开浏览器控制台观察报错。
- **SSR head / SEO 校验（脚本）**：`node verify-seo.mjs`（自动探测 `:3000` / `:3001`，打印各语言页面的 `lang` / `title` / `og:locale` / `hreflang`）；`node dump-head.mjs`、`node html-head.mjs` 用于导出某语言的完整 `<head>`。
- **单元测试（已接入 vitest）**：用例已落地为 `test/unit/*.test.ts`，覆盖 `safeHtml` / `formatWishDate` / `formatWishTime` / `CONFIG` / `mappers` / `localize` / `i18n + SEO`，共 **7 文件 / 89 条**用例全部通过（2026-09-12，详见 [`unit-tests.md`](./unit-tests.md) 末尾「运行方式（已接入 vitest）」）。
  ```bash
  npm test           # 单次运行（vitest run）
  npm run test:watch # 监听模式
  ```
  > 依赖 Nuxt `useState`/`useAsyncData` 的 composables（如 useData 本地化）需 Nuxt 测试环境，暂未纳入；如需可后续引入 `@nuxt/test-utils`。

## 用例状态约定

每个用例标注：`[ ] 待验证` / `[x] 通过` / `[!] 失败`。验证后在对应方框打勾并记录日期。
