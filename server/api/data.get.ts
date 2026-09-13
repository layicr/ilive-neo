/**
 * GET /api/data · 聚合端点（多语言）
 *
 * @description 返回演唱会 / 城市 / 许愿的多语言数据（LocalizedConcert / LocalizedCity / LocalizedWish），
 *              前端按当前 locale 本地化。支持可选 `?lang=` 直接返回单语言本地化结果（便于爬虫 / 分享 / SEO）。
 *              回退链由前端 pickLocale 保证：未翻译语言回退到 zh。
 *
 *              点赞：每场演唱会的 `likes`（总数）与 `liked`（当前请求 IP 是否点赞）一并返回。
 *              为避免「共享缓存串用户」，分两层：
 *                · 内层 buildShared —— 只产出与请求者无关的共享数据（含点赞计数），生产环境做 1 小时 SWR 缓存；
 *                · 外层 export —— 非缓存，拿到共享数据后按当前 IP 合并 `liked` 再返回。
 *              生产环境启用 Nitro SWR 缓存（仅共享层）。
 *
 *              GET /api/data aggregation (multi-locale). Returns multi-locale concerts/cities/wishes for
 *              the client to localize, or single-locale results when `?lang=` is given (crawler/share/SEO).
 *              Likes are split into two layers to avoid cross-user cache leakage: the inner `buildShared`
 *              emits only request-agnostic data (with like counts, 1h SWR in production); the outer
 *              export (uncached) merges `liked` for the current IP before returning.
 */
import { getTursoClient } from '../lib/turso'
import {
  fetchAllConcerts,
  fetchSiteSeo,
  fetchFriendLinks,
  fetchLikedConcertIds,
  getClientIp,
  parseI18n,
  LOCALES
} from '../lib/mappers'
import type { CityRow } from '../lib/mappers'
import { localizeConcert, localizeCity, localizeWish, computeCityConcertCounts } from '../../app/utils'
import type { Locale, LocalizedCity, LocalizedWish, AppData, ApiResponse } from '../../app/types'

const buildShared = defineEventHandler(async (event) => {
  const client = getTursoClient()

  // SEO 设置、友情链接与业务数据并行取回，并入同一响应体（不新增 API 端点、不增加请求数）
  // Fetch SEO settings, friend links and business data in parallel and merge them into one response body (no extra endpoints, no extra requests)
  const [concertRowsRaw, cityRows, wishRows, seo, friendLinks] = await Promise.all([
    fetchAllConcerts(client),
    client.execute('SELECT id, country_i18n, name_i18n, seq, icon FROM cities ORDER BY seq'),
    client.execute('SELECT id, content_i18n, likes, liked FROM wishes ORDER BY id DESC'),
    fetchSiteSeo(client),
    fetchFriendLinks(client)
  ])

  // 点赞总数直接取 concerts.likes 冗余列（由 toggleConcertLike 维护，未迁移库回退 0）；
  // liked 为「按请求 IP」字段，此处固定 false，由外层非缓存 handler 合并（缓存不得携带个人状态）。
  // Like total comes straight from the concerts.likes denormalized column (maintained by toggleConcertLike;
  // pre-migration falls back to 0); `liked` is per-request-IP, kept false here and merged by the outer handler.
  const concertRows = concertRowsRaw.map((c) => ({ ...c, liked: false }))

  const cities: LocalizedCity[] = (cityRows.rows as unknown as CityRow[]).map((c) => ({
    id: c.id,
    name: parseI18n(c.name_i18n),
    seq: c.seq ?? 0,
    icon: c.icon ?? null
  }))

  const wishes: LocalizedWish[] = (wishRows.rows as unknown as any[]).map((w) => ({
    id: w.id,
    content: parseI18n(w.content_i18n),
    likes: Number(w.likes ?? 0),
    liked: Boolean(w.liked)
  }))

  const stats = {
    totalConcerts: concertRows.length,
    totalArtists: new Set(concertRows.map((c) => c.artist['zh-CN'])).size,
    totalCities: cities.length,
    totalWishes: wishes.length
  }

  const counts = computeCityConcertCounts(concertRows, cities)

  // 可选：?lang= 直接本地化为单语言结果（便于爬虫 / SEO）· optional ?lang localization
  const langParam = (getQuery(event).lang as string | undefined) ?? ''
  const locale: Locale | null = (LOCALES as string[]).includes(langParam) ? (langParam as Locale) : null

  let concertsOut: unknown[] = concertRows
  let citiesOut: unknown[] = cities.map((c) => ({ ...c, concertCount: counts[c.id] ?? 0 }))
  let wishesOut: unknown[] = wishes

  if (locale) {
    concertsOut = concertRows.map((c) => localizeConcert(c, locale))
    citiesOut = cities.map((c) => ({ ...localizeCity(c, locale), concertCount: counts[c.id] ?? 0 }))
    wishesOut = wishes.map((w) => localizeWish(w, locale))
  }

  const data = {
    concerts: concertsOut,
    cities: citiesOut,
    wishes: wishesOut,
    stats,
    seo,
    friendLinks,
    locale,
    generatedAt: new Date().toISOString()
  } as unknown as AppData

  return { data, generatedAt: data.generatedAt } as ApiResponse
})

/** 共享层（可按 URL 缓存；不含任何按 IP 的个人状态）· shared, cacheable layer */
const cachedShared = import.meta.dev
  ? buildShared
  : defineCachedEventHandler(buildShared, {
      maxAge: 60 * 60,
      swr: true,
      name: 'all-data'
    })

/**
 * 外层：非缓存，按当前请求 IP 合并 `liked` 后返回
 * @description 必须每次执行，否则会把某个访问者的已点赞状态缓存并返回给其他人。
 *              Outer, uncached: merges `liked` for the current request IP before returning.
 *              Must run on every request, otherwise one visitor's liked state could be cached and
 *              served to others.
 */
export default defineEventHandler(async (event) => {
  const shared = (await cachedShared(event)) as ApiResponse
  const ip = getClientIp(event)
  const likedIds = await fetchLikedConcertIds(getTursoClient(), ip)

  const concerts = (shared.data.concerts as unknown as { id: number }[]).map((c) => ({
    ...c,
    liked: likedIds.has(Number(c.id))
  }))

  return {
    data: { ...shared.data, concerts },
    generatedAt: shared.generatedAt
  } as ApiResponse
})
