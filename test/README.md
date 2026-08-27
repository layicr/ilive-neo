# 测试目录 · tests

本目录包含 `js-to-sql.mjs` 转换逻辑的单元测试、测试用例（fixtures）与测试报告。

## 目录结构

| 路径 | 说明 |
|------|------|
| `test/fixtures/valid.js` | 测试案件 1：完整标准数据（双语、含国家），验证正常路径 |
| `test/fixtures/no-country.js` | 测试案件 2：location 缺国家，验证国家自动补 `中国/China` |
| `test/fixtures/special-chars.js` | 测试案件 3：含单引号（如 `Xi'an` / `Angela's`），验证 SQL 转义 |
| `test/js-to-sql.test.mjs` | 单元测试（基于 Node 内置 `node:test`，无需第三方依赖） |
| `test/run-tests.mjs` | 运行测试并生成带数据日期的 `TEST_REPORT_<数据日期>.md`（含**数据日期**） |
| `test/TEST_REPORT_<数据日期>.md` | 自动生成的测试报告（文件名追加数据日期，取 `ilivedb.db` 修改日期） |

## 运行

```bash
cd ilive_admin

# 生成测试报告（TEST_REPORT.md），含数据日期
node test/run-tests.mjs

# 仅运行测试（TAP 输出，不生成报告）
node --test test/js-to-sql.test.mjs
```

## 数据日期说明

报告中的「数据日期」取自 `ilivedb.db` 文件的最近修改时间（`mtime`），用于标识当前测试基于的数据库快照日期。每次重新导入数据后该日期会更新，报告随之反映最新数据快照。

## 覆盖点

- `parseLocation`：中英文 location 拆分、国家缺失自动补默认值、空字符串
- `sq`：NULL 处理、单引号转义（`'` → `''`）、普通字符串包裹
- `extractObject`：JS 对象字面量提取
- `generateSql`：4 张表 INSERT 条数、国家补全、单引号转义、歌单 `seq` 顺序
