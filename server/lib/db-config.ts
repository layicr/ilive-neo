/**
 * 数据库连接配置 · DB connection config
 *
 * @module db-config
 * @description 集中抽取 Turso/LibSQL 连接参数的读取与 file: 路径解析，
 *              供 turso.ts（API 客户端单例）与 init-db.ts（启动建库）共用，
 *              消除两处重复的 resolveFileUrl / getDbConfig 实现。
 *
 *              Shared DB connection config (resolveFileUrl + getDbConfig),
 *              used by both turso.ts and init-db.ts to avoid duplicated logic.
 */
import { useRuntimeConfig } from '#imports';
import { isAbsolute, resolve } from 'node:path';

/** 数据库连接配置 · DB connection config */
export interface DbConfig {
  /** 连接 URL（file: 本地 / libsql: 远程）· connection URL */
  url: string;
  /** 认证 token（仅远程 Turso 需要）· auth token (remote only) */
  token: string;
}

/**
 * 读取数据库连接参数（Nitro 端）· Read DB connection params (Nitro)
 * @description 通过 runtimeConfig.turso 读取（NUXT_TURSO_* 运行时覆盖），
 *              url 支持 file:/libsql: 双协议，token 仅远程需要。
 */
export function getDbConfig(): DbConfig {
  const cfg = useRuntimeConfig();
  return {
    url: (cfg.turso?.databaseUrl as string) || 'file:./public/data/data.db',
    token: (cfg.turso?.authToken as string) || ''
  };
}

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
export function resolveFileUrl(url: string): string {
  if (!url.startsWith('file:')) return url;
  const rawPath = url.replace(/^file:/, '').replace(/^\.\//, '');
  const abs = isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
  return 'file:' + (process.platform === 'win32' ? abs.replace(/\\/g, '/') : abs);
}
