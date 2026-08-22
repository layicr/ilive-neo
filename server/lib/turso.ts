/**
 * Turso / LibSQL 客户端单例 · Turso / LibSQL client singleton
 *
 * @module turso
 * @description 利用 @libsql/client 连接协议，通过 runtimeConfig 实现本地与生产无缝切换：
 *              - NUXT_TURSO_DATABASE_URL=libsql://xxx.turso.io （远程 Turso，生产/线上）
 *              - NUXT_TURSO_DATABASE_URL=file:./public/data/data.db （本地 SQLite，开发兜底）
 *              远程时需要 NUXT_TURSO_AUTH_TOKEN。
 *              注意：必须用 NUXT_ 前缀，Nuxt 才会在运行时覆盖 runtimeConfig.turso.*；
 *              若用 TURSO_ 前缀，nuxt.config 求值时可能读不到，导致落回本地 file: 默认值。
 *
 *              Seamless switch between local (file:) and remote (libsql:) via runtimeConfig.
 */
import { createClient, type Client } from '@libsql/client';
import { useRuntimeConfig } from '#imports';
import { isAbsolute, resolve } from 'node:path';

let client: Client | null = null;

/**
 * 将本地相对 file: 路径解析为绝对路径· Resolve a local file: path to absolute
 * @param url 原始 URL · original url
 * @returns 解析后的 URL · resolved url
 * @description 仅对 file: 协议生效（libsql: 直接透传，不解析）。
 *              相对路径基于 process.cwd() 解析：
 *              - 本地 dev：cwd = 项目根，命中源码 public/data/data.db
 *              - 生产：cwd 为运行目录，命中部署环境中存在的 data.db
 *              Windows 下将路径中的反斜杠统一为斜杠，保证 libsql 可识别。
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
 * @description 惰性初始化，根据 runtimeConfig.turso 创建并缓存（模块级单例）。
 *              - url：远程 libsql 或本地 file（由 NUXT_TURSO_DATABASE_URL 决定）
 *              - authToken：仅远程 Turso 需要（NUXT_TURSO_AUTH_TOKEN）
 *              仅创建连接，不做任何写操作（API 全 SELECT，纯只读）。
 */
export function getTursoClient(): Client {
  if (client) return client;

  const config = useRuntimeConfig();
  const rawUrl = (config.turso?.databaseUrl as string) || 'file:./public/data/data.db';
  const url = resolveFileUrl(rawUrl);
  // 只读访问说明：本项目的 API 全部为 SELECT（纯只读），init-db 在生产也已跳过建库，
  // 因此不会触发写操作/WAL，无需 readOnly 配置。
  // 注意：本版本 @libsql/client 的 createClient Config 类型不支持 readOnly 属性，
  // 也不支持 ?mode=ro URL 参数（会抛 URL_PARAM_NOT_SUPPORTED）。若要强制只读，
  // 建议后续升级 libsql 版本或使用 sqlite3 只读 VFS。
  const authToken = (config.turso?.authToken as string) || '';

  client = createClient({
    url,
    authToken: authToken || undefined
  });

  return client;
}