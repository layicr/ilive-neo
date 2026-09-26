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
 *                    **这四步必须原子完成**：已迁移到交互式事务（BEGIN IMMEDIATE）内执行，
 *                    并以 COUNT(*) 重算冗余计数而非 ±1（详见该函数注释）。
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

import type { Client, Transaction } from '@libsql/client';
import { getRequestHeader, getRequestIP, type H3Event } from 'h3';

/**
 * 执行器抽象 · Executor abstraction
 * @description `Client` 与 `Transaction` 都提供同签名的 `execute`，把点赞切换的步骤抽成纯步骤函数后
 *              既能在事务内跑，也能在不支持事务的客户端上顺序跑。
 *              Both Client and Transaction expose the same `execute` signature, so the toggle steps can run
 *              inside a transaction or sequentially on clients without transaction support.
 */
export type LikeExecutor = Pick<Client, 'execute'>;

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
export async function fetchLikeCount(client: LikeExecutor, concertId: number): Promise<number> {
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

/** 该 (concert_id, ip) 行是否存在 · whether the like row exists */
async function likeRowExists(exec: LikeExecutor, concertId: number, ip: string): Promise<boolean> {
  const r = await exec.execute({
    sql: 'SELECT 1 FROM concert_likes WHERE concert_id = ? AND ip = ? LIMIT 1',
    args: [concertId, ip]
  });
  return r.rows.length > 0;
}

/**
 * 以真实点赞行为准「重算」concerts.likes 冗余列 · Recompute the denormalized counter from truth
 * @description 旧实现是在确认分支上 `likes ± 1`：四条语句非原子，并发（双击 / 重试 / 多实例）下
 *              会**永久漂移**（如 `INSERT OR IGNORE` 因并发冲突被忽略却仍 +1）。
 *              这里改成**单条 UPDATE 内用 COUNT(*) 赋值** —— 计数不再依赖「上一次是否准」，天然自愈。
 *
 *              未迁移库没有 `concerts.likes` 列，属预期回退，退用实时 COUNT(*)；
 *              **其它失败必须向上抛**，否则冗余列会长期不一致且无人察觉（旧实现一律静默吞掉）。
 */
async function syncLikesColumn(exec: LikeExecutor, concertId: number): Promise<number> {
  try {
    await exec.execute({
      sql: 'UPDATE concerts SET likes = (SELECT COUNT(*) FROM concert_likes WHERE concert_id = ?) WHERE id = ?',
      args: [concertId, concertId]
    });
    const r = await exec.execute({
      sql: 'SELECT likes FROM concerts WHERE id = ?',
      args: [concertId]
    });
    return Number((r.rows[0] as unknown as { likes: number } | undefined)?.likes ?? 0) || 0;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/no such column|has no column|no column named/i.test(msg)) throw e;
    return fetchLikeCount(exec, concertId);
  }
}

/**
 * 切换点赞的步骤实现（事务内外共用）· Toggle steps (shared by the transactional and sequential paths)
 * @description 返回的 `liked` 一律以**库中真实行状态**为准：INSERT OR IGNORE 在并发抢先插入时会静默
 *              no-op，此时补一次 EXISTS 判断，杜绝「返回 liked=true 但库中无行」这类不一致。
 */
async function runToggle(exec: LikeExecutor, concertId: number, ip: string): Promise<LikeToggleResult> {
  const del = await exec.execute({
    sql: 'DELETE FROM concert_likes WHERE concert_id = ? AND ip = ?',
    args: [concertId, ip]
  });

  const existed = Number(del.rowsAffected ?? 0) > 0;
  let liked: boolean;
  if (existed) {
    // 原本已点赞 → 已删除，本次是取消 · was liked → removed, so this toggle is an unlike
    liked = false;
  } else {
    // 原本未点赞 → 插入 · was absent → insert
    const ins = await exec.execute({
      sql: 'INSERT OR IGNORE INTO concert_likes (concert_id, ip) VALUES (?, ?)',
      args: [concertId, ip]
    });
    liked = Number(ins.rowsAffected ?? 0) > 0 || (await likeRowExists(exec, concertId, ip));
  }

  return { likes: await syncLikesColumn(exec, concertId), liked };
}

/**
 * 切换点赞（已点赞则取消）· Toggle a like (like when absent, unlike when present)
 * @description 依赖 `UNIQUE(concert_id, ip)` 保证同一 IP 对同一场仅一条记录，天然幂等、可反复切换。
 *
 *              **原子性**：`DELETE → INSERT → 重算冗余列` 三步存在「先读后写」依赖，若中间被穿插，
 *              轻则计数漂移，重则返回与库中不一致的 `liked`。因此在交互式事务（`"write"` 模式，
 *              等价于 BEGIN IMMEDIATE）内串行化执行，任一语句失败即整体回滚。
 *
 *              Atomicity: DELETE → INSERT → recompute has a read-modify-write dependency. Interleaving
 *              drifts the counter or yields a `liked` that disagrees with the table, so the whole sequence
 *              runs inside an interactive transaction (`"write"` = BEGIN IMMEDIATE) and rolls back on any error.
 *
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
  if (typeof client.transaction !== 'function') {
    // 极简客户端（测试替身 / 未来可能的轻量驱动）不支持事务：保持旧的顺序执行语义
    return runToggle(client, concertId, ip);
  }

  let tx: Transaction;
  try {
    tx = await client.transaction('write');
  } catch {
    // 环境不支持交互式事务（如远程端不支持）→ 降级为顺序执行，保证点赞功能可用
    return runToggle(client, concertId, ip);
  }

  try {
    const res = await runToggle(tx as unknown as LikeExecutor, concertId, ip);
    await tx.commit();
    return res;
  } catch (e) {
    // 回滚，避免留下半截写入；回滚自身失败不必掩盖原始错误
    try {
      await tx.rollback();
    } catch {
      /* 事务已失效，原始错误才是关键 */
    }
    throw e;
  } finally {
    // commit / rollback 后再 close 是空操作（见 @libsql/core Transaction.close 文档）
    tx.close();
  }
}
