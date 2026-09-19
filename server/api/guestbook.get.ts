/**
 * GET /api/guestbook · 分页读取已通过留言及其回复
 *
 * @description 查询参数：`page`（页码，默认 1）、`pageSize`（每页条数，默认 9，上限 50）。
 *              仅返回 `is_approved = 1` 的主留言与回复（自动通过策略下新内容即时可见）；
 *              主留言按时间倒序分页，回复在 mapper 内用一条 `IN (...)` 批量取回，避免 N+1。
 *              异常由 Nitro 转为 500；前端据此展示错误态并重试。
 *
 *              GET /api/guestbook — paginated approved messages + replies. Query `page`/`pageSize`.
 *              Only is_approved=1 rows are returned; replies fetched in one IN(...) batch. Errors → 500.
 */
import { getQuery } from 'h3'
import { getTursoClient } from '../lib/turso'
import { fetchGuestbookMessages } from '../lib/mappers'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Number(query.page) || 1
  const pageSize = Number(query.pageSize) || 9

  const client = getTursoClient()
  return await fetchGuestbookMessages(client, page, pageSize)
})
