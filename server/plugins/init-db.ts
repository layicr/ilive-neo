/**
 * 数据库自动初始化插件 · Auto DB Init Plugin (Nitro)
 *
 * @module init-db
 * @description 在 Nitro 服务器启动时自动检查数据库；若数据库文件不存在（本地 file:）、
 *              无法连接（远程 libsql:）或缺少表结构，则自动创建**空表结构**（不填充业务数据）。
 *
 *              On Nitro boot, auto-checks the database: if the DB file/link is missing or the
 *              tables are absent, it creates the **empty table structure** (no data seeded).
 *
 * 说明 Note：
 *              - 幂等：仅当 `concerts` 表不存在时才建表，避免重复初始化/覆盖已有数据。
 *                Idempotent: only creates tables when `concerts` is missing.
 *              - 业务数据不在此填充，由外部导入（SQL / 管理后台）。
 *                Business data is NOT seeded here.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, isAbsolute, resolve } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { defineNitroPlugin } from '#imports';
import { getDbConfig, resolveFileUrl } from '../lib/db-config';

/**
 * 表结构 SQL 路径 · path to schema.sql
 * @description 用 process.cwd() 定位源码中的 schema.sql（dev 下 cwd=项目根）。
 *              仅在本地 file: 开发时建空表读取；远程 Turso 跳过，不依赖此文件。
 */
const SCHEMA_PATH = join(process.cwd(), 'server', 'db', 'schema.sql');

/**
 * 确保本地 file: 库文件父目录存在· Ensure the parent dir of a local file: db exists
 * @param url 原始 URL · original url
 */
function ensureFileDir(url: string): void {
  if (!url.startsWith('file:')) return;
  const rawPath = url.replace(/^file:/, '').replace(/^\.\//, '');
  const abs = isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
  mkdirSync(dirname(abs), { recursive: true });
}

/**
 * 是否应跳过自动建库· Whether to skip auto schema creation
 * @description 生产环境 + file: 时：运行时文件系统只读，mkdirSync/建表会失败，
 *              且表结构应已存在于随包/已初始化的库中。故跳过，仅依赖已有库文件。
 */
function shouldSkipInit(): boolean {
  const { url: rawUrl } = getDbConfig();
  const isFile = rawUrl.startsWith('file:');
  const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
  return isFile && isProd;
}

/**
 * 检查库中是否已有 concerts 表· Check whether the concerts table exists
 * @param client LibSQL 客户端 · client
 * @returns {Promise<boolean>} 是否存在 · whether it exists
 */
async function hasConcertsTable(client: Client): Promise<boolean> {
  try {
    const r = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='concerts' LIMIT 1"
    );
    return r.rows.length > 0;
  } catch {
    // 连接异常/表不可达视为不可用，走初始化（建表失败会再抛错）
    return false;
  }
}

/**
 * 按 schema.sql 创建空表结构· Create empty tables from schema.sql
 * @param client LibSQL 客户端 · client
 */
async function createEmptySchema(client: Client): Promise<void> {
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  const statements = schema
    .split(/;\s*(?:\r?\n|$)/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const sql of statements) {
    await client.execute(sql);
  }
  console.log('[init-db] 空表结构创建完成 · empty table structure created');
}

/**
 * 幂等初始化空库· Idempotently ensure the empty DB structure
 * @description 无 concerts 表时自动建空表；失败仅告警，不阻塞服务器启动。
 *              Creates empty tables when missing; on failure warns without blocking boot.
 */
async function ensureEmptyDb(): Promise<void> {
  const { url: rawUrl } = getDbConfig();
  // 远程 Turso 无需自动建库（数据由用户上传）；仅本地 file: 时才自动建空表。
  // 避免每次启动误建 public/data/data.db 本地空库。
  if (!rawUrl.startsWith('file:') || shouldSkipInit()) {
    console.log('[init-db] 跳过自动建库（远程 libsql 或只读部署）· skip init (remote or read-only)');
    return;
  }
  const token = getDbConfig().token;
  const url = resolveFileUrl(rawUrl);
  ensureFileDir(url);

  // 独立探测客户端（不污染全局单例缓存）· standalone probe client
  const probe = createClient({ url, authToken: token || undefined });
  try {
    if (await hasConcertsTable(probe)) {
      console.log('[init-db] 数据库已就绪 · database ready');
      return;
    }
    await createEmptySchema(probe);
  } catch (err) {
    console.warn('[init-db] 自动初始化失败（服务器继续启动）· auto-init failed:', err);
  } finally {
    probe.close();
  }
}

/**
 * Nitro 启动插件· Nitro boot plugin
 * @description 插件加载时即执行一次性空库初始化（早于任何请求处理），失败仅告警不阻塞启动。
 *              Runs once on plugin load (before any request); warns on failure, never blocks boot.
 */
export default defineNitroPlugin(() => {
  // fire-and-forget：确保初始化先于请求完成（失败仅记录）
  void ensureEmptyDb().catch((err) => {
    console.warn('[init-db] 启动初始化异常 · boot init error:', err);
  });
});
