/**
 * 数据库连接与初始化 · Database connection & init
 *
 * 同时兼容两种后端 · Supports two backends:
 *   1) 本地 SQLite 文件（默认）：使用 Node 内置 `node:sqlite`，零第三方依赖。
 *      Local SQLite file (default): built-in `node:sqlite`, no third-party dependency.
 *   2) 远程 Turso / LibSQL：当 .env 中 `TURSO_DATABASE_URL` 为 `libsql://` 或 `https://`
 *      时，懒加载 `@libsql/client`（需自行 `npm i @libsql/client`）。
 *      Remote Turso / LibSQL: when `TURSO_DATABASE_URL` is `libsql://` or `https://`,
 *      lazily import `@libsql/client` (install it yourself for remote use).
 *
 * 数据库位置优先级 · DB location precedence（本地模式 local mode）:
 *   env DB_PATH  >  .env 的 TURSO_DATABASE_URL(file:)  >  <根目录>/db/data.db
 *   env DB_PATH  >  .env TURSO_DATABASE_URL(file:)     >  <root>/db/data.db
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** 项目根目录（本脚本位于 lib/，需向上退一级）· project root */
export const ROOT = join(__dirname, '..');

/* ---------- 读取 .env（不覆盖已存在的进程环境变量）· load .env (don't override existing env) ---------- */
function loadEnv() {
  try {
    const txt = readFileSync(join(ROOT, '.env'), 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      // 形如 KEY=VALUE，忽略注释与空行 · lines like KEY=VALUE, skip comments/blanks
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* 没有 .env 也正常 · .env is optional */
  }
}
loadEnv();

/* ---------- 决定数据库模式 · decide DB mode ---------- */
export const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
export const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';
export const IS_REMOTE = /^libsql:\/\//i.test(TURSO_URL) || /^https:\/\//i.test(TURSO_URL);

/** 把 `file:./x.db` 形式的相对/绝对路径解析为文件系统路径 · resolve `file:./x.db` to a real path */
function resolveFileUrl(url) {
  const p = url.startsWith('file:') ? url.slice(5) : url;
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
}

/** 数据库文件绝对路径（本地）/ 连接串（远程）· DB file path (local) / DSN (remote) */
export const DB_PATH = (() => {
  if (IS_REMOTE) return TURSO_URL;
  if (process.env.DB_PATH) {
    return isAbsolute(process.env.DB_PATH)
      ? process.env.DB_PATH
      : resolve(process.cwd(), process.env.DB_PATH);
  }
  if (TURSO_URL.startsWith('file:')) return resolveFileUrl(TURSO_URL);
  return join(ROOT, 'db', 'data.db');
})();

/** schema.sql 绝对路径 · absolute path of schema.sql */
export const SCHEMA_PATH = join(ROOT, 'db', 'schema.sql');

let _db = null; // node:sqlite 句柄（本地）· local handle
let _client = null; // @libsql/client（远程）· remote client

/**
 * 确保连接已建立（本地同步打开、远程异步建连）
 * Ensure a connection exists (sync open locally, async connect remotely)
 */
async function ensureConn() {
  if (IS_REMOTE) {
    if (!_client) {
      const { createClient } = await import('@libsql/client');
      _client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN || undefined });
      // 外键约束：保证子表 ON DELETE CASCADE 生效 · FKs enable ON DELETE CASCADE
      await _client.execute('PRAGMA foreign_keys = ON;');
    }
    return;
  }
  if (!_db) {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    _db = new DatabaseSync(DB_PATH);
    _db.exec('PRAGMA foreign_keys = ON;');
  }
}

/**
 * 本地模式同步句柄（仅供测试 / 需要底层 SQLite 时）
 * Local-mode sync handle (tests & low-level access only).
 * 远程模式下不可用 · Not available in remote mode.
 * @returns {DatabaseSync} 数据库实例
 */
export function getDb() {
  if (_db) return _db;
  if (IS_REMOTE) {
    throw new Error('远程 Turso 模式不支持同步 getDb()，请使用 dbAll / dbGet / dbRun / dbExec');
  }
  mkdirSync(dirname(DB_PATH), { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec('PRAGMA foreign_keys = ON;');
  return _db;
}

/** 查询多行 · select multiple rows */
export async function dbAll(sql, params = []) {
  await ensureConn();
  if (_client) return (await _client.execute({ sql, args: params })).rows;
  return _db.prepare(sql).all(...params);
}

/** 查询单行（无结果返回 undefined）· select one row (undefined when none) */
export async function dbGet(sql, params = []) {
  await ensureConn();
  if (_client) {
    const r = await _client.execute({ sql, args: params });
    return r.rows[0];
  }
  return _db.prepare(sql).get(...params);
}

/**
 * 执行写操作 · run a write statement
 * @returns {{changes:number, lastInsertRowid:number}} 执行结果（统一为 number）
 */
export async function dbRun(sql, params = []) {
  await ensureConn();
  if (_client) {
    const r = await _client.execute({ sql, args: params });
    return { changes: Number(r.rowsAffected), lastInsertRowid: Number(r.lastInsertRowid) };
  }
  const info = _db.prepare(sql).run(...params);
  return { changes: Number(info.changes), lastInsertRowid: Number(info.lastInsertRowid) };
}

/** 执行多语句（建表 + 种子）· run multiple statements (schema & seeds) */
export async function dbExec(sql) {
  await ensureConn();
  if (_client) return _client.executeMultiple(sql);
  return _db.exec(sql);
}

/**
 * 执行 schema.sql 建表 + 种子数据（幂等，可重复执行）
 * Run schema.sql to create tables + seeds (idempotent, safe to re-run)
 */
export async function initSchema() {
  await dbExec(readFileSync(SCHEMA_PATH, 'utf8'));
}

/** 关闭数据库连接 · close the connection */
export async function closeDb() {
  if (_client) {
    await _client.close();
    _client = null;
  }
  if (_db) {
    _db.close();
    _db = null;
  }
}
