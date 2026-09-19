/**
 * 留言板数据组合式 · Guestbook composable
 *
 * @module useGuestbook
 * @description 封装留言板的列表分页、发布主留言、发布回复，以及卡片/列表视图状态。
 *              状态用 `useState` 存储（SSR 安全、同源共享，避免跨请求泄漏），仅 index.vue 使用。
 *              列表接口 `GET /api/guestbook` 带 `page`/`pageSize`；写接口 `POST /api/guestbook`
 *              与 `POST /api/guestbook/reply`。新留言为最新，发布后回到第 1 页刷新；回复提交后刷新当前页。
 *
 *              Wraps guestbook list pagination + publish message/reply + view state. State via useState
 *              (SSR-safe). New messages are newest → jump to page 1 after posting; replies refresh the page.
 */
import { computed } from 'vue'
import { useState } from '#app'
import type { GuestbookMessage, GuestbookPage } from '../types'

/** 每页默认条数 · default page size */
const PAGE_SIZE = 9

interface UseGuestbookReturn {
  /** 当前页主留言（含回复）· messages on current page (with replies) */
  messages: globalThis.Ref<GuestbookMessage[]>
  /** 当前页码（1-based）· current page */
  page: globalThis.Ref<number>
  /** 每页条数 · page size */
  pageSize: globalThis.Ref<number>
  /** 总页数 · total pages */
  totalPages: globalThis.Ref<number>
  /** 已通过留言总数 · total approved messages */
  total: globalThis.Ref<number>
  /** 加载中 · loading */
  loading: globalThis.Ref<boolean>
  /** 错误 · error */
  error: globalThis.Ref<unknown>
  /** 视图：卡片 / 列表 · view: card / list */
  view: globalThis.Ref<'card' | 'list'>
  /** 加载某页（默认当前页）· load a page (default current) */
  fetchMessages: (targetPage?: number) => Promise<void>
  /** 发布主留言（成功后回到第 1 页）· publish a message (jumps to page 1) */
  postMessage: (payload: { nickname: string; email: string; content: string }) => Promise<void>
  /** 发布回复（刷新当前页）· publish a reply (refreshes current page) */
  postReply: (payload: { guestbookId: number; nickname: string; content: string; email?: string }) => Promise<void>
  /** 切换视图 · switch view */
  setView: (v: 'card' | 'list') => void
  /** 上一页 · previous page */
  prevPage: () => void
  /** 下一页 · next page */
  nextPage: () => void
  /** 跳到指定页 · go to a page */
  goPage: (p: number) => void
}

export function useGuestbook(): UseGuestbookReturn {
  // SSR 安全的共享状态（useState：按请求隔离 + 同源组件共享）· SSR-safe shared state
  const messages = useState<GuestbookMessage[]>('guestbook:messages', () => [])
  const page = useState<number>('guestbook:page', () => 1)
  const pageSize = useState<number>('guestbook:pageSize', () => PAGE_SIZE)
  const totalPages = useState<number>('guestbook:totalPages', () => 1)
  const total = useState<number>('guestbook:total', () => 0)
  const loading = useState<boolean>('guestbook:loading', () => false)
  const error = useState<unknown>('guestbook:error', () => null)
  const view = useState<'card' | 'list'>('guestbook:view', () => 'card')

  // 请求序号：丢弃过期响应，避免快速翻页时的竞态覆盖 · request seq: drop stale responses on fast paging
  let loadSeq = 0

  async function fetchMessages(targetPage: number = page.value): Promise<void> {
    loading.value = true
    error.value = null
    const seq = ++loadSeq
    try {
      const res = await $fetch<GuestbookPage>('/api/guestbook', {
        query: { page: targetPage, pageSize: pageSize.value }
      })
      if (seq !== loadSeq) return
      page.value = res.page
      pageSize.value = res.pageSize
      totalPages.value = res.totalPages
      total.value = res.total
      messages.value = res.messages
    } catch (e) {
      if (seq !== loadSeq) return
      error.value = e
      console.error('[useGuestbook] 加载失败 · load failed:', e)
    } finally {
      if (seq === loadSeq) loading.value = false
    }
  }

  async function postMessage(payload: { nickname: string; email: string; content: string }): Promise<void> {
    await $fetch<{ id: number; ok: boolean }>('/api/guestbook', {
      method: 'POST',
      body: payload
    })
    // 新留言为最新，回到第 1 页刷新 · newest message → back to page 1
    await fetchMessages(1)
  }

  async function postReply(payload: { guestbookId: number; nickname: string; content: string; email?: string }): Promise<void> {
    await $fetch<{ id: number; ok: boolean }>('/api/guestbook/reply', {
      method: 'POST',
      body: payload
    })
    // 刷新当前页以纳入新回复 · refresh current page to include the new reply
    await fetchMessages(page.value)
  }

  function setView(v: 'card' | 'list'): void {
    view.value = v
  }
  function prevPage(): void {
    if (page.value > 1) void fetchMessages(page.value - 1)
  }
  function nextPage(): void {
    if (page.value < totalPages.value) void fetchMessages(page.value + 1)
  }
  function goPage(p: number): void {
    if (p >= 1 && p <= totalPages.value) void fetchMessages(p)
  }

  // computed 透传（保持返回形状稳定）· pass-through computed for a stable return shape
  const messagesRef = computed(() => messages.value)
  void messagesRef

  return {
    messages,
    page,
    pageSize,
    totalPages,
    total,
    loading,
    error,
    view,
    fetchMessages,
    postMessage,
    postReply,
    setView,
    prevPage,
    nextPage,
    goPage
  }
}
