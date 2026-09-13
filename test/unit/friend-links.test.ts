/**
 * 友情链接：DB 驱动（无内置回退）· Friend links: DB-only
 *
 * @description 覆盖 friend_links 的取数链（对应 SEO_DB_MIGRATION.md 同类约束）：
 *              · `fetchFriendLinks` DB 优先（仅 enabled=1、href 非空、按 seq 排序）；
 *              · 未迁移 / 表不存在 / DB 不可用 → 返回空数组且不抛错；
 *              · `resolveFriendLinks` 空数组 / null / undefined → 返回空数组（不回退内置列表）；
 *              · 单条字段级兜底（无内置数据）：icon 缺失 → 通用图标；
 *                title 缺失 → 回退 href；description 缺失 → null；
 *              · 三语言取值（zh-CN / en / zh-Hant）各自独立。
 *
 *              Covers the friend_links data chain: fetchFriendLinks DB-first (enabled=1, non-empty href,
 *              ordered by seq); missing/DB-unavailable → empty array without throwing; resolveFriendLinks
 *              returns [] for empty/null/undefined (no built-in fallback); per-field fallbacks (missing
 *              icon → generic icon, missing title → href, missing description → null); three locales independent.
 */
import { describe, it, expect } from 'vitest'
import { fetchFriendLinks, mapFriendLink, FRIEND_LINK_ICON_FALLBACK } from '../../server/lib/mappers'
import type { FriendLinkRow } from '../../server/lib/mappers'
import { resolveFriendLinks, localizeFriendLink } from '../../app/utils/friendLinks'
import type { Locale, LocalizedFriendLink } from '../../app/types'

/** 语言清单（与项目 3 语言一致）· locale list */
const LOCALES: Locale[] = ['zh-CN', 'en', 'zh-Hant']

/** 最小 Client 桩（仅 fetchFriendLinks 用到的 execute(sql)）· minimal Client stub */
function stubClient(rows: FriendLinkRow[]) {
  return {
    execute: async () => ({ rows })
  } as never
}

/** 查询失败桩（模拟未迁移 / DB 不可用）· failing Client stub */
function failingClient(message = 'SQLITE_ERROR: no such table: friend_links') {
  return {
    execute: async () => {
      throw new Error(message)
    }
  } as never
}

/** 构造 friend_links 行 · build a friend_links row */
function row(partial: Partial<FriendLinkRow> & { id: number }): FriendLinkRow {
  return {
    href: 'https://example.com',
    icon: 'fas fa-globe',
    title_i18n: '{"zh-CN":"示例","en":"Example"}',
    description_i18n: null,
    seq: 0,
    enabled: 1,
    ...partial
  }
}

describe('UT-13b mapFriendLink / fetchFriendLinks — DB 优先', () => {
  it('DB 有值 → 按 seq 顺序取回，字段映射正确', async () => {
    const links = await fetchFriendLinks(
      stubClient([
        row({ id: 1, href: 'https://a.example.com', icon: 'fab fa-github', title_i18n: '{"zh-CN":"甲","en":"A"}', seq: 1 }),
        row({ id: 2, href: 'https://b.example.com', title_i18n: '{"zh-CN":"乙","en":"B"}', seq: 2 })
      ])
    )
    expect(links).toHaveLength(2)
    expect(links[0].href).toBe('https://a.example.com')
    expect(links[0].icon).toBe('fab fa-github')
    expect(links[0].title['zh-CN']).toBe('甲')
    expect(links[1].title.en).toBe('B')
  })

  it('运营在库中改写的值优先（不覆盖、不回退）', async () => {
    const links = await fetchFriendLinks(
      stubClient([row({ id: 1, href: 'https://www.facebook.com/layicr', title_i18n: '{"zh-CN":"脸书","en":"FB"}', seq: 9 })])
    )
    const localized = localizeFriendLink(links[0], 'zh-CN')
    expect(localized.title).toBe('脸书')
  })

  it('icon 为 null → 回退通用图标；description 为 null → 保持 null', async () => {
    const mapped = mapFriendLink(row({ id: 1, icon: null }))
    expect(mapped.icon).toBe(FRIEND_LINK_ICON_FALLBACK)
    expect(mapped.description).toBeNull()
  })

  it('title_i18n 非法 JSON → 不抛错，回退 { "zh-CN": "" } 由展示层再回退', async () => {
    const mapped = mapFriendLink(row({ id: 1, title_i18n: 'not-json' }))
    expect(mapped.title['zh-CN']).toBe('')
  })

  it('href 为空的行被过滤（不产生空链接）', async () => {
    const links = await fetchFriendLinks(
      stubClient([row({ id: 1, href: '   ' }), row({ id: 2, href: 'https://ok.example.com' })])
    )
    expect(links).toHaveLength(1)
    expect(links[0].href).toBe('https://ok.example.com')
  })
})

describe('UT-13c 回退链 — 空 DB / 未迁移 / 查询失败 → 空列表', () => {
  it('空 DB：fetchFriendLinks 返回空数组', async () => {
    expect(await fetchFriendLinks(stubClient([]))).toEqual([])
  })

  it('未迁移 / DB 不可用：不抛错，返回空数组', async () => {
    const links = await fetchFriendLinks(failingClient())
    expect(links).toEqual([])
  })

  it('空 DB → resolveFriendLinks 返回空数组（不再回退内置列表）', () => {
    for (const locale of LOCALES) {
      expect(resolveFriendLinks([], locale)).toEqual([])
    }
  })

  it('null / undefined（数据未就绪）→ 返回空数组', () => {
    expect(resolveFriendLinks(null, 'en')).toEqual([])
    expect(resolveFriendLinks(undefined, 'zh-Hant')).toEqual([])
  })

  it('DB 行全部非法（href 为空）→ 过滤后返回空数组', () => {
    const links = resolveFriendLinks([{ id: 1, href: '', icon: null, title: { 'zh-CN': '' }, description: null, seq: 1 }], 'zh-CN')
    expect(links).toEqual([])
  })
})

describe('UT-13d 多语言取值与字段级回退', () => {
  it('DB 含 3 语言时各 locale 取到各自文案', () => {
    const link: LocalizedFriendLink = {
      id: 1,
      href: 'https://weibo.com/layicr',
      icon: 'fab fa-weibo',
      title: { 'zh-CN': '微博', en: 'Weibo', 'zh-Hant': '微博' },
      description: { 'zh-CN': '微博主页', en: 'Weibo profile', 'zh-Hant': '微博主頁' },
      seq: 1
    }
    expect(localizeFriendLink(link, 'zh-CN').title).toBe('微博')
    expect(localizeFriendLink(link, 'en').title).toBe('Weibo')
    expect(localizeFriendLink(link, 'zh-Hant').title).toBe('微博')
    expect(localizeFriendLink(link, 'zh-Hant').description).toBe('微博主頁')
  })

  it('DB 缺某语言 → 按 pickLocale 回退链兜底（zh-CN → en），不返回空', () => {
    const link: LocalizedFriendLink = {
      id: 1,
      href: 'https://twitter.com/layicr',
      icon: 'fab fa-twitter',
      title: { 'zh-CN': '推特' },
      description: null,
      seq: 1
    }
    expect(localizeFriendLink(link, 'zh-Hant').title).toBe('推特')
    expect(localizeFriendLink(link, 'en').title).toBe('推特')
  })

  it('DB 行 title 全空 → 回退 href 本身，绝不空名称', () => {
    const link: LocalizedFriendLink = {
      id: 1,
      href: 'https://weibo.com/layicr',
      icon: null,
      title: { 'zh-CN': '' },
      description: null,
      seq: 1
    }
    const hant = localizeFriendLink(link, 'zh-Hant')
    expect(hant.title).toBe('https://weibo.com/layicr')
    expect(hant.icon).toBe(FRIEND_LINK_ICON_FALLBACK)
  })

  it('DB 出现新链接：名称取自 DB，缺失字段回退 href / 通用图标', () => {
    const links = resolveFriendLinks(
      [{ id: 1, href: 'https://new.example.com', icon: '', title: { 'zh-CN': '新站点' }, description: null, seq: 1 }],
      'zh-CN'
    )
    expect(links).toHaveLength(1)
    expect(links[0].title).toBe('新站点')
    expect(links[0].icon).toBe(FRIEND_LINK_ICON_FALLBACK)
  })
})
