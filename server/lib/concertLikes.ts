/**
 * 演唱会点赞读写 · Concert likes (data access)
 *
 * @module server/lib/concertLikes
 * @description `concert_likes` 表（自增 id / concert_id / ip / created_at）的读写封装：
 *              · 读：`fetchLikeCounts`（一次 GROUP BY 取全部计数）、`fetchLikeCount`（单场）、
 *                    `fetchLikedConcertIds`（当前 IP 已点赞集合），供 /api/data 与单场接口装配，
 *                    避免 N+1；
 *              · 写：`toggleConcertLike` —— 存在则取消（DELETE），不存在则点赞（INSERT OR IGNORE），
 *                    天然幂等、支持反复切换，返回最新 `{ likes, liked }`。
 *
 *              容错：`concert_likes` 表缺失（未迁移）时读操作视为「无点赞」，绝不阻断页面；
 *              写操作会抛错，由接口层转为 5xx。
 *
 *              注意：本模块不依赖 Nitro 运行时（只用 @libsql/client），因此可被 vitest 直接单测。
 *
 *              Read/write wrapper for the `concert_likes` table (auto id / concert_id / ip / created_at):
 *              · reads: fetchLikeCounts (all counts in one GROUP BY), fetchLikeCount (single),
 *                fetchLikedConcertIds (the current IP's liked set) for /api/data and the single-concert API;
 *              · writes: toggleConcertLike — DELETE when present (unlike), INSERT OR IGNORE when absent
 *                (like); naturally idempotent and returns the latest `{ likes, liked }`.
 *              Fault tolerance: a missing table (not migrated) makes reads return "no likes" without
 *              breaking the page; writes throw and the API layer turns that into a 5xx.
 *              No Nitro runtime dependency (only @libsql/client), so it is directly unit-testable.
 */

import type { Client } from '@libsql/client';
import { getRequestHeader, getRequestIP, type H3Event } from 'h3';

/** 点赞切换结果 · Result of toggling a like */
export interface LikeToggleResult {
  /** 该场演唱会最新点赞总数 · latest like count of the concert */
  likes: number;
  /** 本次操作后当前 IP 是否已点赞 · whether the current IP has liked after this toggle */
  liked: boolean;
}

/**
 * 归一化客户端 IP · Normalize a client IP
 * @description 取不到 IP（如本地开发、代理未透传）时兜底为 `'unknown'`，保证点赞功能可用。
 *              超过 64 字符（异常头）时截断，避免写入超长字符串。
 * @param raw `getRequestIP()` 的返回值 · value from getRequestIP()
 */
export function resolveClientIp(raw: string | null | undefined): string {
  const ip = (raw ?? '').trim();
  if (!ip) return 'unknown';
  return ip.length > 64 ? ip.slice(0, 64) : ip;
}

/**
 * 从请求取得「归一化」客户端 IP · Resolve & normalize the client IP from the request
 * @description 安全要点（递进信任链）：
 *              · 部署在 Vercel（`VERCEL=1`）时，优先取平台注入的 `x-vercel-forwarded-for`
 *                （单一真实客户端 IP，由平台覆写、客户端无法伪造）；并把 XFF 纳入信任，
 *                以 `getRequestIP({ xForwardedFor:true })` 取最左 XFF 作为兜底。
 *              · 其它可信反代 / CDN（Cloudflare、nginx）后，仅当显式 `NUXT_TRUST_PROXY=true`
 *                （且反代**覆写** XFF 为真实客户端 IP）时才采信 XFF；
 *              · 否则（默认，含直连部署）使用 TCP 对端 socket 地址，客户端无法伪造。
 *              旧写法 `getRequestIP(event, { xForwardedFor: true })` 无条件读取最左 XFF，
 *              直连部署下会被随意伪造 IP，进而无限刷赞 / 污染判定，故已移除。
 *
 *              Trust chain (defense in depth): on Vercel prefer the platform-injected
 *              x-vercel-forwarded-for (single, unspoofable client IP); elsewhere only trust
 *              X-Forwarded-For behind an explicit NUXT_TRUST_PROXY; otherwise the socket address.
 *
 * @param event Nitro 事件 · Nitro event
 */
export function getClientIp(event: H3Event): string {
  // Vercel 平台：优先用平台覆写的 x-vercel-forwarded-for（单值真实客户端 IP，最可信）
  // Vercel: prefer the platform-overwritten x-vercel-forwarded-for (single, trusted client IP)
  if (process.env.VERCEL === '1') {
    const vff = getRequestHeader(event, 'x-vercel-forwarded-for')
    if (vff) return resolveClientIp(String(vff).split(',')[0])
  }
  // 仅显式声明「在可信反代后」或在 Vercel 上时，才采信 XFF；否则用不可伪造的 socket 地址。
  // Trust X-Forwarded-For only behind a trusted proxy (NUXT_TRUST_PROXY) or on Vercel; else the socket address.
  const trustProxy = process.env.NUXT_TRUST_PROXY === 'true' || process.env.VERCEL === '1'
  return resolveClientIp(getRequestIP(event, { xForwardedFor: trustProxy }))
}

/**
 * 一次取出全部演唱会的点赞计数 · Fetch like counts for all concerts (single GROUP BY)
 * @param client LibSQL 客户端 · client
 * @returns concert_id → 点赞数 · map of concert_id → like count
 */
export async function fetchLikeCounts(client: Client): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  try {
    const r = await client.execute(
      'SELECT concert_id, COUNT(*) AS n FROM concert_likes GROUP BY concert_id'
    );
    for (const row of r.rows as unknown as { concert_id: number; n: number }[]) {
      map.set(Number(row.concert_id), Number(row.n) || 0);
    }
  } catch {
    // 表不存在（未迁移）→ 视为无点赞，不阻断 /api/data
  }
  return map;
}

/**
 * 单场演唱会点赞计数 · Fetch the like count of one concert
 * @param client LibSQL 客户端 · client
 * @param concertId 演唱会编号 · concert id
 */
export async function fetchLikeCount(client: Client, concertId: number): Promise<number> {
  try {
    const r = await client.execute({
      sql: 'SELECT COUNT(*) AS n FROM concert_likes WHERE concert_id = ?',
      args: [concertId]
    });
    return Number((r.rows[0] as unknown as { n: number } | undefined)?.n ?? 0) || 0;
  } catch {
    return 0;
  }
}

/**
 * 当前 IP 已点赞的演唱会编号集合 · Concert ids liked by the given IP
 * @param client LibSQL 客户端 · client
 * @param ip 客户端 IP（经 resolveClientIp 归一化）· normalized client IP
 */
export async function fetchLikedConcertIds(client: Client, ip: string): Promise<Set<number>> {
  const set = new Set<number>();
  try {
    const r = await client.execute({
      sql: 'SELECT concert_id FROM concert_likes WHERE ip = ?',
      args: [ip]
    });
    for (const row of r.rows as unknown as { concert_id: number }[]) {
      set.add(Number(row.concert_id));
    }
  } catch {
    // 表不存在（未迁移）→ 视为未点赞
  }
  return set;
}

/**
 * 判断某 IP 是否点赞了「某一场」演唱会（单场 EXISTS 查询）· Whether an IP liked one concert
 * @description 单场接口（/api/concerts/:id）只需知道这一场是否被点赞，用 `LIMIT 1` 的 EXISTS 式查询，
 *              比 `fetchLikedConcertIds` 拉取整张 IP 点赞集合更省（尤其该 IP 点赞很多场时）。
 * @param client LibSQL 客户端 · client
 * @param concertId 演唱会编号 · concert id
 * @param ip 客户端 IP（经 resolveClientIp 归一化）· normalized client IP
 */
export async function isConcertLiked(client: Client, concertId: number, ip: string): Promise<boolean> {
  try {
    const r = await client.execute({
      sql: 'SELECT 1 FROM concert_likes WHERE concert_id = ? AND ip = ? LIMIT 1',
      args: [concertId, ip]
    })
    return r.rows.length > 0
  } catch {
    return false
  }
}

/**
 * 切换点赞（已点赞则取消）· Toggle a like (like when absent, unlike when present)
 * @description 先 DELETE，命中则视为取消（rowsAffected > 0）；未命中则 INSERT OR IGNORE 视为点赞。
 *              依赖 `UNIQUE(concert_id, ip)` 保证同一 IP 对同一场仅一条记录，天然幂等、可反复切换。
 * @param client LibSQL 客户端 · client
 * @param concertId 演唱会编号 · concert id
 * @param ip 客户端 IP（经 resolveClientIp 归一化）· normalized client IP
 * @returns 最新 `{ likes, liked }` · latest `{ likes, liked }`
 */
export async function toggleConcertLike(
  client: Client,
  concertId: number,
  ip: string
): Promise<LikeToggleResult> {
  const del = await client.execute({
    sql: 'DELETE FROM concert_likes WHERE concert_id = ? AND ip = ?',
    args: [concertId, ip]
  });

  const liked = Number(del.rowsAffected ?? 0) === 0;
  if (liked) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO concert_likes (concert_id, ip) VALUES (?, ?)',
      args: [concertId, ip]
    });
  }

  // 维护 concerts.likes 冗余计数：仅在确认发生的分支 ±1（liked=点赞 +1，取消 -1），避免同一次操作重复增减；
  // 未迁移库（无 likes 列）或客户端桩不支持该语句时回退实时 COUNT(*)。
  // Maintain the concerts.likes denormalized count: ±1 only on the confirmed branch (like=+1, unlike=-1),
  // never double-counting one toggle; fall back to live COUNT(*) on a pre-migration DB (no likes column) or unsupported stub.
  let likes: number
  try {
    await client.execute({
      sql: 'UPDATE concerts SET likes = MAX(likes + ?, 0) WHERE id = ?',
      args: [liked ? 1 : -1, concertId]
    })
    const r = await client.execute({
      sql: 'SELECT likes FROM concerts WHERE id = ?',
      args: [concertId]
    })
    likes = Number((r.rows[0] as unknown as { likes: number } | undefined)?.likes ?? 0) || 0
  } catch {
    likes = await fetchLikeCount(client, concertId)
  }
  return { likes, liked };
}
