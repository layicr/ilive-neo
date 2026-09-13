# iLive 数据管理 · Admin

演唱会足迹站点的数据管理工具：**零依赖**的增删改查（REST API + 可视化界面 + 命令行），
数据库结构由 `db/schema.sql` 定义。

工具本地模式基于 Node 内置的 `node:sqlite`，**默认无需 npm install**；仅当改用远程 Turso（`TURSO_DATABASE_URL=libsql://...`）时才需 `npm i @libsql/client`。

---

## 目录结构

| 路径 | 说明 |
|------|------|
| `db/schema.sql` | 建表语句 + 种子数据（10 张表，幂等可重复执行） |
| `lib/db.mjs` | 数据库连接与初始化（打开文件、开启外键、执行 schema） |
| `lib/crud.mjs` | 通用 CRUD 数据层（表配置驱动，含校验与错误映射） |
| `lib/server.mjs` | HTTP 服务：REST API + 管理界面（默认端口 8787） |
| `lib/cli.mjs` | 命令行增删改查 |
| `admin.html` | 可视化管理页面（列表 / 新增 / 编辑 / 删除） |
| `admin.css` | 管理界面样式（由 `admin.html` 引用） |
| `admin.js` | 管理界面交互逻辑（前端脚本，由 `admin.html` 及各表页面引用） |
| `<表名>.html`（如 `concerts.html`） | 单表专属管理页面，结构与 `admin.html` 一致、由 `admin.js` 按表名渲染（共 10 张表） |
| `db/data.db` | SQLite 数据库文件（首次运行自动创建） |
| `bak/` | 数据库备份目录 |
| `test/` | 测试套件（crud.test.mjs + api.test.mjs） |

---

## 环境要求

- **Node.js ≥ 22.5**（需内置 `node:sqlite`；当前验证版本 v24.20）
- 无需安装任何第三方依赖

---

## 快速开始

```bash
cd ilive_admin

# 1. 建表 + 写入种子数据（幂等，可重复执行）
node lib/cli.mjs init

# 2A. 启动可视化管理界面
node lib/server.mjs          # 浏览器打开 http://localhost:8787

# 2B. 或直接用命令行
node lib/cli.mjs list cities
```

---

## 可视化管理界面

```bash
node lib/server.mjs
# 界面 · page : http://localhost:8787
# 接口 · api  : http://localhost:8787/api/tables
# 数据库 · db : F:\static\ilive_admin\db\data.db
```

界面功能：

- 左侧切换 10 张表，右侧表格展示数据
- **分页**：每页 20 条，底部「上一页 / 下一页」切换
- **搜索**：顶部输入框 + 搜索按钮，按所有文本列（含 i18n JSON）过滤；清空按钮可恢复全部
- **新增**：`+ 新增` 按钮弹出表单
- **编辑**：每行「编辑」按钮，主键只读
- **删除**：每行「删除」按钮，二次确认；若为演唱会会提示级联清理的子表行数
- **多语言字段**（`*_i18n`）：按语言拆成多个文本框（有几个语言就显示几个），保存时自动拼成 JSON 字符串写入数据库；数组型字段（如 `concert_tags.i18n`）每行一个条目，用多行文本框编辑
- `enabled` / `liked` 等布尔字段用下拉选择（是/否）；标记为 emoji 图标的字段（如 `cities.icon`，由 `crud.mjs` 的 `emojiFields` 配置）使用**图标选择器**——点击「选择图标」弹出内置 emoji 网格，选中即写入、也可清除
- 表单字段标签显示**中文标题**（如 `歌手`），原始列名以小字提示（`artist_i18n`），多语言字段另标注「多语言」徽标；标题在 `crud.mjs` 的 `fieldLabels` 中配置
- 顶部「刷新」重新拉取数据，操作结果以右下角提示条反馈

> 单行表 `site_settings` 已有记录时会自动禁用「新增」按钮，请改用「编辑」。

---

## REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/tables` | 表清单（含字段、必填、JSON 字段等元信息） |
| `GET` | `/api/:table` | 列表，支持 `?limit=&offset=`（默认 200，最大 1000）与 `?q=` 全字段搜索 |
| `GET` | `/api/:table/:id` | 单条详情 |
| `POST` | `/api/:table` | 新增，body 为 JSON |
| `PUT` | `/api/:table/:id` | 编辑，body 为待更新字段（未提供的不变） |
| `DELETE` | `/api/:table/:id` | 删除 |

示例：

```bash
curl http://localhost:8787/api/cities
curl -X POST http://localhost:8787/api/cities \
  -H 'content-type: application/json' \
  -d '{"name_i18n":{"zh-CN":"上海","en":"Shanghai"},"seq":1}'
curl -X PUT http://localhost:8787/api/cities/1 -d '{"seq":9}'
curl -X DELETE http://localhost:8787/api/cities/1
```

状态码约定：

- `200` / `201` 成功
- `400` 参数校验失败、缺少必填、外键/唯一约束冲突
- `404` 记录或路径不存在
- `405` 方法不支持

---

## 命令行 CRUD

```
node lib/cli.mjs init
node lib/cli.mjs tables
node lib/cli.mjs list   <table> [--limit N] [--offset N]
node lib/cli.mjs get    <table> <id>
node lib/cli.mjs add    <table> '<json>' | --file data.json
node lib/cli.mjs update <table> <id> '<json>' | --file data.json
node lib/cli.mjs delete <table> <id>
```

示例：

```bash
node lib/cli.mjs list cities
node lib/cli.mjs get cities 1
node lib/cli.mjs add cities --file payload.json
node lib/cli.mjs update cities 1 '{"seq":9}'
node lib/cli.mjs delete cities 1
```

### JSON 入参三种写法

| 方式 | 写法 | 适用 |
|------|------|------|
| 位置参数 | `add cities '{"name_i18n":{"zh-CN":"上海"}}'` | macOS / Linux |
| 文件 | `add cities --file payload.json` | **Windows 推荐** |
| 标准输入 | `add cities -`（`< payload.json`） | 脚本管道 |

> **Windows PowerShell 会吞掉参数中的双引号**，直接内联 `'{"k":"v"}'` 会解析失败，
> 请改用 `--file` 或 stdin。若用 stdin 管道，需先设置 UTF-8，否则中文乱码：
>
> ```powershell
> [Console]::OutputEncoding=[Text.Encoding]::UTF8
> Get-Content payload.json -Raw -Encoding UTF8 | node lib/cli.mjs add cities -
> ```

### 输出约定

- **说明文字走 stderr，JSON 走 stdout**，因此 stdout 可直接管道处理：

  ```bash
  node lib/cli.mjs list cities | jq '.total'
  ```

- `*_i18n` 字段会**自动展开为 JSON 对象**便于阅读；加 `--raw` 可输出数据库原始字符串。

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8787` | 管理服务端口 |
| `DB_PATH` | 见下方「数据库位置」 | 本地模式下的数据库文件路径（相对路径按当前工作目录解析） |
| `TURSO_DATABASE_URL` | 读取 `.env` | 数据库连接串；`libsql://` 或 `https://` 走远程 Turso，其余（含 `file:`）走本地 SQLite |
| `TURSO_AUTH_TOKEN` | 读取 `.env` | 远程 Turso 的认证令牌（仅远程模式需要） |

```bash
PORT=9000 node lib/server.mjs
DB_PATH=./other.db node lib/server.mjs
```

### 数据库位置（本地模式优先级）

`lib/db.mjs` 会自动读取项目根目录的 `.env`，按以下优先级决定本地文件路径：

1. 环境变量 `DB_PATH`（显式指定，优先级最高）
2. `.env` 中的 `TURSO_DATABASE_URL=file:./...`（本地文件模式）
3. 默认 `<根目录>/db/data.db`

> 当 `TURSO_DATABASE_URL` 为 `libsql://` 或 `https://` 时，自动切换为**远程 Turso / LibSQL** 模式：
> 懒加载 `@libsql/client`（需自行 `npm i @libsql/client`），其余本地文件配置被忽略。
> 本地文件模式仍使用 Node 内置 `node:sqlite`，**零第三方依赖**。

---

## 数据表

| 表名 | 中文名 | 说明 |
|------|--------|------|
| `concerts` | 演唱会 | 主表：艺人、名称、主题、地点、座位、票价、日期、海报、视频、点赞数等 |
| `concert_likes` | 点赞 | 按 IP 去重（`UNIQUE(concert_id, ip)`），取消点赞即删除该行 |
| `concert_tags` | 标签 | 每行一个标签，`i18n` 为各语言数组 JSON |
| `concert_images` | 图片 | 图片地址 + 多语言 alt |
| `concert_songlist` | 歌单 | 曲目名 + 可选链接，按 `seq` 排序 |
| `cities` | 城市 | 城市名、所属国家、图标 emoji |
| `wishes` | 许愿 | 许愿内容 + 点赞数 |
| `site_settings` | 站点设置 | **单行表**（强制 `id = 1`），与语言无关的 SEO 字段 |
| `site_seo_i18n` | SEO 文案 | `key` 为主键（TEXT），文案按语言存 JSON |
| `friend_links` | 友情链接 | `href` 唯一，含图标、多语言名称与描述、启用开关 |

### 多语言（i18n）约定

所有可翻译字段以**单个 `*_i18n` TEXT 列存 JSON**，例如：

```json
{ "zh-CN": "西安", "en": "Xi'an", "zh-Hant": "西安" }
```

新增语言只需在 JSON 里补键，**无需 `ALTER TABLE`**。管理界面中多语言字段会按语言拆成多个文本框，保存时自动拼回 JSON；编辑时语言集合为「JSON 已有键 ∪ 默认语言集（`zh-CN` / `en` / `zh-Hant`）」。

### 删除的级联行为

删除 `concerts` 中的一条记录时，以下子表会通过 `ON DELETE CASCADE` 自动清理，
CLI 与界面都会提示实际清理的行数：

- `concert_likes`
- `concert_tags`
- `concert_images`
- `concert_songlist`

---

## 注意事项

- **默认排序**：含 `seq` 的表按 `seq` 排序、`concert_images` 按 `sort_order`、
  `site_seo_i18n` 按 `key`，其余按主键。
- **约束报错**会转成中文提示，例如：
  - 外键失败 → 「关联记录不存在或已被删除（外键约束失败）」
  - 唯一冲突 → 「唯一约束冲突 · unique constraint violated: friend_links.href」
  - 必填为空 → 「必填字段不可为空 · NOT NULL constraint failed: xx」
- **`site_settings` 只能有一行**（`CHECK (id = 1)`），已有记录时请用编辑而非新增。
- **测试**：`node test/run-tests.mjs` 运行基于 `node:test` 的测试套件（`crud.test.mjs` + `api.test.mjs`），
  覆盖各表新增 / 编辑 / 级联删除与字段校验，需先有可写的本地数据库（如 `node lib/cli.mjs init` 初始化 `db/data.db`）。
- **`node_modules/`** 中残留的 `better-sqlite3` 是早期版本遗留，现版本用 `node:sqlite`，已不再需要。
