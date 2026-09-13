/**
 * 演唱会点赞单元测试 · Unit tests for `server/lib/concertLikes.ts`
 *
 * @description 用最小 Client 桩（内存 Set）覆盖：
 *              · `resolveClientIp` 的归一化与兜底；
 *              · `toggleConcertLike` 的「点赞 → 取消」切换与幂等（同一 IP 仅一条）；
 *              · `fetchLikeCounts` / `fetchLikeCount` / `fetchLikedConcertIds` 的聚合与查询；
 *              · `concert_likes` 表缺失（查询抛错）时的容错（视为无点赞，不抛错）。
 *
 *              With a minimal in-memory Client stub, covers: `resolveClientIp` normalization/fallback;
 *              `toggleConcertLike` like→unlike toggling & idempotency (one row per IP); aggregation/queries
 *              of `fetchLikeCounts`/`fetchLikeCount`/`fetchLikedConcertIds`; tolerance when the
 *              `concert_likes` table is missing (treated as "no likes", never throws).
 */
import { describe, it, expect } from 'vitest'
import type { Client } from '@libsql/client'
import {
  resolveClientIp,
  fetchLikeCount,
  fetchLikeCounts,
  fetchLikedConcertIds,
  isConcertLiked,
  toggleConcertLike
} from '../../server/lib/concertLikes'

/** 内存点赞表桩 · in-memory like table stub */
function stubClient(initial: { concert_id: number; ip: string }[] = [], initialLikes: Record<number, number> = {}): Client {
  const table = new Set(initial.map((r) => `${r.concert_id}::${r.ip}`))
  const likeCount = new Map<number, number>(Object.entries(initialLikes).map(([k, v]) => [Number(k), v]))
  const key = (concertId: number, ip: string) => `${concertId}::${ip}`

  return {
    execute: async (q: unknown) => {
      const sql = typeof q === 'string' ? q : String((q as { sql: string }).sql)
      const args = (typeof q === 'string' ? [] : ((q as { args?: unknown[] }).args ?? [])) as (number | string)[]

      if (sql.startsWith('UPDATE concerts')) {
        const [sign, cid] = args
        const cur = likeCount.get(Number(cid)) ?? 0
        likeCount.set(Number(cid), Math.max(cur + Number(sign), 0))
        return { rows: [], rowsAffected: 1 }
      }

      if (sql.startsWith('SELECT likes FROM concerts') && sql.includes('WHERE id = ?')) {
        const [cid] = args
        return { rows: [{ likes: likeCount.get(Number(cid)) ?? 0 }], rowsAffected: 0 }
      }

      if (sql.startsWith('DELETE FROM concert_likes')) {
        const [concertId, ip] = args
        const k = key(Number(concertId), String(ip))
        const had = table.has(k)
        if (had) table.delete(k)
        return { rows: [], rowsAffected: had ? 1 : 0 }
      }

      if (sql.startsWith('INSERT OR IGNORE INTO concert_likes')) {
        const [concertId, ip] = args
        const before = table.size
        table.add(key(Number(concertId), String(ip)))
        return { rows: [], rowsAffected: table.size > before ? 1 : 0 }
      }

      if (sql.includes('COUNT(*)') && sql.includes('WHERE concert_id')) {
        const [concertId] = args
        let n = 0
        for (const k of table) if (Number(k.split('::')[0]) === Number(concertId)) n += 1
        return { rows: [{ n }], rowsAffected: 0 }
      }

      if (sql.includes('GROUP BY concert_id')) {
        const m = new Map<number, number>()
        for (const k of table) {
          const cid = Number(k.split('::')[0])
          m.set(cid, (m.get(cid) ?? 0) + 1)
        }
        return { rows: [...m].map(([concert_id, n]) => ({ concert_id, n })), rowsAffected: 0 }
      }

      if (sql.includes('SELECT 1 FROM concert_likes') && sql.includes('AND ip = ?')) {
        const [concertId, ip] = args
        const found = [...table].some((k) => {
          const [cid, rowIp] = k.split('::')
          return Number(cid) === Number(concertId) && rowIp === String(ip)
        })
        return { rows: found ? [{ '1': 1 }] : [], rowsAffected: 0 }
      }

      if (sql.includes('SELECT concert_id FROM concert_likes')) {
        const [ip] = args
        const ids: number[] = []
        for (const k of table) {
          const [cid, rowIp] = k.split('::')
          if (rowIp === String(ip)) ids.push(Number(cid))
        }
        return { rows: ids.map((concert_id) => ({ concert_id })), rowsAffected: 0 }
      }

      return { rows: [], rowsAffected: 0 }
    }
  } as unknown as Client
}

/** 表不存在 / DB 不可用的桩 · a client whose queries always fail */
function failingClient(): Client {
  return {
    execute: async () => {
      throw new Error('SQLITE_ERROR: no such table: concert_likes')
    }
  } as unknown as Client
}

describe('resolveClientIp — IP 归一化与兜底', () => {
  it('正常 IP 原样返回（去空白）', () => {
    expect(resolveClientIp(' 203.0.113.7 ')).toBe('203.0.113.7')
    expect(resolveClientIp('2001:db8::1')).toBe('2001:db8::1')
  })

  it('缺失 / 空串 → unknown', () => {
    expect(resolveClientIp('')).toBe('unknown')
    expect(resolveClientIp('   ')).toBe('unknown')
    expect(resolveClientIp(null)).toBe('unknown')
    expect(resolveClientIp(undefined)).toBe('unknown')
  })

  it('超长（异常头）截断到 64 字符', () => {
    expect(resolveClientIp('a'.repeat(100))).toHaveLength(64)
  })
})

describe('toggleConcertLike — 点赞 / 取消切换', () => {
  it('首次点赞：新增一行，liked=true，计数 1', async () => {
    const client = stubClient()
    const res = await toggleConcertLike(client, 1, '1.1.1.1')
    expect(res).toEqual({ likes: 1, liked: true })
  })

  it('再次点击：取消点赞，liked=false，计数回到 0', async () => {
    const client = stubClient()
    await toggleConcertLike(client, 1, '1.1.1.1')
    const res = await toggleConcertLike(client, 1, '1.1.1.1')
    expect(res).toEqual({ likes: 0, liked: false })
  })

  it('可反复切换：三次操作后回到已点赞', async () => {
    const client = stubClient()
    await toggleConcertLike(client, 2, '1.1.1.1')
    await toggleConcertLike(client, 2, '1.1.1.1')
    const res = await toggleConcertLike(client, 2, '1.1.1.1')
    expect(res).toEqual({ likes: 1, liked: true })
  })

  it('不同 IP 各自计数，互不影响', async () => {
    const client = stubClient()
    await toggleConcertLike(client, 3, '1.1.1.1')
    const res = await toggleConcertLike(client, 3, '2.2.2.2')
    expect(res).toEqual({ likes: 2, liked: true })
  })

  it('不同演唱会计数独立', async () => {
    const client = stubClient()
    await toggleConcertLike(client, 1, '1.1.1.1')
    const res = await toggleConcertLike(client, 2, '1.1.1.1')
    expect(res).toEqual({ likes: 1, liked: true })
    expect(await fetchLikeCount(client, 1)).toBe(1)
  })
})

describe('fetchLikeCounts / fetchLikedConcertIds — 聚合查询', () => {
  it('GROUP BY 返回每场点赞数（无点赞的场次不出现，由调用方兜底 0）', async () => {
    const client = stubClient([
      { concert_id: 1, ip: 'a' },
      { concert_id: 1, ip: 'b' },
      { concert_id: 2, ip: 'a' }
    ])
    const counts = await fetchLikeCounts(client)
    expect(counts.get(1)).toBe(2)
    expect(counts.get(2)).toBe(1)
    expect(counts.get(3)).toBeUndefined()
  })

  it('按 IP 返回已点赞的演唱会 id 集合', async () => {
    const client = stubClient([
      { concert_id: 1, ip: 'a' },
      { concert_id: 5, ip: 'a' },
      { concert_id: 2, ip: 'b' }
    ])
    const liked = await fetchLikedConcertIds(client, 'a')
    expect([...liked].sort((x, y) => x - y)).toEqual([1, 5])
    expect((await fetchLikedConcertIds(client, 'c')).size).toBe(0)
  })
})

describe('容错 — concert_likes 表缺失（未迁移）', () => {
  it('读接口不抛错，视为无点赞', async () => {
    const client = failingClient()
    expect((await fetchLikeCounts(client)).size).toBe(0)
    expect(await fetchLikeCount(client, 1)).toBe(0)
    expect((await fetchLikedConcertIds(client, 'a')).size).toBe(0)
  })
})

describe('isConcertLiked — 单场点赞判断（EXISTS 查询）', () => {
  it('该 IP 点赞过则返回 true，否则 false', async () => {
    const client = stubClient([
      { concert_id: 3, ip: '1.2.3.4' },
      { concert_id: 9, ip: '5.6.7.8' }
    ])
    expect(await isConcertLiked(client, 3, '1.2.3.4')).toBe(true)
    expect(await isConcertLiked(client, 9, '5.6.7.8')).toBe(true)
    // 不同 IP / 不同场次均视为未点赞
    expect(await isConcertLiked(client, 3, '9.9.9.9')).toBe(false)
    expect(await isConcertLiked(client, 7, '1.2.3.4')).toBe(false)
  })

  it('表缺失（未迁移）时不抛错，返回 false', async () => {
    expect(await isConcertLiked(failingClient(), 3, '1.2.3.4')).toBe(false)
  })
})
