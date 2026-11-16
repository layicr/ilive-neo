/**
 * 留言板读写 · Guestbook data access
 *
 * @module server/lib/guestbook
 * @description `guestbook`（主留言）与 `guestbook_reply`（回复）两张表的读写封装：
 *              · 写：`createGuestbookMessage` / `createGuestbookReply` —— 提交即 `is_approved = 1`
 *                （自动通过，依用户确认的策略）；回复用单条原子 `INSERT ... SELECT ... WHERE EXISTS`
 *                校验主留言存在且已通过，校验与插入无间隙、不产生孤立回复；
 *                浏览器/系统/UA/IP 全部由服务端采集，绝不采信前端自报。
 *              · 读：`fetchGuestbookMessages(page, pageSize)` —— 仅取 `is_approved = 1` 的主留言，
 *                按 `created_at DESC` 分页；分页后用一条 `IN (...)` 批量取本页全部已通过回复，避免 N+1。
 *
 *              容错：读操作在接口层统一捕获异常转 5xx；本模块不依赖 Nitro 运行时（只用 @libsql/client），
 *              可被 vitest 直接单测。
 *
 *              Writes auto-approve (is_approved=1 per confirmed policy); replies validate the parent
 *              atomically (INSERT ... SELECT ... WHERE EXISTS) so no orphan rows can slip in between
 *              validation and insert; browser/os/UA/IP are server-collected. Reads return only approved
 *              rows, paginated by created_at DESC, with replies fetched in one IN(...) query (no N+1).
 */

import type { Client } from '@libsql/client';
import type { GuestbookMessage, GuestbookReply, GuestbookPage } from '../../app/types';

/** 主留言写入参数 · Message write input */
export interface GuestbookMessageInput {
  /** 昵称 · nickname */
  nickname: string
  /** 邮箱（仅存储）· email (stored only) */
  email: string
  /** 留言内容 · content */
  content: string
  /** 浏览器（服务端解析）· browser (server-parsed) */
  browser: string | null
  /** 操作系统 · os */
  os: string | null
  /** 原始 UA · raw user-agent */
  userAgent: string | null
  /** 访客 IP（服务端采集）· visitor IP (server-collected) */
  ip: string | null
}

/** 回复写入参数 · Reply write input */
export interface GuestbookReplyInput {
  /** 关联主留言编号 · parent message id */
  guestbookId: number
  /** 昵称 · nickname */
  nickname: string
  /** 邮箱（可选，仅存储）· email (optional, stored only) */
  email: string | null
  /** 回复内容 · content */
  content: string
  /** 浏览器（服务端解析）· browser (server-parsed) */
  browser: string | null
  /** 操作系统 · os */
  os: string | null
  /** 原始 UA · raw user-agent */
  userAgent: string | null
  /** 访客 IP（服务端采集）· visitor IP (server-collected) */
  ip: string | null
}

/** guestbook 行 · guestbook row */
interface GuestbookRow {
  id: number
  nickname: string
  content: string
  browser: string | null
  os: string | null
  created_at: string
}

/** guestbook_reply 行 · guestbook_reply row */
interface GuestbookReplyRow {
  id: number
  guestbook_id: number
  nickname: string
  content: string
  browser: string | null
  os: string | null
  created_at: string
}

/**
 * 发布主留言（自动通过）· Create a guestbook message (auto-approved)
 * @returns 新留言的自增 id · the new message's auto-increment id
 */
export async function createGuestbookMessage(client: Client, input: GuestbookMessageInput): Promise<number> {
  // ResultSet 自带 lastInsertRowid，无需再发一条 SELECT last_insert_rowid()（省一次 DB 往返）
  // ResultSet already carries lastInsertRowid; no extra round-trip needed.
  const res = await client.execute({
    sql: `INSERT INTO guestbook (nickname, email, content, browser, os, user_agent, ip, is_approved)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    args: [input.nickname, input.email, input.content, input.browser, input.os, input.userAgent, input.ip]
  })
  return Number(res.lastInsertRowid ?? 0)
}

/**
 * 发布回复（自动通过）· Create a reply (auto-approved)
 * @description 校验与插入合并为一条原子语句（INSERT ... SELECT ... WHERE EXISTS），
 *              消除「校验通过后、插入前父留言被（软）删」的窗口，杜绝孤立回复；
 *              WHERE EXISTS 未命中时插入 0 行，以 rowsAffected 判定失败返回 null。
 *              （注意 SQLite 外键默认关闭且本项目删除为软删，CASCADE 不可依赖。）
 * @returns 新回复 id；父留言无效时返回 null · new reply id, or null when the parent is invalid
 */
export async function createGuestbookReply(client: Client, input: GuestbookReplyInput): Promise<number | null> {
  const res = await client.execute({
    sql: `INSERT INTO guestbook_reply (guestbook_id, nickname, email, content, browser, os, user_agent, ip, is_approved)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, 1
          WHERE EXISTS (SELECT 1 FROM guestbook WHERE id = ? AND is_approved = 1)`,
    args: [
      input.guestbookId, input.nickname, input.email, input.content,
      input.browser, input.os, input.userAgent, input.ip,
      input.guestbookId
    ]
  })
  if (!res.rowsAffected) return null
  return Number(res.lastInsertRowid ?? 0)
}

/**
 * 分页读取已通过留言及其已通过回复 · Fetch approved messages + their approved replies (paginated)
 * @description 仅读 `is_approved = 1`；主留言按 `created_at DESC, id DESC` 分页；
 *              本页回复用一条 `IN (guestbook_id ...)` 查询一次性取回，避免逐条 N+1。
 * @param client LibSQL 客户端 · client
 * @param page 页码（从 1 开始）· page (1-based)
 * @param pageSize 每页条数 · page size
 */
export async function fetchGuestbookMessages(
  client: Client,
  page: number,
  pageSize: number
): Promise<GuestbookPage> {
  const safePage = Math.max(1, Math.floor(page) || 1)
  const safeSize = Math.max(1, Math.min(50, Math.floor(pageSize) || 9))
  const offset = (safePage - 1) * safeSize

  const countRes = await client.execute('SELECT COUNT(*) AS n FROM guestbook WHERE is_approved = 1')
  const total = Number((countRes.rows[0] as unknown as { n: number }).n) || 0
  const totalPages = Math.max(1, Math.ceil(total / safeSize))

  const msgRes = await client.execute({
    sql: `SELECT id, nickname, content, browser, os, created_at
          FROM guestbook WHERE is_approved = 1
          ORDER BY created_at DESC, id DESC
          LIMIT ? OFFSET ?`,
    args: [safeSize, offset]
  })
  const rows = msgRes.rows as unknown as GuestbookRow[]
  const messages: GuestbookMessage[] = rows.map((r) => ({
    id: Number(r.id),
    nickname: String(r.nickname),
    content: String(r.content),
    browser: r.browser != null ? String(r.browser) : null,
    os: r.os != null ? String(r.os) : null,
    createdAt: String(r.created_at),
    replies: []
  }))

  // 批量取本页回复（避免 N+1）· fetch this page's replies in one IN(...) query
  if (messages.length) {
    const ids = messages.map((m) => m.id)
    const placeholders = ids.map(() => '?').join(',')
    const repRes = await client.execute({
      sql: `SELECT id, guestbook_id, nickname, content, browser, os, created_at
            FROM guestbook_reply
            WHERE is_approved = 1 AND guestbook_id IN (${placeholders})
            ORDER BY created_at ASC, id ASC`,
      args: ids
    })
    const replyRows = repRes.rows as unknown as GuestbookReplyRow[]
    const byParent = new Map<number, GuestbookReply[]>()
    for (const rr of replyRows) {
      const reply: GuestbookReply = {
        id: Number(rr.id),
        guestbookId: Number(rr.guestbook_id),
        nickname: String(rr.nickname),
        content: String(rr.content),
        browser: rr.browser != null ? String(rr.browser) : null,
        os: rr.os != null ? String(rr.os) : null,
        createdAt: String(rr.created_at)
      }
      const arr = byParent.get(reply.guestbookId)
      if (arr) arr.push(reply)
      else byParent.set(reply.guestbookId, [reply])
    }
    for (const m of messages) {
      const reps = byParent.get(m.id)
      if (reps) m.replies = reps
    }
  }

  return { messages, page: safePage, pageSize: safeSize, totalPages, total }
}
