/**
 * 简单内存限流器 · Minimal in-memory rate limiter
 *
 * @module server/lib/rateLimit
 * @description 固定窗口计数：每 `windowMs` 毫秒内同一 `key`（此处为客户端 IP）最多允许 `max` 次请求。
 *              超出则 `allowed=false`，并给出 `retryAfter`（秒）供 `429` 响应写入 `Retry-After`。
 *
 *              · 用途：给「按 IP 去重」的写接口（点赞）加一层基础节流，抑制直连部署下伪造 IP 的刷量。
 *              · 内存存储：键数 ≈ 近一个窗口内出现的不同 IP 数，数组长度上限 = max，内存可控；
 *                空桶会被及时清理（见 prune）。长期运行进程下无泄漏。
 *              · Serverless 局限：Vercel / 云函数等每个实例独立内存、冷启动重置，限流仅在「单实例」内生效，
 *                跨实例不共享；如需全局精确限流应改用 Redis 等共享存储。本实现作为零依赖的基础防护，
 *                并不替代反代/CDN 层的限流。
 *
 *              · Usage: throttle write endpoints keyed by client IP (likes) to curb spoofed-IP abuse.
 *              · Memory store: key count ≈ distinct IPs in the last window, bounded per-key array; no leak.
 *              · Serverless caveat: per-instance only; use a shared store (e.g. Redis) for global limits.
 */

/** 限流结果 · Rate-limit decision */
export interface RateLimitResult {
  /** 是否放行 · whether the request is allowed */
  allowed: boolean
  /** 本窗口剩余可用次数 · remaining requests in the current window */
  remaining: number
  /** 需等待的秒数（被限流时 > 0）· seconds to wait before retry ( > 0 when blocked) */
  retryAfter: number
}

/** 默认窗口（60 秒）· default window (60s) */
const DEFAULT_WINDOW_MS = 60_000
/** 默认上限（每 IP 每窗口 10 次）· default cap (10 per IP per window) */
const DEFAULT_MAX = 10

// 单个实例的内存桶；key -> 该 key 在时间窗口内的请求时间戳数组。
// in-memory buckets per instance; key -> timestamps of requests within the window.
const buckets = new Map<string, number[]>()

/**
 * 判断某 key 当前是否可放行 · Whether a key is allowed at this moment
 * @param key 限流键（通常为归一化 IP）· rate-limit key (usually the normalized IP)
 * @param opts.windowMs 窗口长度（毫秒），默认 60s · window length in ms (default 60s)
 * @param opts.max 窗口内最大次数，默认 10 · max requests per window (default 10)
 */
export function rateLimit(
  key: string,
  opts?: { windowMs?: number; max?: number }
): RateLimitResult {
  const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS
  const max = opts?.max ?? DEFAULT_MAX
  const now = Date.now()

  // 仅保留窗口内的时间戳 · keep only timestamps inside the window
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length === 0) buckets.delete(key) // 空桶清理 · prune empty bucket

  if (hits.length >= max) {
    // 已达上限：计算最早一次还需多久过期 · at cap: how long until the oldest hit expires
    const retryAfter = Math.max(Math.ceil((windowMs - (now - hits[0])) / 1000), 1)
    return { allowed: false, remaining: 0, retryAfter }
  }

  hits.push(now)
  buckets.set(key, hits)
  return { allowed: true, remaining: max - hits.length, retryAfter: 0 }
}
