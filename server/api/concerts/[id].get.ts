/**
 * GET /api/concerts/:id · 单场演唱会详情（多语言，含 tags/images/songlist 与点赞）
 *
 * @param id 演唱会ID（必须为正整数）· Concert id (positive integer)
 * @param ?lang 可选，直接返回单语言本地化结果
 * @returns 多语言演唱会对象（含 `likes` / `liked`）；非法 id 返回 400，未找到返回 404
 *
 * 说明：点赞拆两层——共享内容（含点赞计数）可缓存，`liked`（按请求 IP）由外层非缓存 handler 合并，
 *      避免把某个访问者的已点赞状态缓存后返回给其他人。
 *
 *              GET /api/concerts/:id — one concert's details (multi-locale, with tags/images/songlist & likes).
 *              Likes are split into two layers: shared content (with counts) is cacheable, while `liked`
 *              (per request IP) is merged by the outer uncached handler so one visitor's state is never
 *              served to others.
 */
import { getTursoClient } from '../../lib/turso'
import { fetchConcert, isConcertLiked, getClientIp, LOCALES } from '../../lib/mappers'
import { localizeConcert } from '../../../app/utils'
import type { Locale } from '../../../app/types'

const buildShared = defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, 'id')

  // 输入校验：必须为正整数 · Input validation: must be a positive integer
  if (!/^\d+$/.test(idParam ?? '')) {
    setResponseStatus(event, 400)
    return { error: 'invalid id: 需要正整数 · id must be a positive integer' }
  }

  const id = parseInt(idParam as string, 10)
  const client = getTursoClient()
  const concert = await fetchConcert(client, id)

  if (!concert) {
    setResponseStatus(event, 404)
    return { error: `not found: 演唱会 #${id} 不存在 · concert #${id} does not exist` }
  }

  // 共享内容：点赞总数直接取 concerts.likes；liked 固定 false，由外层按 IP 合并
  // Like total comes straight from concerts.likes; liked stays false, merged per IP by the outer layer
  const withLikes = { ...concert, liked: false }

  // 可选：?lang= 直接本地化 · optional ?lang localization
  const langParam = (getQuery(event).lang as string | undefined) ?? ''
  const locale: Locale | null = (LOCALES as string[]).includes(langParam) ? (langParam as Locale) : null

  return locale ? (localizeConcert(withLikes, locale) as unknown) : (withLikes as unknown)
})

const cachedShared = import.meta.dev
  ? buildShared
  : defineCachedEventHandler(buildShared, {
      maxAge: 60 * 60,
      swr: true,
      name: 'concert-by-id'
    })

/** 外层：非缓存，按当前请求 IP 合并 `liked` · per-IP merge, never cached */
export default defineEventHandler(async (event) => {
  const shared = (await cachedShared(event)) as Record<string, unknown>

  if (shared && typeof shared === 'object' && 'id' in shared) {
    const ip = getClientIp(event)
    const liked = await isConcertLiked(getTursoClient(), Number(shared.id), ip)
    return { ...shared, liked }
  }

  return shared
})
