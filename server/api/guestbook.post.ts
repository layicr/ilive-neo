/**
 * POST /api/guestbook · 发布主留言（自动通过）
 *
 * @description 请求体 `{ nickname, email, content }`（均为字符串，必填）。
 *              校验：三项非空、长度上限（昵称 40 / 邮箱 120 / 内容 1000）、邮箱格式；
 *              非法 → 400。基础限流：每 IP 每 60s 最多 10 次（见 server/lib/rateLimit.ts），超出 → 429 + Retry-After。
 *              浏览器/系统由服务端解析 UA 得到，IP 由 `getClientIp` 采集，绝不采信前端自报；
 *              提交即 `is_approved = 1`（自动通过策略），返回 `{ id, ok: true }`。
 *
 *              POST /api/guestbook — publish a message (auto-approved). Body `{ nickname, email, content }`.
 *              Validates non-empty/length/email; 400 on invalid; rate-limited 10/IP/60s → 429.
 *              browser/os parsed server-side from UA; IP from getClientIp; is_approved=1 on submit.
 */
import { getRequestHeader } from 'h3'
import { getTursoClient } from '../lib/turso'
import { createGuestbookMessage, getClientIp } from '../lib/mappers'
import { parseUserAgent } from '../lib/ua'
import { rateLimit } from '../lib/rateLimit'

const MAX_NICKNAME = 40
const MAX_EMAIL = 120
const MAX_CONTENT = 1000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  const body = await readBody<{ nickname?: unknown; email?: unknown; content?: unknown }>(event).catch(() => null)
  const nickname = typeof body?.nickname === 'string' ? body.nickname.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const content = typeof body?.content === 'string' ? body.content.trim() : ''

  if (!nickname || !email || !content) {
    setResponseStatus(event, 400)
    return { error: 'invalid input: 昵称、邮箱、内容均必填 · nickname, email and content are required' }
  }
  if (nickname.length > MAX_NICKNAME || email.length > MAX_EMAIL || content.length > MAX_CONTENT) {
    setResponseStatus(event, 400)
    return { error: 'invalid input: 字段超出长度限制 · field exceeds length limit' }
  }
  if (!EMAIL_RE.test(email)) {
    setResponseStatus(event, 400)
    return { error: 'invalid input: 邮箱格式不正确 · invalid email format' }
  }

  // 基础限流：抑制伪造 IP 的批量刷留言 · throttle to curb spoofed-IP mass posting
  const ip = getClientIp(event)
  const rl = rateLimit(ip)
  if (!rl.allowed) {
    setResponseStatus(event, 429)
    setResponseHeader(event, 'Retry-After', String(rl.retryAfter))
    return { error: `too many requests: 请 ${rl.retryAfter}s 后重试 · slow down, retry in ${rl.retryAfter}s`, retryAfter: rl.retryAfter }
  }

  // 服务端采集 UA / 浏览器 / 系统 / IP · server-collected UA/browser/os/IP (never client-claimed)
  const ua = getRequestHeader(event, 'user-agent') ?? null
  const { browser, os } = parseUserAgent(ua)

  const client = getTursoClient()
  const id = await createGuestbookMessage(client, {
    nickname,
    email,
    content,
    browser,
    os,
    userAgent: ua,
    ip
  })

  return { id, ok: true }
})
