// @vitest-environment happy-dom
/**
 * 留言板 composable 单测 · useGuestbook
 *
 * @description 覆盖本轮留言板改动：
 *              · fetchMessages 分页请求、total/totalPages 更新与过期响应丢弃（竞态）；
 *              · firstPage / lastPage 首页·尾页跳转与边界不请求；
 *              · gotoPage 成功后滚动回留言区顶部、失败不滚动；
 *              · total 字段对外暴露（此前遗漏导致模板「共  条留言」）；
 *              · postMessage 回第 1 页、postReply 刷新当前页。
 *
 *              useState 走 #app 桩（__resetNuxtState 隔离），$fetch 走 __setFetch 注入。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { __setFetch, __resetNuxtState } from '../stubs/nuxt-app'
import type { GuestbookPage } from '../../app/types'

import { useGuestbook } from '../../app/composables/useGuestbook'

/** 请求记录 · recorded fetch calls */
let calls: Array<{ url: string; opts?: Record<string, unknown> }>
/** 可注入的分页响应 · injectable page response */
let pageRes: GuestbookPage

function makePage(page: number, totalPages = 12, total = 104): GuestbookPage {
  return {
    page,
    pageSize: 9,
    totalPages,
    total,
    messages: [{ id: page, nickname: `用户${page}`, content: '内容', createdAt: '2026-01-01', replies: [] }] as GuestbookPage['messages']
  }
}

beforeEach(() => {
  __resetNuxtState() // useState 桩隔离（每次测试独立共享状态）
  calls = []
  pageRes = makePage(1)
  __setFetch(async (url: string, opts?: Record<string, unknown>) => {
    calls.push({ url, opts })
    if (opts?.method === 'POST') return { id: 1, ok: true }
    // 默认按请求页码回包（翻页用例依赖 page 被正确更新）；被用例覆盖时以 pageRes 为准
    const asked = (opts?.query as Record<string, number> | undefined)?.page
    return pageRes.page === asked ? pageRes : makePage(asked ?? pageRes.page)
  })
  // scrollIntoView 桩（happy-dom 无原生实现）· scrollIntoView stub
  Element.prototype.scrollIntoView = vi.fn()
  document.body.innerHTML = '<div id="guestbookSection"></div>'
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useGuestbook — 分页加载与状态', () => {
  it('fetchMessages 按 pageSize 请求，更新 page/totalPages/total/messages', async () => {
    const gb = useGuestbook()
    pageRes = makePage(2, 12, 104)
    await gb.fetchMessages(2)

    expect(calls[0].url).toBe('/api/guestbook')
    expect((calls[0].opts?.query as Record<string, number>)).toEqual({ page: 2, pageSize: 9 })
    expect(gb.page.value).toBe(2)
    expect(gb.totalPages.value).toBe(12)
    expect(gb.total.value).toBe(104) // 本轮修复：composable 必须暴露 total
    expect(gb.messages.value).toHaveLength(1)
    expect(gb.loading.value).toBe(false)
  })

  it('total 对外暴露且与响应一致（回归「共 X 条留言」为空）', async () => {
    const gb = useGuestbook()
    expect(gb.total).toBeDefined()
    pageRes = makePage(3, 5, 41)
    await gb.fetchMessages(3)
    expect(gb.total.value).toBe(41)
  })

  it('快速连续请求：过期响应被丢弃，状态以最后一次为准', async () => {
    const gb = useGuestbook()
    const resolvers: Array<(v: GuestbookPage) => void> = []
    __setFetch(() => new Promise<GuestbookPage>((resolve) => resolvers.push(resolve)))

    const first = gb.fetchMessages(4)
    const second = gb.fetchMessages(6)
    expect(resolvers).toHaveLength(2)
    resolvers[1](makePage(6, 12, 104)) // 后发先回
    await second
    resolvers[0](makePage(4, 12, 104)) // 先发的过期响应
    await first

    expect(gb.page.value).toBe(6) // 未被过期响应覆盖
    expect(gb.messages.value[0].id).toBe(6)
  })

  it('加载失败：error 置值、loading 复位', async () => {
    const gb = useGuestbook()
    const err = new Error('fail')
    __setFetch(async () => { throw err })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await gb.fetchMessages(1)
    expect(gb.error.value).toBe(err)
    expect(gb.loading.value).toBe(false)
    spy.mockRestore()
  })
})

describe('useGuestbook — 首页/尾页/上下页与滚动', () => {
  it('firstPage 从第 N 页跳回第 1 页，成功后滚动回区块顶部', async () => {
    const gb = useGuestbook()
    pageRes = makePage(5)
    await gb.fetchMessages(5)
    calls.length = 0

    gb.firstPage()
    await vi.waitFor(() => expect(gb.page.value).toBe(1))
    const query = calls[0].opts?.query as Record<string, number>
    expect(query.page).toBe(1)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('lastPage 跳到尾页（totalPages）', async () => {
    const gb = useGuestbook()
    await gb.fetchMessages(1)
    calls.length = 0

    gb.lastPage()
    await vi.waitFor(() => expect(gb.page.value).toBe(12))
    expect((calls[0].opts?.query as Record<string, number>).page).toBe(12)
  })

  it('已在首页/尾页时调用 firstPage/lastPage 不请求', async () => {
    const gb = useGuestbook()
    await gb.fetchMessages(1)
    calls.length = 0

    gb.firstPage() // 已在第 1 页
    await Promise.resolve()
    expect(calls).toHaveLength(0)

    pageRes = makePage(12)
    await gb.fetchMessages(12)
    calls.length = 0
    gb.lastPage() // 已在尾页
    await Promise.resolve()
    expect(calls).toHaveLength(0)
  })

  it('prevPage / nextPage 边界不动，页内正常翻页', async () => {
    const gb = useGuestbook()
    await gb.fetchMessages(1)
    calls.length = 0
    gb.prevPage()
    await Promise.resolve()
    expect(calls).toHaveLength(0) // 第 1 页无上一页

    gb.nextPage()
    await vi.waitFor(() => expect(gb.page.value).toBe(2))
    expect(calls).toHaveLength(1)
  })

  it('加载失败时 gotoPage 不滚动', async () => {
    const gb = useGuestbook()
    await gb.fetchMessages(1)
    calls.length = 0
    __setFetch(async () => { throw new Error('fail') })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    gb.nextPage()
    await vi.waitFor(() => expect(gb.error.value).not.toBeNull())
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('useGuestbook — 发布后刷新', () => {
  it('postMessage 成功后回第 1 页刷新', async () => {
    const gb = useGuestbook()
    await gb.fetchMessages(3)
    calls.length = 0

    await gb.postMessage({ nickname: 'A', email: 'a@b.com', content: 'hi' })
    expect(calls[0].url).toBe('/api/guestbook')
    expect(calls[0].opts?.method).toBe('POST')
    expect((calls[1].opts?.query as Record<string, number>).page).toBe(1)
    expect(gb.page.value).toBe(1)
  })

  it('postReply 成功后刷新当前页（不跳页）', async () => {
    const gb = useGuestbook()
    pageRes = makePage(2)
    await gb.fetchMessages(2)
    calls.length = 0

    await gb.postReply({ guestbookId: 2, nickname: 'B', content: 're' })
    expect(calls[0].url).toBe('/api/guestbook/reply')
    expect((calls[1].opts?.query as Record<string, number>).page).toBe(2)
    expect(gb.page.value).toBe(2)
  })

  it('setView 切换卡片/列表视图', () => {
    const gb = useGuestbook()
    expect(gb.view.value).toBe('card')
    gb.setView('list')
    expect(gb.view.value).toBe('list')
  })
})
