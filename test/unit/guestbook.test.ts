/**
 * 留言板单元测试 · Unit tests for `server/lib/guestbook.ts` & `server/lib/ua.ts`
 *
 * @description 用内存 Client 桩覆盖：
 *              · `createGuestbookMessage` 提交即 `is_approved=1`（自动通过）并回显 id；
 *              · `createGuestbookReply` 校验父留言存在且已通过，否则返回 null（避免孤立回复）；
 *              · `fetchGuestbookMessages` 仅读已通过、分页、并用一条 `IN (...)` 批量取回复（无 N+1）；
 *              · UGC 原样落库（不做转义）—— 转义由前端 `{{ }}` 文本插值负责（XSS 防护契约）；
 *              · `parseUserAgent` 服务端 UA 解析（浏览器 / 系统）的覆盖分支。
 *
 *              With an in-memory Client stub, covers auto-approve on write, reply parent validation,
 *              read-only-approved pagination with batched IN(...) replies (no N+1), the "store UGC raw,
 *              let the frontend escape" XSS contract, and parseUserAgent coverage.
 */
import { describe, it, expect } from 'vitest'
import type { Client } from '@libsql/client'
import {
  createGuestbookMessage,
  createGuestbookReply,
  fetchGuestbookMessages
} from '../../server/lib/guestbook'
import { parseUserAgent } from '../../server/lib/ua'

/** 带内部存储的桩客户端（供测试断言已写入的行）· stub client exposing internal storage for assertions */
type StubClient = Client & { __messages: any[]; __replies: any[] }

/** 内存留言板桩 · in-memory guestbook stub */
function stubClient(seedMessages: any[] = [], seedReplies: any[] = []): StubClient {
  const messages = seedMessages.map((m, i) => ({
    id: m.id ?? i + 1,
    nickname: m.nickname ?? 'n',
    email: m.email ?? 'e@e.com',
    content: m.content ?? 'c',
    browser: m.browser ?? null,
    os: m.os ?? null,
    created_at: m.created_at ?? '2026-01-01 00:00:00',
    is_approved: m.is_approved ?? 1
  }))
  const replies = seedReplies.map((r, i) => ({
    id: r.id ?? i + 1,
    guestbook_id: r.guestbook_id,
    nickname: r.nickname ?? 'n',
    content: r.content ?? 'c',
    browser: r.browser ?? null,
    os: r.os ?? null,
    created_at: r.created_at ?? '2026-01-01 00:00:00',
    is_approved: r.is_approved ?? 1
  }))
  let seq = Math.max(0, ...messages.map((m) => m.id), ...replies.map((r) => r.id))

  const stub = {
    execute: async (q: unknown) => {
      const sql = typeof q === 'string' ? q : String((q as { sql: string }).sql)
      const args = (typeof q === 'string' ? [] : ((q as { args?: unknown[] }).args ?? [])) as unknown[]

      if (sql.includes('last_insert_rowid')) {
        return { rows: [{ id: seq }], rowsAffected: 0 }
      }
      // 先判 guestbook_reply（避免被 guestbook 前缀误匹配）· check reply first
      if (sql.startsWith('INSERT INTO guestbook_reply')) {
        seq += 1
        replies.push({
          id: seq,
          guestbook_id: Number(args[0]), nickname: args[1], email: args[2], content: args[3],
          browser: args[4], os: args[5], user_agent: args[6], ip: args[7],
          created_at: '2026-01-01 00:00:00', is_approved: 1 // 写接口硬编码 is_approved=1（自动通过）
        })
        return { rows: [], rowsAffected: 1 }
      }
      if (sql.startsWith('INSERT INTO guestbook')) {
        seq += 1
        messages.push({
          id: seq,
          nickname: args[0], email: args[1], content: args[2],
          browser: args[3], os: args[4], user_agent: args[5], ip: args[6],
          created_at: '2026-01-01 00:00:00', is_approved: 1 // 写接口硬编码 is_approved=1（自动通过）
        })
        return { rows: [], rowsAffected: 1 }
      }
      if (sql.startsWith('SELECT id FROM guestbook')) {
        const id = Number(args[0])
        const found = messages.find((m) => m.id === id && m.is_approved === 1)
        return { rows: found ? [{ id }] : [], rowsAffected: 0 }
      }
      if (sql.startsWith('SELECT COUNT')) {
        const n = messages.filter((m) => m.is_approved === 1).length
        return { rows: [{ n }], rowsAffected: 0 }
      }
      if (sql.includes('FROM guestbook WHERE is_approved = 1') && sql.includes('ORDER BY')) {
        const limit = Number(args[0])
        const offset = Number(args[1])
        const approved = messages.filter((m) => m.is_approved === 1)
        const page = approved.slice(offset, offset + limit)
        return {
          rows: page.map((m) => ({
            id: m.id, nickname: m.nickname, content: m.content,
            browser: m.browser, os: m.os, created_at: m.created_at
          })),
          rowsAffected: 0
        }
      }
      if (sql.includes('FROM guestbook_reply') && sql.includes('IN')) {
        const ids = args.map((x) => Number(x))
        const matched = replies.filter((r) => r.is_approved === 1 && ids.includes(r.guestbook_id))
        return {
          rows: matched.map((r) => ({
            id: r.id, guestbook_id: r.guestbook_id, nickname: r.nickname, content: r.content,
            browser: r.browser, os: r.os, created_at: r.created_at
          })),
          rowsAffected: 0
        }
      }
      return { rows: [], rowsAffected: 0 }
    }
  }
  // 暴露内部存储供断言（仅测试桩）· expose internal storage for assertions (test-only)
  return Object.assign(stub, { __messages: messages, __replies: replies }) as unknown as StubClient
}

describe('createGuestbookMessage — 发布主留言（自动通过 + 原样存储 UGC）', () => {
  it('提交即 is_approved=1 并回显自增 id', async () => {
    const client = stubClient()
    const id = await createGuestbookMessage(client, {
      nickname: 'A', email: 'a@b.com', content: 'hi',
      browser: 'Chrome', os: 'macOS', userAgent: 'ua', ip: '1.1.1.1'
    })
    expect(id).toBe(1)
    const page = await fetchGuestbookMessages(client, 1, 10)
    expect(page.messages).toHaveLength(1)
    expect(page.total).toBe(1)
    expect(page.messages[0].content).toBe('hi')
  })

  it('UGC 原样落库（含 HTML 不做转义），转义交前端 {{ }} 负责', async () => {
    const client = stubClient()
    await createGuestbookMessage(client, {
      nickname: 'x', email: 'x@y.com', content: '<script>alert(1)</script>',
      browser: null, os: null, userAgent: 'ua', ip: '1.1.1.1'
    })
    const page = await fetchGuestbookMessages(client, 1, 10)
    // 后端存储原始文本；前端文本插值会自动 HTML 转义 → XSS 防护契约
    expect(page.messages[0].content).toBe('<script>alert(1)</script>')
  })
})

describe('createGuestbookReply — 发布回复（校验父留言 + 自动通过）', () => {
  it('父留言存在且已通过 → 返回 id，回复随父留言返回', async () => {
    const client = stubClient([{ id: 1, nickname: 'A', email: 'a@b.com', content: 'hi', is_approved: 1 }])
    const rid = await createGuestbookReply(client, {
      guestbookId: 1, nickname: 'B', content: 're',
      browser: null, os: null, userAgent: 'ua', ip: '1.1.1.1'
    })
    expect(rid).toBe(2)
    const page = await fetchGuestbookMessages(client, 1, 10)
    expect(page.messages[0].replies).toHaveLength(1)
    expect(page.messages[0].replies[0].content).toBe('re')
  })

  it('父留言不存在 → 返回 null（避免孤立回复）', async () => {
    const client = stubClient()
    const rid = await createGuestbookReply(client, {
      guestbookId: 99, nickname: 'B', content: 're',
      browser: null, os: null, userAgent: 'ua', ip: '1.1.1.1'
    })
    expect(rid).toBeNull()
  })

  it('父留言未通过(is_approved=0) → 返回 null', async () => {
    const client = stubClient([{ id: 1, nickname: 'A', email: 'a@b.com', content: 'hi', is_approved: 0 }])
    const rid = await createGuestbookReply(client, {
      guestbookId: 1, nickname: 'B', content: 're',
      browser: null, os: null, userAgent: 'ua', ip: '1.1.1.1'
    })
    expect(rid).toBeNull()
  })
})

describe('createGuestbookReply — 可选邮箱与 UGC 原样存储', () => {
  it('携带邮箱时写入 guestbook_reply.email', async () => {
    const client = stubClient([{ id: 1, nickname: 'A', email: 'a@b.com', content: 'hi', is_approved: 1 }])
    await createGuestbookReply(client, {
      guestbookId: 1, nickname: 'B', email: 'b@c.com', content: 're',
      browser: null, os: null, userAgent: 'ua', ip: '1.1.1.1'
    })
    expect(client.__replies[0].email).toBe('b@c.com')
  })

  it('未提供邮箱时写入 null（可选字段）', async () => {
    const client = stubClient([{ id: 1, nickname: 'A', email: 'a@b.com', content: 'hi', is_approved: 1 }])
    await createGuestbookReply(client, {
      guestbookId: 1, nickname: 'B', content: 're',
      browser: null, os: null, userAgent: 'ua', ip: '1.1.1.1'
    })
    expect(client.__replies[0].email ?? null).toBeNull()
  })

  it('回复内容含 HTML 原样落库（转义交前端 {{ }} 负责）', async () => {
    const client = stubClient([{ id: 1, nickname: 'A', email: 'a@b.com', content: 'hi', is_approved: 1 }])
    await createGuestbookReply(client, {
      guestbookId: 1, nickname: 'B', content: '<script>alert(1)</script>',
      browser: null, os: null, userAgent: 'ua', ip: '1.1.1.1'
    })
    const page = await fetchGuestbookMessages(client, 1, 10)
    expect(page.messages[0].replies[0].content).toBe('<script>alert(1)</script>')
  })
})

describe('fetchGuestbookMessages — 仅读已通过 + 分页 + IN 批量取回复', () => {
  it('未通过的留言不返回，total 只计已通过', async () => {
    const client = stubClient([
      { id: 1, nickname: 'A', email: 'a@b.com', content: 'ok', is_approved: 1 },
      { id: 2, nickname: 'B', email: 'a@b.com', content: 'bad', is_approved: 0 }
    ])
    const page = await fetchGuestbookMessages(client, 1, 10)
    expect(page.messages).toHaveLength(1)
    expect(page.total).toBe(1)
  })

  it('分页：12 条已通过、每页 5 → totalPages=3，第 3 页 2 条', async () => {
    const seed = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1, nickname: 'n' + i, email: 'a@b.com', content: 'c' + i, is_approved: 1
    }))
    const client = stubClient(seed)
    const p1 = await fetchGuestbookMessages(client, 1, 5)
    expect(p1.messages).toHaveLength(5)
    expect(p1.totalPages).toBe(3)
    expect(p1.total).toBe(12)
    const p3 = await fetchGuestbookMessages(client, 3, 5)
    expect(p3.messages).toHaveLength(2)
  })

  it('IN 批量取回复：父 1 两条、父 2 一条，均随父返回', async () => {
    const client = stubClient(
      [
        { id: 1, nickname: 'A', email: 'a@b.com', content: 'm1', is_approved: 1 },
        { id: 2, nickname: 'B', email: 'a@b.com', content: 'm2', is_approved: 1 }
      ],
      [
        { id: 1, guestbook_id: 1, nickname: 'R', content: 'r1', is_approved: 1 },
        { id:2, guestbook_id: 1, nickname: 'R', content: 'r2', is_approved: 1 },
        { id: 3, guestbook_id: 2, nickname: 'R', content: 'r3', is_approved: 1 }
      ]
    )
    const page = await fetchGuestbookMessages(client, 1, 10)
    const m1 = page.messages.find((m) => m.id === 1)!
    const m2 = page.messages.find((m) => m.id === 2)!
    expect(m1.replies).toHaveLength(2)
    expect(m2.replies).toHaveLength(1)
  })

  it('未通过的回复不随父返回', async () => {
    const client = stubClient(
      [{ id: 1, nickname: 'A', email: 'a@b.com', content: 'm1', is_approved: 1 }],
      [{ id: 1, guestbook_id: 1, nickname: 'R', content: 'spam', is_approved: 0 }]
    )
    const page = await fetchGuestbookMessages(client, 1, 10)
    expect(page.messages[0].replies).toHaveLength(0)
  })
})

describe('parseUserAgent — 服务端 UA 解析', () => {
  it('Chrome / macOS', () => {
    const { browser, os } = parseUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
    )
    expect(browser).toBe('Chrome')
    expect(os).toBe('macOS')
  })

  it('Edge 优先于 Chrome 判定（现代 Edge 用 Edg/ 令牌）', () => {
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0').browser).toBe('Edge')
  })

  it('Firefox / Windows 10-11', () => {
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/121.0').browser).toBe('Firefox')
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0) Firefox/121.0').os).toBe('Windows 10/11')
  })

  it('Android / iOS', () => {
    expect(parseUserAgent('Mozilla/5.0 (Linux; Android 13) Chrome/120').os).toBe('Android')
    expect(parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0) AppleWebKit Safari').os).toBe('iOS')
  })

  it('空 / 缺失 UA → Unknown', () => {
    expect(parseUserAgent('').browser).toBe('Unknown')
    expect(parseUserAgent(null).os).toBe('Unknown')
  })
})
