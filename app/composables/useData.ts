/**
 * 数据获取与本地化 · Data fetching + localization
 *
 * @module useData
 * @description 在客户端组合式函数中获取聚合数据（/api/data），并按当前 locale 本地化为单语言。
 *              多语言文案与数据均经 @nuxtjs/i18n 的 locale（URL 前缀驱动）确定，SSR 安全。
 */
import { computed, watch } from 'vue'
import { useAsyncData, useState } from '#app'
import { useAppI18n } from './useI18n'
import type { Concert, City, Wish, LocalizedConcert, LocalizedCity, LocalizedWish, LocalizedFriendLink, Locale, ApiResponse, SiteSeoSettings } from '../types'
import { localizeConcert, localizeCity, localizeWish, computeCityConcertCounts } from '../utils'

/** 本地化派生快照 · Localized derived snapshot shared across useData instances */
interface LocalizedSnapshot {
  concerts: Concert[]
  cities: City[]
  wishes: Wish[]
  counts: Record<number, number>
}

/** 点赞在途标记（按演唱会 id）：防止连点并发重复请求 · in-flight guard per concert id */
const likeInFlight = new Set<number>()
/** 点赞冷却（按演唱会 id，记录上次完成时间戳）：连点过快时忽略，避免打满服务端限流（429）· per-id cooldown */
const likeCooldown = new Map<number, number>()
/** 同一演唱会两次点赞的最小间隔（毫秒）· minimum gap between toggles for the same concert */
const LIKE_COOLDOWN_MS = 700

interface UseDataReturn {
  /** 数据是否已就绪（!pending && !error）· data ready flag */
  dataReady: globalThis.Ref<boolean>
  /** 数据是否出错 · data error flag */
  dataError: globalThis.Ref<boolean>
  error: globalThis.Ref<unknown>
  localizedConcerts: globalThis.Ref<Concert[]>
  localizedCities: globalThis.Ref<City[]>
  localizedWishes: globalThis.Ref<Wish[]>
  counts: globalThis.Ref<Record<number, number>>
  stats: globalThis.Ref<{ totalConcerts: number; totalArtists: number; totalCities: number; totalWishes: number }>
  /** 站点级 SEO 设置（来自 /api/data 的 seo 字段；数据未就绪时为 null）· site SEO from `/api/data` */
  seo: globalThis.Ref<SiteSeoSettings | null>
  /** 页脚友情链接（DB 优先；为空时由前端回退代码列表）· footer friend links */
  friendLinks: globalThis.Ref<LocalizedFriendLink[]>
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
  const { data, pending, error } = useAsyncData<ApiResponse>(
    `app-data-${currentLanguage.value}`,
    () => $fetch(`/api/data?lang=${encodeURIComponent(currentLanguage.value)}`, { headers: ipHeaders })
  )

  const dataReady = computed(() => !pending.value && !error.value)
  const dataError = computed(() => !!error.value)
  // 原始多语言数据仅内部消费（toggleLike / computeLocalizedSnapshot），不再对外导出
  const concerts = computed<LocalizedConcert[]>(() => data.value?.data.concerts ?? [])
  const cities = computed<LocalizedCity[]>(() => data.value?.data.cities ?? [])
  const wishes = computed<LocalizedWish[]>(() => data.value?.data.wishes ?? [])
  const stats = computed(() => data.value?.data.stats ?? { totalConcerts: 0, totalArtists: 0, totalCities: 0, totalWishes: 0 })
  /** 站点级 SEO 设置（DB 优先；缺失回退由页面级负责）· site-level SEO settings */
  const seo = computed<SiteSeoSettings | null>(() => data.value?.data.seo ?? null)
  /** 页脚友情链接（DB 优先；为空时由展示层回退内置列表）· footer friend links */
  const friendLinks = computed<LocalizedFriendLink[]>(() => data.value?.data.friendLinks ?? [])

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

  /**
   * 本地化派生共享（请求级）· Shared localized snapshot (request-scoped)
   * @description 原实现把 localizedConcerts/Cities/Wishes/counts 作为每个 useData 实例独立 computed，
   *              语言切换会触发「实例数 × N」次重复本地化。改为写入请求级共享态（useState），
   *              仅由第一个进入 useData 的实例注册一次同步器（watch）重算并写入，
   *              其余实例只读共享态，使本地化计算只执行一次。useState 天然按请求隔离，SSR 无跨用户泄漏。
   */
  const localizedSnapshot = useState<LocalizedSnapshot>('app:localized', () => ({
    concerts: [],
    cities: [],
    wishes: [],
    counts: {}
  }))
  /**
   * 注册一次共享同步器（watch）：本地化只计算一次、结果写入共享快照，下游多实例只读。
   * 去重标记挂在 ref 对象上（而非 `.value`）· dedup flag on the ref object (not `.value`)
   *  - 不会被 SSR 水合序列化，避免「客户端水合后误判已注册」导致本地化快照永不填充（回归点）。
   *    Not serialized by SSR hydration — otherwise the client would think it is already registered
   *    and skip, leaving the localized snapshot empty after hydration.
   *  - useState 在每次请求 / 每次测试重置时换新 ref，标记自然失效、可重新注册，无跨请求 / 跨用例泄漏。
   *    useState swaps in a fresh ref on every request / test reset, so the flag resets and no leak occurs.
   */
  const snapshotRef = localizedSnapshot as globalThis.Ref<LocalizedSnapshot> & { __syncStarted?: boolean }
  if (!snapshotRef.__syncStarted) {
    snapshotRef.__syncStarted = true
    watch(
      [data, likeOverrides, currentLanguage, serverLocalized],
      () => {
        snapshotRef.value = computeLocalizedSnapshot(
          serverLocalized.value,
          concerts.value,
          cities.value,
          wishes.value,
          lang.value,
          likeOverrides.value
        )
      },
      { immediate: true }
    )
  }

  const localizedConcerts = computed<Concert[]>(() => localizedSnapshot.value.concerts)
  const localizedCities = computed<City[]>(() => localizedSnapshot.value.cities)
  const localizedWishes = computed<Wish[]>(() => localizedSnapshot.value.wishes)
  const counts = computed<Record<number, number>>(() => localizedSnapshot.value.counts)

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
    dataReady,
    dataError,
    error,
    localizedConcerts,
    localizedCities,
    localizedWishes,
    counts,
    stats,
    seo,
    friendLinks,
    toggleLike
  }
}

// ==================== 本地化快照（模块级纯函数）· Localized snapshot (module-level pure fn) ====================
/**
 * 计算本地化派生快照（纯函数）· Compute the localized derived snapshot (pure)
 * @description 抽出自原 localizedConcerts/Cities/Wishes/counts 的映射逻辑，
 *              供共享同步器（首个 useData 实例的 watch）调用，使本地化只计算一次。
 *              函数声明提升（hoisted），可在 useData 内被调用；导出以便单测。
 */
export function computeLocalizedSnapshot(
  serverLocalized: boolean,
  concerts: LocalizedConcert[],
  cities: LocalizedCity[],
  wishes: LocalizedWish[],
  lang: Locale,
  likeOverrides: Record<number, boolean>
): LocalizedSnapshot {
  const localizedConcerts = serverLocalized
    ? (concerts as unknown as Concert[]).map((c) => {
        const liked = (likeOverrides[c.id] ?? c.liked) as boolean
        const likes = c.likes + (liked ? 1 : 0) - (c.liked ? 1 : 0)
        return { ...c, likes, liked }
      })
    : concerts.map((c) => {
        const base = localizeConcert(c, lang)
        const liked = (likeOverrides[c.id] ?? c.liked) as boolean
        const likes = c.likes + (liked ? 1 : 0) - (c.liked ? 1 : 0)
        return { ...base, likes, liked }
      })
  const localizedCities = serverLocalized
    ? (cities as unknown as City[]).map((city) => ({ ...city }))
    : cities.map((city) => localizeCity(city, lang))
  const localizedWishes = serverLocalized
    ? (wishes as unknown as Wish[]).map((w) => ({ ...w }))
    : wishes.map((wish) => localizeWish(wish, lang))
  const counts = serverLocalized
    ? (() => {
        const out: Record<number, number> = {}
        for (const city of cities) out[city.id] = (city as unknown as City).concertCount ?? 0
        return out
      })()
    : computeCityConcertCounts(concerts, cities)
  return { concerts: localizedConcerts, cities: localizedCities, wishes: localizedWishes, counts }
}

