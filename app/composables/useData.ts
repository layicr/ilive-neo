/**
 * 数据获取与本地化 · Data fetching + localization
 *
 * @module useData
 * @description 在客户端组合式函数中获取聚合数据（/api/data），并按当前 locale 本地化为单语言。
 *              多语言文案与数据均经 @nuxtjs/i18n 的 locale（URL 前缀驱动）确定，SSR 安全。
 */
import { computed } from 'vue'
import { useAsyncData, useState } from '#app'
import { useAppI18n } from './useI18n'
import type { Concert, City, Wish, LocalizedConcert, LocalizedCity, LocalizedWish, LocalizedFriendLink, Locale, ApiResponse, SiteSeoSettings } from '../types'
import { localizeConcert, localizeCity, localizeWish, computeCityConcertCounts } from '../utils'

/** 点赞在途标记（按演唱会 id）：防止连点并发重复请求 · in-flight guard per concert id */
const likeInFlight = new Set<number>()
/** 点赞冷却（按演唱会 id，记录上次完成时间戳）：连点过快时忽略，避免打满服务端限流（429）· per-id cooldown */
const likeCooldown = new Map<number, number>()
/** 同一演唱会两次点赞的最小间隔（毫秒）· minimum gap between toggles for the same concert */
const LIKE_COOLDOWN_MS = 700

interface UseDataReturn {
  loading: globalThis.Ref<boolean>
  /** 数据是否已就绪（!loading && !error）· data ready flag */
  dataReady: globalThis.Ref<boolean>
  /** 数据是否出错 · data error flag */
  dataError: globalThis.Ref<boolean>
  error: globalThis.Ref<unknown>
  concerts: globalThis.Ref<LocalizedConcert[]>
  cities: globalThis.Ref<LocalizedCity[]>
  wishes: globalThis.Ref<LocalizedWish[]>
  localizedConcerts: globalThis.Ref<Concert[]>
  localizedCities: globalThis.Ref<City[]>
  localizedWishes: globalThis.Ref<Wish[]>
  counts: globalThis.Ref<Record<number, number>>
  stats: globalThis.Ref<{ totalConcerts: number; totalArtists: number; totalCities: number; totalWishes: number }>
  /** 站点级 SEO 设置（来自 /api/data 的 seo 字段；数据未就绪时为 null）· site SEO from `/api/data` */
  seo: globalThis.Ref<SiteSeoSettings | null>
  /** 页脚友情链接（DB 优先；为空时由前端回退代码列表）· footer friend links */
  friendLinks: globalThis.Ref<LocalizedFriendLink[]>
  generatedAt: globalThis.Ref<string>
  refresh: () => Promise<void>
  /** 点赞切换（乐观更新 + 失败回滚）· toggle a like with optimistic update */
  toggleLike: (id: number) => Promise<void>
}

/**
 * 聚合数据组合式 · Aggregate data composable
 * @description SSR 预取 /api/data，客户端按 locale 本地化演唱会/城市/许愿。
 */
export function useData(): UseDataReturn {
  const { currentLanguage } = useAppI18n()

  /**
   * SSR 期间转发客户端 IP 头 · forward client IP headers during SSR
   * @description `/api/data` 的 `liked` 按请求 IP 合并；SSR 的内部请求默认不带这些头，
   *              会以「服务端视角」计算 IP，导致 SSR 首屏的点赞态与水合后不一致。
   *              转发后 SSR 与浏览器看到同一 IP（客户端渲染时返回 undefined，浏览器请求自带）。
   */
  const ipHeaders = import.meta.server
    ? useRequestHeaders(['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip'])
    : undefined

  // 按当前语言请求单语言本地化结果（服务端返回更小 payload，且仅按该语言本地化）· single-locale request
  const { data, pending, error, refresh } = useAsyncData<ApiResponse>(
    `app-data-${currentLanguage.value}`,
    () => $fetch(`/api/data?lang=${encodeURIComponent(currentLanguage.value)}`, { headers: ipHeaders })
  )

  const loading = computed(() => pending.value)
  const dataReady = computed(() => !pending.value && !error.value)
  const dataError = computed(() => !!error.value)
  const concerts = computed<LocalizedConcert[]>(() => data.value?.data.concerts ?? [])
  const cities = computed<LocalizedCity[]>(() => data.value?.data.cities ?? [])
  const wishes = computed<LocalizedWish[]>(() => data.value?.data.wishes ?? [])
  const stats = computed(() => data.value?.data.stats ?? { totalConcerts: 0, totalArtists: 0, totalCities: 0, totalWishes: 0 })
  /** 站点级 SEO 设置（DB 优先；缺失回退由页面级负责）· site-level SEO settings */
  const seo = computed<SiteSeoSettings | null>(() => data.value?.data.seo ?? null)
  /** 页脚友情链接（DB 优先；为空时由展示层回退内置列表）· footer friend links */
  const friendLinks = computed<LocalizedFriendLink[]>(() => data.value?.data.friendLinks ?? [])
  const generatedAt = computed(() => data.value?.generatedAt ?? '')

  /** 当前语言（AppLocale 即 Locale）· current locale */
  const lang = computed<Locale>(() => currentLanguage.value as Locale)

  /** 服务端是否已按当前语言本地化（命中 ?lang 且等于当前语言）· server already localized to current locale */
  const serverLocalized = computed<boolean>(() => data.value?.data.locale === lang.value)

  /**
   * 当前用户点赞本地覆盖（仅存「本会话内该用户是否点赞」）· per-user like override (boolean only)
   * @description `useAsyncData` 的 data 不保证深层响应式，直接改 `concerts[].likes` 不触发视图更新；
   *              故用 `useState` 记录「本用户是否已点赞」（布尔），展示时叠加到服务端返回的 `likes` 上。
   *              只存 `liked`（不存 `likes`）：服务端 `likes` 会因其他用户点赞而变化，本覆盖仅反映「当前用户这一票」，
   *              从而他人点赞能在会话内即时反映；展示计数 = 服务端 likes + (展示 liked?1:0) − (服务端 liked?1:0)。
   *              用 useState（按请求隔离 + 各 useData 调用共享）而非普通 ref，保证 index.vue / useTimeline 等同源。
   */
  const likeOverrides = useState<Record<number, boolean>>('app:like-overrides', () => ({}))

  /** 按当前语言本地化，并叠加本用户点赞覆盖 · localized by current locale + per-user like override */
  const localizedConcerts = computed<Concert[]>(() => {
    if (serverLocalized.value) {
      // 服务端已按当前语言本地化：直接采用，避免对单语言对象二次 localize（会丢失文案）· server-localized: pass through
      return (concerts.value as unknown as Concert[]).map((c) => {
        const liked = (likeOverrides.value[c.id] ?? c.liked) as boolean
        const likes = c.likes + (liked ? 1 : 0) - (c.liked ? 1 : 0)
        return { ...c, likes, liked }
      })
    }
    return concerts.value.map((c) => {
      const base = localizeConcert(c, lang.value)
      const liked = (likeOverrides.value[c.id] ?? c.liked) as boolean
      const likes = c.likes + (liked ? 1 : 0) - (c.liked ? 1 : 0)
      return { ...base, likes, liked }
    })
  })
  const localizedCities = computed<City[]>(() =>
    serverLocalized.value
      ? (cities.value as unknown as City[]).map((city) => ({ ...city }))
      : cities.value.map((city) => localizeCity(city, lang.value))
  )
  const localizedWishes = computed<Wish[]>(() =>
    serverLocalized.value
      ? (wishes.value as unknown as Wish[]).map((w) => ({ ...w }))
      : wishes.value.map((wish) => localizeWish(wish, lang.value))
  )

  /** 各城市演唱会数（多语言匹配）· concert count per city */
  const counts = computed<Record<number, number>>(() => {
    if (serverLocalized.value) {
      // 服务端已本地化：直接读预置的 concertCount（对单语言 city 重算会命中为 0）· use server precomputed count
      const out: Record<number, number> = {}
      for (const city of cities.value) out[city.id] = (city as unknown as City).concertCount ?? 0
      return out
    }
    return computeCityConcertCounts(concerts.value, cities.value)
  })

  /**
   * 点赞切换（乐观更新 + 失败回滚）· Toggle like (optimistic + rollback)
   * @description 必须定义在 useData 内部：`useAsyncData` / `useAppI18n` 依赖 setup 上下文，
   *              若抽成独立导出函数、在事件回调里再调用 useData() 会抛
   *              「Must be called at the top of a setup function」。
   *              先就地切换原始数据的 `liked` / `likes`（localizedConcerts 派生自它，会即时反映），
   *              再调用 `POST /api/like { id }`；成功用服务端返回值校准，失败整体回滚后抛出。
   * @param id 演唱会编号 · concert id
   */
  async function toggleLike(id: number): Promise<void> {
    // 防抖：同一演唱会请求在途、或刚完成尚在冷却期，直接忽略本次点击，避免连点打满服务端限流（429）。
    // Debounce: ignore clicks while a request is in-flight or within the cooldown window.
    if (likeInFlight.has(id)) return
    const last = likeCooldown.get(id) ?? 0
    if (Date.now() - last < LIKE_COOLDOWN_MS) return

    const c = concerts.value.find((x) => x.id === id)
    if (!c) return

    const serverLiked = c.liked
    const nextLiked = !(likeOverrides.value[id] ?? serverLiked)

    // 乐观更新：翻转本用户的覆盖（整体替换以保证响应式）· optimistic flip of the per-user override
    likeOverrides.value = { ...likeOverrides.value, [id]: nextLiked }

    likeInFlight.add(id)
    try {
      const res = await $fetch<{ id: number; likes: number; liked: boolean }>('/api/like', {
        method: 'POST',
        body: { id }
      })
      // 以服务端状态为准校准（只覆盖 liked；likes 始终取服务端实时值）
      likeOverrides.value = { ...likeOverrides.value, [id]: res.liked }
    } catch (e: any) {
      // 失败回滚：恢复为服务端原始状态（删除该键，交回服务端值）· rollback to server state
      const rest = { ...likeOverrides.value }
      delete rest[id]
      likeOverrides.value = rest
      // 标注限流，供调用处展示「操作太频繁」而非通用错误 · mark rate-limit for the caller
      if (e?.status === 429) e.code = 'rate_limited'
      throw e
    } finally {
      likeInFlight.delete(id)
      likeCooldown.set(id, Date.now())
    }
  }

  return {
    loading,
    dataReady,
    dataError,
    error,
    concerts,
    cities,
    wishes,
    localizedConcerts,
    localizedCities,
    localizedWishes,
    counts,
    stats,
    seo,
    friendLinks,
    generatedAt,
    refresh,
    toggleLike
  }
}

