# 测试用例（ilive_v2）

> Nuxt3 + Turso 演唱会足迹站点的测试用例存档 · 分「UI 测试」与「单元测试」两类。

## 目录

| 文件 | 说明 |
|------|------|
| [`ui-tests.md`](./ui-tests.md) | UI / 交互回归测试用例（浏览器手动验证） |
| [`unit-tests.md`](./unit-tests.md) | 单元测试用例（纯函数逻辑，可 `node` 直接运行验证） |

## 测试环境

- 开发服务：`npm run dev`（默认 `http://localhost:3000/`，端口被占用时自动切换到 3001）
- 数据库：`public/data/data.db`（Turso / LibSQL），由 `npm run db:seed` 初始化、业务数据外部导入
- 当前数据基线：演唱会 14 场、歌手 12 位、城市 9 座、许愿 21 条（见 `/api/data` 的 `stats`）

## 运行方式

- **UI 测试**：启动 dev server，按 [`ui-tests.md`](./ui-tests.md) 逐步手动验证；建议同时打开浏览器控制台观察报错。
- **单元测试**：用例集中在 `utils/index.ts` 的纯函数。若项目后续引入 vitest，可直接将 `unit-tests.md` 中的用例改写为 `*.test.ts`；当前可复制用例脚本用 `node` 运行验证。

## 用例状态约定

每个用例标注：`[ ] 待验证` / `[x] 通过` / `[!] 失败`。验证后在对应方框打勾并记录日期。
