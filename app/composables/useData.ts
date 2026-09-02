/**
 * 数据拉取 composable · Data fetching (SSR prefetch)
 *
 * @description 经 useAsyncData 在服务端预取 /api/data 并随 HTML 水合：
 *              - 首屏直接渲染内容，无 "Loading..." 闪屏，利于 SEO 与 LCP
 *              - 客户端水合时复用 Nuxt payload，不再重复请求
 *              - 语言切换仅切换 computed 文案（本地化），不重建 DOM、不重新请求
 */
import type {
  Concert, City, Wish, Stats, Lang,
  BilingualConcert, AppData
} from '~/types'
import { useI18n } from './useI18n'

/** 取双语文本 · pick bilingual text */
export function pickText(pair: { zh: string; en: string } | null | undefined, lang: Lang): string {
  if (!pair) return ''
  return lang === 'zh' ? (pair.zh ?? pair.en ?? '') : (pair.en ?? pair.zh ?? '')
}

/** 本地化单场演唱会 · Localize one concert */
export function localizeConcert(c: BilingualConcert, lang: Lang): Concert {
  return {
    id: c.id,
    artist: pickText(c.artist, lang),
    concertName: pickText(c.concertName, lang),
    theme: pickText(c.theme, lang),
    location: pickText(c.location, lang),
    seat: c.seat ? pickText(c.seat, lang) : null,
    price: c.price ? pickText(c.price, lang) : null,
    date: c.date,
    time: c.time,
    poster: c.poster,
    tags: lang === 'zh' ? (c.tags.zh || []) : (c.tags.en || []),
    description: pickText(c.description, lang),
    images: c.images.map(img => ({ src: img.src, alt: pickText(img.alt, lang) })),
    video: c.video ? pickText(c.video, lang) : null,
    videoUrl: c.videoUrl ? pickText(c.videoUrl, lang) : null,
    songlist: c.songlist.map(s => ({ name: lang === 'zh' ? s.zh : (s.en || s.zh), link: s.link ?? null }))
  }
}

const EMPTY_STATS: Stats = { totalConcerts: 0, totalArtists: 0, totalCities: 0 }

/**
 * useData 组合式入口 · Composable entry
 * @description 返回按当前语言本地化的 computed 视图；数据由 useAsyncData 服务端预取 + 水合。
 */
export function useData() {
  const { currentLanguage } = useI18n()

  // error 一并暴露：/api/data 失败时 pending 也会变 false，
  // 若不透出 error，页面会在「加载完成」的状态下显示空白，用户无从察觉。
  const { data, pending, error } = useAsyncData<AppData>('app-data', () =>
    $fetch<AppData>('/api/data')
  )

  const concerts = computed(() => data.value?.concerts ?? [])
  const cities = computed(() => data.value?.cities ?? [])
  const wishes = computed(() => data.value?.wishes ?? [])
  const stats = computed<Stats>(() => data.value?.stats ?? EMPTY_STATS)
  const dataReady = computed(() => !pending.value)

  // 按当前语言本地化的单语言视图 · localized single-language views
  const localizedConcerts = computed<Concert[]>(() =>
    concerts.value.map(c => localizeConcert(c, currentLanguage.value))
  )
  const localizedCities = computed<City[]>(() =>
    cities.value.map(c => ({
      id: c.id,
      name: pickText(c.name, currentLanguage.value),
      icon: c.icon,
      concerts: c.concerts
    }))
  )
  const localizedWishes = computed<Wish[]>(() =>
    wishes.value.map(w => ({
      id: w.id,
      content: pickText(w.content, currentLanguage.value),
      time: w.time,
      likes: w.likes,
      liked: w.liked
    }))
  )

  return {
    stats,
    dataReady,
    dataError: error,
    localizedConcerts,
    localizedCities,
    localizedWishes
  }
}
