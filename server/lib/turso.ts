/**
 * Turso / LibSQL 客户端单例 · Turso / LibSQL client singleton
 *
 * @module turso
 * @description 利用 @libsql/client 连接协议实现本地与生产无缝切换：
 *              - TURSO_DATABASE_URL=file:./public/data/data.db （本地 SQLite，免注册）
 *              - TURSO_DATABASE_URL=libsql://xxx.turso.io （远程 Turso）
 *              通过运行时配置读取环境变量，远程时需要 TURSO_AUTH_TOKEN。
 *
 *              Seamless switch between local (file:) and remote (libsql:) via env.
 */
import { createClient, type Client } from '@libsql/client';
import { useRuntimeConfig } from '#imports';
import { isAbsolute, resolve } from 'node:path';

let client: Client | null = null;

/**
 * 将本地相对 file: 路径解析为绝对路径· Resolve a local file: path to absolute
 * @param url 原始 URL · original url
 * @returns 解析后的 URL · resolved url
 * @description 相对路径基于 process.cwd() 解析：
 *              - 本地 dev：cwd = 项目根，public/data/data.db 命中源码文件
 *              - Vercel：cwd = /var/task，public/data/data.db 命中 .output/public/data/data.db
 *              （Nitro publicAssets 会把 public/data 原样复制进 .output/public）
 */
function resolveFileUrl(url: string): string {
  if (!url.startsWith('file:')) return url;
  const rawPath = url.replace(/^file:/, '').replace(/^\.\//, '');
  const abs = isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
  return 'file:' + (process.platform === 'win32' ? abs.replace(/\\/g, '/') : abs);
}

/**
 * 获取全局唯一数据库客户端· Get the global singleton database client
 * @returns {Client} LibSQL 客户端实例 · LibSQL client instance
 * @description 惰性初始化，根据 runtimeConfig 创建并缓存。远程 Turso 需 AUTH_TOKEN。
 */
export function getTursoClient(): Client {
  if (client) return client;

  const config = useRuntimeConfig();
  const rawUrl = (config.turso?.databaseUrl as string) || 'file:./public/data/data.db';
  const url = resolveFileUrl(rawUrl);
  // 只读部署（Vercel 运行时文件系统只读）：用 createClient 的 readOnly 配置项，
  // 而非 ?mode=ro URL 参数——本版本 @libsql/client 不支持 URL query 参数，会抛
  // URL_PARAM_NOT_SUPPORTED 导致整个接口崩溃。
  // Read-only deploy: use readOnly option (not ?mode=ro URL param, which this libsql
  // version rejects) to avoid WAL write errors on Vercel's read-only filesystem.
  const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
  const readOnly = rawUrl.startsWith('file:') && isProd;
  const authToken = (config.turso?.authToken as string) || '';

  client = createClient({
    url,
    authToken: authToken || undefined,
    readOnly
  });

  return client;
}