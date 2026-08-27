# admin · 数据管理目录

本目录用于演唱会数据的 **JS 数据文件 → SQL 转换** 与数据库导入。

## 目录结构

| 文件 / 目录 | 说明 |
|-------------|------|
| `concert.js` | 演唱会数据源文件（JS 对象格式，含 id/artist/concertName/location/songlist 等双语字段） |
| `concert2.js` / `concertN.js` | 其他演唱会数据文件（命名规律：`concert` + 数字，可多个） |
| `js-to-sql.mjs` | 转换脚本：读取 `concert*.js`，生成对应的 INSERT SQL |
| `concerts.sql` | 脚本生成的 SQL 输出文件（可直接导入数据库） |
| `ilivedb.db` | 本地 SQLite 数据库（Turso 的本地副本，用于测试/备份） |
| `bak/` | 数据库备份目录（如 `ilivedb_20260821_bak.db`） |

## 数据流

```
concert*.js (JS 数据源)
      │  node js-to-sql.mjs concert.js
      ▼
concerts.sql (INSERT 语句)
      │  sqlite3 / turso shell 导入
      ▼
数据库 (本地 ilivedb.db 或远程 Turso)
      ▼
网站 /api/data 读取展示
```

## 脚本用法

```bash
cd admin

# 单个文件 → 生成 concerts.sql
node js-to-sql.mjs concert.js

# 多个文件合并 → 生成 concerts.sql
node js-to-sql.mjs concert.js concert2.js

# 指定输出文件
node js-to-sql.mjs concert.js -o out.sql

# 通配符（当前目录所有 concert*.js）
node js-to-sql.mjs *.js
```

## 转换规则

`js-to-sql.mjs` 会为每场演唱会生成 **4 张表** 的 INSERT：

| 表 | 内容 |
|----|------|
| `concerts` | 主表：艺人、演唱会名、主题、地点、座位、价格、日期、描述等 |
| `concert_tags` | 标签（中英双语） |
| `concert_images` | 图片路径 + alt（中英双语） |
| `concert_songlist` | 歌单（seq 排序，中英双语） |

**location 自动拆分**：
- 输入 `"中国 · 陕西 · 西安 · 陕西省体育场"`
- 拆分为 `country_zh=中国, province_zh=陕西, city_zh=西安, venue_zh=陕西省体育场`
- 英文同理拆分（`China · Shaanxi · Xi'an · ...`）
- 国家缺失时自动补 `中国 / China`
- 单引号自动转义（如 `Xi'an` → `Xi''an`）

## 导入数据库

### 方式一：远程 Turso（网站线上数据）
```bash
# 需要先安装并登录 turso CLI
turso auth login
turso db shell <数据库名> < admin/concerts.sql
```

### 方式二：本地 SQLite
```bash
sqlite3 admin/ilivedb.db < admin/concerts.sql
```

### 方式三：手动
直接打开 `concerts.sql`，复制内容到数据库客户端（如 DBeaver、TablePlus）执行。

## 注意事项

- 若库中已存在相同 `id` 的演唱会，插入会因主键冲突失败。此时需先清空旧数据：
  ```sql
  DELETE FROM concert_songlist;
  DELETE FROM concert_images;
  DELETE FROM concert_tags;
  DELETE FROM concerts;
  ```
  （脚本生成的 SQL 顶部有这行提示）
- 执行导入前请确认表结构已存在（可用 `server/db/schema.sql` 建表）。
- `concerts.sql` 是生成的临时产物，可随时重新生成，无需手工维护。
