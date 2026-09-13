/**
 * POST /api/like · 演唱会点赞 / 取消（按 IP 去重，可反复切换）
 *
 * @description 请求体 `{ id: number }`（演唱会编号，正整数）。
 *              同一 IP 对同一场演唱会仅保留一条记录：未点赞则点赞，已点赞则取消。
 *              成功后返回 `{ id, likes, liked }`，前端据此校准本地计数与状态。
 *              · 非法 id → 400；演唱会不存在 → 404。
 *              · 客户端 IP 经 `getClientIp(event)` 获取（不采信可伪造的 XFF 最左值；直连部署用不可伪造的
 *                socket 地址，反代部署以信任代理的 clientAddress 为准）。详见 server/lib/concertLikes.ts。
 *              · 基础限流：每 IP 每 60s 最多 10 次（见 server/lib/rateLimit.ts），超出 → 429 + Retry-After。
 *
 *              POST /api/like — like/unlike a concert, deduped per IP and freely toggleable.
 *              Body `{ id }`; one row per (IP, concert): absent → like, present → unlike.
 *              Returns `{ id, likes, liked }`. Invalid id → 400; missing concert → 404.
 *              Client IP comes from `getClientIp(event)` (never the forgeable leftmost XFF). Basic
 *              rate limit: 10 req/IP/60s (see server/lib/rateLimit.ts); exceeded → 429 + Retry-After.
 */
import { getTursoClient } from '../lib/turso'
import { toggleConcertLike, getClientIp } from '../lib/mappers'
import { rateLimit } from '../lib/rateLimit'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ id?: unknown }>(event).catch(() => null)
  const rawId = body?.id
  const id = typeof rawId === 'number' ? rawId : typeof rawId === 'string' ? Number(rawId) : NaN

  if (!Number.isInteger(id) || id <= 0) {
    setResponseStatus(event, 400)
    return { error: 'invalid id: 需要正整数 · id must be a positive integer' }
  }

  // 基础限流：抑制伪造 IP 的批量刷赞 · throttle to curb spoofed-IP mass liking
  const ip = getClientIp(event)
  const rl = rateLimit(ip)
  if (!rl.allowed) {
    setResponseStatus(event, 429)
    setResponseHeader(event, 'Retry-After', String(rl.retryAfter))
    return { error: `too many requests: 请 ${rl.retryAfter}s 后重试 · slow down, retry in ${rl.retryAfter}s`, retryAfter: rl.retryAfter }
  }

  const client = getTursoClient()

  // 演唱会必须存在，避免脏数据 · guard against orphan likes
  const exists = await client.execute({ sql: 'SELECT id FROM concerts WHERE id = ?', args: [id] })
  if (!exists.rows.length) {
    setResponseStatus(event, 404)
    return { error: `not found: 演唱会 #${id} 不存在 · concert #${id} does not exist` }
  }

  const { likes, liked } = await toggleConcertLike(client, id, ip)

  return { id, likes, liked }
})
