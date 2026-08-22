/**
 * 数据库初始化脚本（创建空库）· DB Init Script (create empty database)
 *
 * @module seed
 * @description 生成本地 SQLite 数据库 data.db（或写入远程 Turso），**仅创建空表结构、不填充业务数据**。
 *              业务数据（演唱会/城市/许愿）由外部导入（如 SQL 文件 / 管理后台）写入。
 *
 *              Creates the local data.db (or writes to remote Turso) with **empty tables only**,
 *              without seeding any business data. Data can be imported later externally.
 *
 * 用法 Usage：npm run db:seed（等价于 npm run db:init）
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, isAbsolute } from 'node:path';
import { createClient } from '@libsql/client';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 数据库连接 URL（优先环境变量，默认本地文件）· DB url (env override, default local file)
const DB_URL = process.env.TURSO_DATABASE_URL || 'file:./public/data/data.db';
const DB_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

/**
 * 确保本地 file: 数据库的父目录存在· Ensure the parent dir of a local file: db exists
 * @description 防止 data/ 目录缺失时 libsql 无法创建库文件（远程 libsql: 跳过）。
 *              Only relevant for local file: URLs; remote libsql: is skipped.
 */
function ensureDataDir(url) {
  if (!url.startsWith('file:')) return;
  const rawPath = url.replace(/^file:/, '').replace(/^\.\//, '');
  const abs = isAbsolute(rawPath) ? rawPath : join(process.cwd(), rawPath);
  const dir = dirname(abs);
  mkdirSync(dir, { recursive: true });
}

// 表结构 SQL · schema sql
const SCHEMA_SQL = readFileSync(join(__dirname, 'schema.sql'), 'utf8');

/**
 * 创建空表结构· Create empty table structure
 * @description 先按外键依赖顺序 DROP 旧表，再按 schema.sql 重建，确保表结构变更（如字段拆分）能生效。
 *              仅建表、不插入数据，得到一个「空库」。
 *              Drops tables in FK-safe order, then recreates from schema.sql so structural changes
 *              take effect even on an existing database. Creates an "empty DB" only.
 */
async function createSchema(client) {
  // 关闭外键约束以安全删除· disable FK to drop safely
  await client.execute('PRAGMA foreign_keys = OFF;');

  // 先删子表（引用外键的表）· drop child tables first (those holding FKs)
  for (const t of ['concert_songlist', 'concert_images', 'concert_tags']) {
    await client.execute(`DROP TABLE IF EXISTS ${t};`);
  }
  // 再删主表· then drop parent tables
  for (const t of ['concerts', 'cities', 'wishes']) {
    await client.execute(`DROP TABLE IF EXISTS ${t};`);
  }

  // 拆分语句（每句以分号结尾）· split statements by semicolon
  const statements = SCHEMA_SQL
    .split(/;\s*(?:\r?\n|$)/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const sql of statements) {
    await client.execute(sql);
  }

  await client.execute('PRAGMA foreign_keys = ON;');
}

/**
 * 主流程：仅创建空库· Main: create empty database only
 */
async function main() {
  // 确保本地数据库父目录存在（远程跳过）· ensure parent dir for local db
  ensureDataDir(DB_URL);

  console.log(`[seed] 连接数据库: ${DB_URL} · connecting to: ${DB_URL}`);
  const client = createClient({ url: DB_URL, authToken: DB_TOKEN || undefined });

  // 仅创建空表结构，不填充数据· create empty tables only, no data seeding
  await createSchema(client);

  // 校验空表· verify empty tables
  const tables = ['concerts', 'concert_tags', 'concert_images', 'concert_songlist', 'cities', 'wishes'];
  const counts = {};
  for (const t of tables) {
    const r = await client.execute(`SELECT COUNT(*) AS n FROM ${t}`);
    counts[t] = r.rows[0].n;
  }
  console.log(`[seed] 空库创建完成 · empty DB created:`, counts);

  client.close();
}

main().catch(err => {
  console.error('[seed] 失败 · failed:', err);
  process.exit(1);
});
