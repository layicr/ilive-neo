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
import { getDbConfig, resolveFileUrl } from './db-config';

let client: Client | null = null;

/**
 * 获取全局唯一数据库客户端· Get the global singleton database client
 * @returns {Client} LibSQL 客户端实例 · LibSQL client instance
 * @description 惰性初始化，根据 runtimeConfig.turso 创建并缓存（模块级单例）。
 *              - url：远程 libsql 或本地 file（由 NUXT_TURSO_DATABASE_URL 决定）
 *              - authToken：仅远程 Turso 需要（NUXT_TURSO_AUTH_TOKEN）
 *              仅创建连接，连接本身不触发写操作；写操作仅发生在点赞接口
 *              （`POST /api/like` → `concert_likes` 的 INSERT/DELETE），
 *              因此生产 Turso 的 authToken 必须具备写权限。
 *              Lazily initialized from runtimeConfig.turso and cached (module-level singleton).
 *              - url: remote libsql or local file (driven by NUXT_TURSO_DATABASE_URL)
 *              - authToken: required only for remote Turso (NUXT_TURSO_AUTH_TOKEN)
 *              Creating the connection performs no writes; the only writes are the like endpoint
 *              (`POST /api/like` → INSERT/DELETE on `concert_likes`), so the production Turso
 *              authToken must have write permission.
 */
export function getTursoClient(): Client {
  if (client) return client;

  const { url: rawUrl, token } = getDbConfig();
  const url = resolveFileUrl(rawUrl);
  // 读写说明：除点赞接口（POST /api/like 写 concert_likes）外，其余 API 均为只读 SELECT。
  // 因存在写操作，不能使用只读模式；如确需只读部署，需自行改造（升级 libsql 或使用只读 VFS）。
  // 注意：本版本 @libsql/client 的 createClient Config 类型不支持 readOnly 属性，
  // 也不支持 ?mode=ro URL 参数（会抛 URL_PARAM_NOT_SUPPORTED）。
  // Read/write note: apart from the like endpoint (POST /api/like writes concert_likes), all APIs are
  // read-only SELECTs. Because of that write, read-only mode cannot be used; a read-only deployment
  // would need custom work (upgrade libsql or use a read-only VFS). This @libsql/client version's
  // createClient Config type has no readOnly option, nor is ?mode=ro supported (throws URL_PARAM_NOT_SUPPORTED).
  const authToken = token || '';

  client = createClient({
    url,
    authToken: authToken || undefined
  });

  return client;
}