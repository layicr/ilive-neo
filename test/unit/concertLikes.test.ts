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
import { describe, it, expect, afterEach } from 'vitest'
import type { Client } from '@libsql/client'
import type { H3Event } from 'h3'
import {
  resolveClientIp,
  getClientIp,
  fetchLikeCount,
  fetchLikeCounts,
  fetchLikedConcertIds,
  isConcertLiked,
  toggleConcertLike
} from '../../server/lib/concertLikes'

/** 最小 H3Event 桩 · minimal H3Event stub (only the fields getClientIp reads) */
function fakeEvent(headers: Record<string, string | undefined>, remoteAddress = '127.0.0.1'): H3Event {
  return {
    context: {},
    node: {
      req: {
        headers,
        socket: { remoteAddress }
      }
    }
  } as unknown as H3Event
}

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
        // 新实现：likes = (SELECT COUNT(*) FROM concert_likes WHERE concert_id = ?)
        // 以真实行为准重算，而非旧的 ±1 增量
        const cid = Number(args[args.length - 1])
        let real = 0
        for (const k of table) if (Number(k.split('::')[0]) === cid) real += 1
        likeCount.set(cid, real)
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

/** 未迁移库：concerts 无 likes 冗余列，UPDATE 会抛错 · pre-migration DB, no `likes` column */
function noLikesColumnClient(): Client {
  const table = new Set<string>()
  return {
    execute: async (q: unknown) => {
      const sql = typeof q === 'string' ? q : String((q as { sql: string }).sql)
      const args = (typeof q === 'string' ? [] : ((q as { args?: unknown[] }).args ?? [])) as (number | string)[]

      if (sql.startsWith('DELETE FROM concert_likes')) {
        const [concertId, ip] = args
        const k = `${concertId}::${ip}`
        const had = table.has(k)
        if (had) table.delete(k)
        return { rows: [], rowsAffected: had ? 1 : 0 }
      }
      if (sql.startsWith('INSERT OR IGNORE INTO concert_likes')) {
        const [concertId, ip] = args
        table.add(`${concertId}::${ip}`)
        return { rows: [], rowsAffected: 1 }
      }
      if (sql.startsWith('UPDATE concerts')) throw new Error('SQLITE_ERROR: no such column: likes')
      if (sql.includes('COUNT(*)')) return { rows: [{ n: table.size }], rowsAffected: 0 }
      return { rows: [], rowsAffected: 0 }
    }
  } as unknown as Client
}

describe('冗余计数回退 — concerts.likes 列缺失（未迁移库）', () => {
  it('UPDATE 抛错时回退实时 COUNT(*)，点赞 / 取消仍正确', async () => {
    const client = noLikesColumnClient()
    expect(await toggleConcertLike(client, 1, '1.1.1.1')).toEqual({ likes: 1, liked: true })
    expect(await toggleConcertLike(client, 1, '1.1.1.1')).toEqual({ likes: 0, liked: false })
  })
})

/**
 * 支持交互式事务的客户端桩 · Transaction-capable client stub
 * @description 记录语句是跑在事务里还是裸客户端上、以及 commit / rollback 次数，
 *              用于验证 toggleConcertLike 的原子性保证。
 *              `concurrentInsert` 模拟「另一个事务抢先插入」：INSERT OR IGNORE 会 no-op，
 *              但行最终存在 —— 用于验证 liked 以真实行状态为准。
 */
function txClient(opts: { failOn?: RegExp; concurrentInsert?: boolean } = {}) {
  const table = new Set<string>()
  const likeCount = new Map<number, number>()
  const key = (c: number, i: string) => `${c}::${i}`
  const txSql: string[] = []
  const clientSql: string[] = []
  let commits = 0
  let rollbacks = 0

  const executeFn = (sink: string[], inTx: boolean) => async (q: unknown) => {
    const sql = typeof q === 'string' ? q : String((q as { sql: string }).sql)
    const args = (typeof q === 'string' ? [] : ((q as { args?: unknown[] }).args ?? [])) as (number | string)[]
    sink.push(sql)
    if (inTx && opts.failOn?.test(sql)) throw new Error('SQLITE_ERROR: simulated failure')

    if (sql.startsWith('UPDATE concerts')) {
      const cid = Number(args[args.length - 1])
      let real = 0
      for (const k of table) if (Number(k.split('::')[0]) === cid) real += 1
      likeCount.set(cid, real)
      return { rows: [], rowsAffected: 1 }
    }
    if (sql.startsWith('SELECT likes FROM concerts')) {
      return { rows: [{ likes: likeCount.get(Number(args[0])) ?? 0 }], rowsAffected: 0 }
    }
    if (sql.startsWith('DELETE FROM concert_likes')) {
      const [c, i] = args
      const had = table.has(key(Number(c), String(i)))
      if (had) table.delete(key(Number(c), String(i)))
      return { rows: [], rowsAffected: had ? 1 : 0 }
    }
    if (sql.startsWith('INSERT OR IGNORE INTO concert_likes')) {
      const [c, i] = args
      const before = table.size
      table.add(key(Number(c), String(i)))
      const inserted = !opts.concurrentInsert && table.size > before
      return { rows: [], rowsAffected: inserted ? 1 : 0 }
    }
    if (sql.includes('COUNT(*)') && sql.includes('WHERE concert_id')) {
      let n = 0
      for (const k of table) if (Number(k.split('::')[0]) === Number(args[0])) n += 1
      return { rows: [{ n }], rowsAffected: 0 }
    }
    if (sql.includes('SELECT 1 FROM concert_likes')) {
      const [c, i] = args
      return { rows: table.has(key(Number(c), String(i))) ? [{ '1': 1 }] : [], rowsAffected: 0 }
    }
    return { rows: [], rowsAffected: 0 }
  }

  const client = {
    execute: executeFn(clientSql, false),
    transaction: async () => ({
      execute: executeFn(txSql, true),
      executeBatch: async () => [],
      commit: async () => {
        commits += 1
      },
      rollback: async () => {
        rollbacks += 1
      },
      close: () => {},
      closed: false
    })
  }

  return {
    client: client as unknown as Client,
    log: {
      get commits() {
        return commits
      },
      get rollbacks() {
        return rollbacks
      },
      txSql,
      clientSql
    }
  }
}

describe('toggleConcertLike — 原子性（交互式事务）', () => {
  it('语句在事务内执行并提交，未降级到裸客户端', async () => {
    const { client, log } = txClient()
    const res = await toggleConcertLike(client, 1, '1.1.1.1')

    expect(res).toEqual({ likes: 1, liked: true })
    expect(log.txSql.some((s) => s.startsWith('DELETE FROM concert_likes'))).toBe(true)
    expect(log.txSql.some((s) => s.startsWith('INSERT OR IGNORE INTO concert_likes'))).toBe(true)
    expect(log.txSql.some((s) => s.startsWith('UPDATE concerts'))).toBe(true)
    expect(log.clientSql).toHaveLength(0)
    expect(log.commits).toBe(1)
    expect(log.rollbacks).toBe(0)
  })

  it('取消点赞同样走事务', async () => {
    const { client, log } = txClient()
    await toggleConcertLike(client, 1, '1.1.1.1')
    const res = await toggleConcertLike(client, 1, '1.1.1.1')

    expect(res).toEqual({ likes: 0, liked: false })
    expect(log.commits).toBe(2)
    expect(log.rollbacks).toBe(0)
  })

  it('事务中语句失败 → 回滚、不提交，并把错误向上抛', async () => {
    const { client, log } = txClient({ failOn: /UPDATE concerts/ })

    await expect(toggleConcertLike(client, 1, '1.1.1.1')).rejects.toThrow('simulated failure')
    expect(log.rollbacks).toBe(1)
    expect(log.commits).toBe(0)
  })

  it('客户端不支持 transaction() 时降级为顺序执行（行为不变）', async () => {
    const client = stubClient() // 只有 execute，没有 transaction
    expect(await toggleConcertLike(client, 1, '1.1.1.1')).toEqual({ likes: 1, liked: true })
    expect(await toggleConcertLike(client, 1, '1.1.1.1')).toEqual({ likes: 0, liked: false })
  })
})

describe('toggleConcertLike — 计数自愈与并发一致（旧 ±1 写法的痛点）', () => {
  it('冗余列已被写歪时，本次操作后回到真实 COUNT(*)', async () => {
    const client = stubClient([], { 1: 99 }) // concerts.likes 列被写歪成 99，实际 0 行点赞
    const res = await toggleConcertLike(client, 1, '1.1.1.1')
    expect(res.likes).toBe(1) // 旧 +1 写法会得到 100
  })

  it('INSERT OR IGNORE 被并发抢先插入（rowsAffected=0）时，liked 以真实行状态为准', async () => {
    const { client } = txClient({ concurrentInsert: true })
    const res = await toggleConcertLike(client, 1, '1.1.1.1')
    // 行确实存在（并发插入），不能谎报「未点赞」
    expect(res.liked).toBe(true)
    expect(res.likes).toBe(1)
  })
})

describe('toggleConcertLike — 非预期写失败不再被静默吞掉', () => {
  it('UPDATE 因缺列失败仍回退 COUNT(*)；其它错误必须抛出', async () => {
    // 缺列 → 静默回退（预期）
    const missing = noLikesColumnClient()
    expect(await toggleConcertLike(missing, 1, '1.1.1.1')).toEqual({ likes: 1, liked: true })

    // 其它错误 → 抛出，避免冗余列长期不一致而无人察觉
    const broken = {
      execute: async (q: unknown) => {
        const sql = typeof q === 'string' ? q : String((q as { sql: string }).sql)
        if (sql.startsWith('UPDATE concerts')) throw new Error('database is locked')
        return { rows: [], rowsAffected: 0 }
      }
    } as unknown as Client
    await expect(toggleConcertLike(broken, 1, '1.1.1.1')).rejects.toThrow('database is locked')
  })
})

describe('getClientIp — 客户端 IP 解析（含 Vercel 真实 IP）', () => {
  const prevVercel = process.env.VERCEL
  const prevTrust = process.env.NUXT_TRUST_PROXY

  afterEach(() => {
    // 还原环境变量，避免污染其它用例 · restore env after each case
    if (prevVercel === undefined) delete process.env.VERCEL
    else process.env.VERCEL = prevVercel
    if (prevTrust === undefined) delete process.env.NUXT_TRUST_PROXY
    else process.env.NUXT_TRUST_PROXY = prevTrust
  })

  it('Vercel（VERCEL=1）优先取平台注入的 x-vercel-forwarded-for（最左真实客户端 IP）', () => {
    process.env.VERCEL = '1'
    delete process.env.NUXT_TRUST_PROXY
    const ip = getClientIp(
      fakeEvent({ 'x-vercel-forwarded-for': '203.0.113.7, 10.0.0.1', 'x-forwarded-for': 'spoofed, 203.0.113.7' })
    )
    expect(ip).toBe('203.0.113.7')
  })

  it('Vercel 下即使伪造 x-forwarded-for 也不会被采信（x-vercel-forwarded-for 优先且平台覆写）', () => {
    process.env.VERCEL = '1'
    // 仅发 x-forwarded-for（无 vercel 头）→ 走 getRequestIP 的 XFF 分支，取最左（伪造值），但真实部署中 Vercel 会同时注入 vercel 头
    const ip = getClientIp(fakeEvent({ 'x-forwarded-for': '198.51.100.9, 10.0.0.1' }))
    expect(ip).toBe('198.51.100.9')
  })

  it('非 Vercel 且未声明 NUXT_TRUST_PROXY → 用不可伪造的 socket 地址（防 XFF 伪造刷量）', () => {
    delete process.env.VERCEL
    delete process.env.NUXT_TRUST_PROXY
    const ip = getClientIp(fakeEvent({ 'x-forwarded-for': '198.51.100.9' }, '127.0.0.1'))
    expect(ip).toBe('127.0.0.1')
  })

  it('非 Vercel 但显式 NUXT_TRUST_PROXY=true（可信反代覆写 XFF）→ 取最左 XFF', () => {
    delete process.env.VERCEL
    process.env.NUXT_TRUST_PROXY = 'true'
    const ip = getClientIp(fakeEvent({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }, '127.0.0.1'))
    expect(ip).toBe('203.0.113.7')
  })

  it('取不到任何 IP → unknown（兜底，功能不崩）', () => {
    delete process.env.VERCEL
    delete process.env.NUXT_TRUST_PROXY
    expect(getClientIp(fakeEvent({}, ''))).toBe('unknown')
  })
})
