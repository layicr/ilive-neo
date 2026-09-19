/**
 * POST /api/guestbook/reply · 发布回复（自动通过）
 *
 * @description 请求体 `{ guestbookId, nickname, content, email? }`。
 *              校验：guestbookId 为正整数、昵称与内容非空、长度上限（昵称 40 / 内容 1000）、
 *              邮箱（若提供）格式；非法 → 400。限流同主留言（每 IP 每 60s 最多 10 次）→ 429 + Retry-After。
 *              回复会校验主留言存在且已通过，否则 → 404（避免孤立/向未通过留言挂回复）。
 *              浏览器/系统/UA/IP 服务端采集；提交即 `is_approved = 1`，返回 `{ id, ok: true }`。
 *
 *              POST /api/guestbook/reply — publish a reply (auto-approved). Body `{ guestbookId, nickname, content, email? }`.
 *              Validates + rate-limits like the message endpoint; 404 if the parent message is missing/unapproved.
 *              Server-collected UA/browser/os/IP; is_approved=1 on submit.
 */
import { getRequestHeader } from 'h3'
import { getTursoClient } from '../../lib/turso'
import { createGuestbookReply, getClientIp } from '../../lib/mappers'
import { parseUserAgent } from '../../lib/ua'
import { rateLimit } from '../../lib/rateLimit'

const MAX_NICKNAME = 40
const MAX_EMAIL = 120
const MAX_CONTENT = 1000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  const body = await readBody<{ guestbookId?: unknown; nickname?: unknown; content?: unknown; email?: unknown }>(event).catch(() => null)
  const rawId = body?.guestbookId
  const guestbookId = typeof rawId === 'number' ? rawId : typeof rawId === 'string' ? Number(rawId) : NaN
  const nickname = typeof body?.nickname === 'string' ? body.nickname.trim() : ''
  const content = typeof body?.content === 'string' ? body.content.trim() : ''
  const emailRaw = typeof body?.email === 'string' ? body.email.trim() : ''
  const email = emailRaw.length ? emailRaw : null

  if (!Number.isInteger(guestbookId) || guestbookId <= 0) {
    setResponseStatus(event, 400)
    return { error: 'invalid input: guestbookId 需要正整数 · guestbookId must be a positive integer' }
  }
  if (!nickname || !content) {
    setResponseStatus(event, 400)
    return { error: 'invalid input: 昵称与内容均必填 · nickname and content are required' }
  }
  if (nickname.length > MAX_NICKNAME || content.length > MAX_CONTENT) {
    setResponseStatus(event, 400)
    return { error: 'invalid input: 字段超出长度限制 · field exceeds length limit' }
  }
  if (email && (email.length > MAX_EMAIL || !EMAIL_RE.test(email))) {
    setResponseStatus(event, 400)
    return { error: 'invalid input: 邮箱格式不正确 · invalid email format' }
  }

  // 基础限流 · basic rate limit
  const ip = getClientIp(event)
  const rl = rateLimit(ip)
  if (!rl.allowed) {
    setResponseStatus(event, 429)
    setResponseHeader(event, 'Retry-After', String(rl.retryAfter))
    return { error: `too many requests: 请 ${rl.retryAfter}s 后重试 · slow down, retry in ${rl.retryAfter}s`, retryAfter: rl.retryAfter }
  }

  // 服务端采集 UA / 浏览器 / 系统 / IP · server-collected UA/browser/os/IP
  const ua = getRequestHeader(event, 'user-agent') ?? null
  const { browser, os } = parseUserAgent(ua)

  const client = getTursoClient()
  const id = await createGuestbookReply(client, {
    guestbookId,
    nickname,
    email,
    content,
    browser,
    os,
    userAgent: ua,
    ip
  })

  if (id === null) {
    setResponseStatus(event, 404)
    return { error: `not found: 留言 #${guestbookId} 不存在或未通过 · message #${guestbookId} not found or not approved` }
  }

  return { id, ok: true }
})
