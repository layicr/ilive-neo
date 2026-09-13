# 测试目录 · Tests

针对 iLive Admin 增删改查工具的测试：数据层单元测试 + REST API 集成测试。
全部基于 Node 内置 `node:test`，**无需安装任何依赖**。

---

## 目录结构

| 路径 | 说明 |
|------|------|
| `test/crud.test.mjs` | `lib/db.mjs` + `lib/crud.mjs` 数据层单元测试 |
| `test/api.test.mjs` | `lib/server.mjs` REST API 集成测试（子进程启动真实服务） |
| `test/fixtures/*.json` | 测试案例数据（可编辑，测试与 CLI 均可复用） |
| `test/run-tests.mjs` | 运行全部测试并生成带数据日期的报告 |
| `test/TEST_REPORT_<数据日期>.md` | 自动生成的测试报告 |

---

## 运行

```bash
cd ilive_admin

# 方式一：跑全部测试并生成报告
node test/run-tests.mjs

# 方式二：直接使用 Node 测试运行器
node --test "test/**/*.test.mjs"   # 全部
node --test test/crud.test.mjs     # 仅数据层单元测试
node --test test/api.test.mjs      # 仅 API 集成测试
```

> 注意：请用 glob `"test/**/*.test.mjs"` 而非目录 `test/`。
> 传入目录会被 Node 当作模块入口解析而报 `Cannot find module`；
> 而笼统的 `--test` 有可能把 `run-tests.mjs` 自身也当成测试文件执行（递归）。
> Use the explicit glob instead of a directory: a directory argument is resolved as a
> module entry, and a bare `--test` may pick up `run-tests.mjs` itself and recurse.

---

## 测试隔离

- **临时数据库**：测试通过 `DB_PATH` 指向系统临时目录，**不会读写真实的 `db/data.db`**。
  `crud.test.mjs` 在 import `lib/db.mjs` 之前设置 `DB_PATH`，因此使用动态 `import()`。
- **独立端口**：`api.test.mjs` 以子进程启动 `lib/server.mjs`，使用端口 `8931`，
  与开发服务（默认 `8787`）互不干扰。
- **用例间隔离**：每个用例前清空全部表并重新写入种子数据（`beforeEach`），保证顺序无关。
- **自动清理**：测试结束关闭数据库、终止子进程并删除临时目录。

---

## 覆盖范围

### `db.mjs`
- `DB_PATH` 采用环境变量、`SCHEMA_PATH` 指向 `db/schema.sql`
- `initSchema` 幂等（重复执行不报错、种子不重复）
- 外键约束已开启、`getDb` 单例

### `crud.mjs`
- `TABLES` 与 `schema.sql` 中的表**逐一对齐**（读 `sqlite_master` 比对）
- `listTables` 元信息（主键、自增、必填、JSON 字段、整型字段）
- **i18n**：对象/JSON 字符串写入并压缩存储、非法 JSON 报错
- **校验**：缺必填、必填置空、非整数写整型、单行表重复新增、未知表
- **转换**：字符串数字转数字、布尔转 `0/1`、空串转 `NULL`
- **约束报错**：外键失败、唯一冲突转中文提示
- **查询**：分页 `total/limit/offset`、默认排序、全字段搜索 `q`、文本主键表、种子数据
- **更新**：部分更新、空对象原样返回、主键不可改、可选字段置 `NULL`
- **删除**：返回条数与记录、级联清理统计、`countChildren`

### `server.mjs`
- `GET /` 页面、`GET /api/tables` 元信息
- 新增 → 列表 → 详情 → 编辑 → 删除 完整链路
- `PATCH` 与 `PUT` 等效、`limit/offset` 分页、全字段搜索 `q`
- 错误分支：`400`（缺必填 / 非法 JSON / 外键 / 唯一 / 未知表）、`404`、`405`

---

## 测试案例（fixtures）

| 文件 | 用途 |
|------|------|
| `city-ok.json` | 正常城市：多语言字段 + 排序 + emoji 图标 |
| `city-missing-required.json` | 缺必填字段，用于校验报错分支 |
| `concert-min.json` | 演唱会最小必填集合 |
| `concert-full.json` | 演唱会完整字段（12 个多语言字段） |
| `tag-array.json` | 数组式 i18n（各语言标签数组） |
| `friend-link.json` | 友情链接：唯一 href + 启用开关 |

> fixtures 是纯 JSON 数据，也可直接配合 CLI 使用：
> `node lib/cli.mjs add cities --file test/fixtures/city-ok.json`

---

## 数据日期说明

报告文件名与正文中的「数据日期」取自真实数据库 `db/data.db` 的最后修改时间，
用于标识该次测试对应的数据快照；若文件不存在则回退为当天日期。
可用 `DB_PATH` 指定其他库文件。
