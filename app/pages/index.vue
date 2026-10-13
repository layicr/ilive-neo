<script setup lang="ts">
/**
 * 首页 · Home page
 * @description 迁移自原 index.html <body> 的完整 DOM 骨架，视觉与交互 100% 保持一致。
 *              已彻底 Vue 化：所有动态内容由模板声明式渲染（v-for/插值），
 *              交互逻辑由 composables 提供，数据一次拉取双语后按语言本地化显示。
 *
 *              Mirrored from the original index.html <body> to keep visuals identical.
 */
import { toRaw } from 'vue'
import { useAppI18n } from '~/composables/useI18n'
import { useData } from '~/composables/useData'
import { useMusic } from '~/composables/useMusic'
import { useGallery } from '~/composables/useGallery'
import { useSonglist } from '~/composables/useSonglist'
import { useNavigation } from '~/composables/useNavigation'
import { useTimeline } from '~/composables/useTimeline'
import { useAlbumShowcase } from '~/composables/useAlbumShowcase'
import { useTicketModal } from '~/composables/useTicketModal'
import { useAppError } from '~/composables/useAppError'
import { pickLocale } from '~/utils'
import { ARTIST_DELIMITER, buildSiteDescription, resolveSiteUrl, toAbsoluteImageUrl } from '~/utils/seo'

const { currentLanguage, currentData } = useAppI18n()

// ==================== 数据与就绪态 · Data & readiness ====================
// 仅保留协调层所需字段（SEO / JSON-LD / 编排 / body 滚动锁）；各区块在其子组件内按需调用 composable。
const { dataReady, dataError, error: dataFetchError, localizedConcerts, seo } = useData()
const { initBgMusic } = useMusic()
const { galleryOpen } = useGallery()
const { songlistOpen } = useSonglist()
const { cityModalOpen, videoModalOpen } = useNavigation()
const { sortedConcerts, initTimelineReveal } = useTimeline()
const { selectedAlbumIndex, applyCarouselLayout } = useAlbumShowcase()
const { ticketModalOpen } = useTicketModal()
const { handleError } = useAppError()

// ==================== SEO 元信息（动态，随语言切换）· Dynamic SEO meta ====================

// ==================== SEO 元信息（动态，随语言切换）· Dynamic SEO meta ====================
// 说明：站点地址 siteUrl、hreflang 与描述构造逻辑统一收敛在 ~/utils/seo（纯函数，可单测）。
// siteUrl / hreflang / description builders all live in ~/utils/seo (pure functions, unit-testable).
/**
 * 去重艺人列表（来自数据库已预取的演唱会数据）· Unique artists from DB concerts
 * @description 从 localizedConcerts 提取 `artist` 并去重；随语言切换自动取当前语言艺人名。
 *              Array of unique artist names in the current language.
 */
const artistNames = computed(() =>
  [...new Set(localizedConcerts.value.map(c => c.artist).filter(Boolean))]
)
/** 当前语言下的艺人串（分隔符来自 ~/utils/seo）· artist list joined by locale-specific delimiter */
const artistListText = computed(() =>
  artistNames.value.join(ARTIST_DELIMITER[currentLanguage.value] ?? ', ')
)
// ==================== 站点 SEO（DB 优先，文案/代码回退）· Site SEO (DB-first, fallback) ====================
// 说明：运营维度的 SEO 参数来自数据库（/api/data 的 seo 字段，见 server/lib/mappers.ts 的 fetchSiteSeo）。
//      DB 为空 / 缺字段 / 请求失败时逐项回退到代码默认值（~/utils/seo 与 i18n message），
//      任何情况下都不输出空 title / description（SEO_DB_MIGRATION.md「坑 1」）。
// Operational SEO params come from the DB (/api/data `seo`, built by fetchSiteSeo); when the DB is empty,
// a field is missing, or the query fails, each field falls back to code defaults (~/utils/seo + i18n messages);
// title / description are never empty (see SEO_DB_MIGRATION.md "pitfall 1").

/** DB 中的站点 SEO 设置（数据未就绪时为 null）· site SEO settings from DB */
const seoSettings = computed(() => seo.value)
/** 生效的站点地址（DB site_settings.site_url 优先 → runtimeConfig.public.siteUrl/env → 代码兜底）· effective site URL */
const siteUrl = computed(() =>
  seoSettings.value?.siteUrl || resolveSiteUrl(useRuntimeConfig().public.siteUrl as string | undefined)
)

/**
 * 取 DB 中某条 SEO 多语言文案（当前语言 → 回退链）· DB copy for a key
 * @returns 取不到时返回空串，由调用方决定回退值 · returns '' when missing; the caller decides the fallback
 */
function seoCopy(key: 'site_title' | 'site_description' | 'keywords'): string {
  const dict = seoSettings.value?.i18n?.[key]
  if (!dict) return ''
  return pickLocale(dict, currentLanguage.value) ?? ''
}

/** 站点名（显式字符串化，避免把 i18n 代理对象直接交给 unhead）· site name as plain string */
const currentSiteName = computed(() => String(currentData.value.siteName))

/** 当前语言的站点标题（DB 的 site_title 优先，回退 message 组合）· Current page title */
const currentPageTitle = computed(() =>
  seoCopy('site_title') || `${currentData.value.pageTitle} - ${currentData.value.siteName}`
)

/**
 * 动态站点描述（DB 文案优先）· Dynamic site description
 * @description 回退链：DB site_description → 按语言 + 当前艺人串生成的模板（~/utils/seo）。
 */
const currentDescription = computed(() =>
  seoCopy('site_description') || buildSiteDescription(currentLanguage.value, artistListText.value)
)

/** 动态关键词（DB 文案优先，回退到站点名 + 艺人 + 默认词）· Dynamic keywords */
const currentKeywords = computed(() =>
  seoCopy('keywords') ||
  [currentData.value.siteName, ...artistNames.value, '演唱会足迹', '演唱会记录'].join(',')
)

/** OG / Twitter 兜底图（与 server/lib/mappers.ts 的 SEO_FALLBACK.ogImage 同值）· fallback OG image */
const FALLBACK_OG_IMAGE = '/img/og-image.svg'
/** OG / Twitter 图（DB 值 → 代码兜底；相对路径统一转绝对 URL）· absolute OG image */
const currentOgImage = computed(() => toAbsoluteImageUrl(seoSettings.value?.ogImage || FALLBACK_OG_IMAGE, siteUrl.value))
const currentTwitterSite = computed(() => seoSettings.value?.twitterSite || '@layicr')
const currentTwitterCreator = computed(() => seoSettings.value?.twitterCreator || '@layicr')
const currentRobots = computed(() => seoSettings.value?.robots || 'index, follow')
const currentAuthor = computed(() => seoSettings.value?.author || 'layicr')

useSeoMeta({
  title: currentPageTitle,
  ogTitle: currentPageTitle,
  description: currentDescription,
  keywords: currentKeywords,
  ogDescription: currentDescription,
  ogUrl: siteUrl,
  ogImage: currentOgImage,
  ogSiteName: currentSiteName,
  twitterCard: 'summary_large_image',
  twitterTitle: currentPageTitle,
  twitterDescription: currentDescription,
  twitterImage: currentOgImage,
  twitterSite: currentTwitterSite,
  twitterCreator: currentTwitterCreator,
  robots: currentRobots,
  author: currentAuthor
})

// ==================== JSON-LD 结构化数据 + hreflang（仅 SSR 输出）· JSON-LD + hreflang (SSR only) ====================
// 说明：在 SSR 阶段构建纯 JSON 对象后一次性序列化，避免将 Vue 响应式 Proxy 对象
//      交给 JSON.stringify / unhead（会触发 Proxy 陷阱导致序列化异常）。
// Build a plain JSON object during SSR and serialize once, avoiding handing Vue reactive Proxies to
// JSON.stringify / unhead (whose Proxy traps break serialization).

/** 演唱会纯数据（剥离响应式 Proxy 后用于序列化）· plain concert shape for serialization */
type PlainConcert = {
  id: number; concertName: string; artist: string; date: string; time?: string;
  location?: string; poster?: string; price?: string
}

/**
 * 用 JSON.parse(JSON.stringify(toRaw(...))) 一次性剥离 localizedConcerts 的响应式 Proxy。
 * buildMusicEvents 与 buildJsonLd 复用同一份纯数据，避免重复深拷贝（原实现拷贝了两次）。
 */
function getPlainConcerts(): PlainConcert[] {
  return JSON.parse(JSON.stringify(toRaw(localizedConcerts.value))) as PlainConcert[]
}

/** 构建每场演唱会的 MusicEvent 纯对象 · Build plain MusicEvent objects */
function buildMusicEvents(plain: PlainConcert[]): Record<string, unknown>[] {
  return plain
    .map(c => {
      const ev: Record<string, unknown> = {
        '@type': 'MusicEvent',
        '@id': `${siteUrl.value}/#concert-${c.id}`,
        name: c.concertName || c.artist,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode'
      }
      if (c.date) {
        ev.startDate = c.date.replace(/\./g, '-') + (c.time ? `T${c.time}` : '')
      }
      if (c.location) ev.location = { '@type': 'Place', name: c.location }
      if (c.poster) ev.image = siteUrl.value + '/' + c.poster
      if (c.artist) ev.performer = { '@type': 'Person', name: c.artist }
      if (c.price) {
        const numeric = c.price.replace(/[^\d.]/g, '')
        if (numeric) ev.offers = { '@type': 'Offer', price: numeric, priceCurrency: 'CNY' }
      }
      return ev
    })
    .filter(ev => ev.name)
}

/** 构建完整 JSON-LD 纯对象 · Build the full JSON-LD plain object */
function buildJsonLd(): Record<string, unknown> {
  const plain = getPlainConcerts()
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebSite',
      '@id': siteUrl.value + '/#website',
      name: String(currentData.value.siteName),
      url: siteUrl.value,
      inLanguage: currentLanguage.value === 'zh-CN' ? 'zh-CN' : currentLanguage.value as string
    },
    {
      '@type': 'Person',
      '@id': siteUrl.value + '/#person',
      name: 'layicr',
      url: siteUrl.value
    },
    {
      '@type': 'ItemList',
      name: String(currentData.value.pageTitle),
      numberOfItems: plain.length,
      itemListElement: plain.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: { '@type': 'MusicEvent', name: c.concertName || c.artist, url: `${siteUrl.value}/#concert-${c.id}` }
      }))
    },
    ...buildMusicEvents(plain)
  ]
  return { '@context': 'https://schema.org', '@graph': graph }
}

// 说明：innerHTML 用 computed 让 unhead 在 useAsyncData 数据就绪后自动重新求值，
//      从而确保 JSON-LD 包含已加载的演唱会列表（而非 setup 阶段的空数组）。
// innerHTML is a computed so unhead re-evaluates once useAsyncData resolves, ensuring JSON-LD carries
// the loaded concerts (not the empty array from the setup phase).
/** JSON-LD 纯 JSON 字符串（响应式，数据就绪后更新）· serialized JSON-LD string */
const jsonLdHTML = computed(() => JSON.stringify(buildJsonLd()))

// 仅 SSR 输出 JSON-LD；客户端元信息交给 app.vue 与 useSeoMeta。
// 注意：hreflang / canonical / og:locale 已由根组件 app.vue 统一发射（覆盖所有页面），此处不再重复。
// Emit JSON-LD on SSR only; hreflang/canonical/og:locale are emitted once by app.vue for every page.
if (import.meta.server) {
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: jsonLdHTML
      }
    ]
  })
}

// 语言切换：更新 document.title + 重新应用专辑布局（模板自动更新文案，零请求）。
// 故事文案的重置与高亮重播已随 StoriesSection 组件内的 watch(currentLanguage) 自管。
// Locale switch: update document.title + re-apply album layout (story reset lives in StoriesSection).
watch(currentLanguage, () => {
  if (typeof document === 'undefined') return
  // 标题来源与 useHead 保持一致：DB 的 site_title 优先，回退 `pageTitle - siteName`
  // （修复：此前直接写入 pageTitle，导致客户端切换语言后 <title> 与 SSR 直出的标题不一致）
  document.title = currentPageTitle.value
  nextTick(() => {
    applyCarouselLayout(selectedAlbumIndex.value)
  })
})

// 一次性客户端初始化（语言/音乐/动态文本）· one-time client init
let clientInited = false
// 数据依赖布局（时间轴渐显 + 3D 专辑）仅初始化一次 · data-dependent layout, init once
let dataInited = false

function initDataLayout(): void {
  if (dataInited) return
  dataInited = true
  nextTick(() => {
    initTimelineReveal()
  })
}

// 客户端挂载后初始化；若数据已就绪（SSR 水合）则同步初始化数据布局
// Init after client mount; if data is already ready (SSR hydration), init the data layout synchronously.
onMounted(() => {
  if (clientInited) return
  clientInited = true
  initBgMusic()
  // 故事动态文本的首播与高亮已随 StoriesSection 组件 onMounted 自管
  // Story first-play + highlight now live in StoriesSection's onMounted.
  if (dataReady.value) initDataLayout()
})

// 数据就绪后：若尚未初始化（异步加载场景）则补齐时间轴渐显与专辑布局
// When data becomes ready: if not yet initialized (async load), set up timeline reveal and album layout.
watch(dataReady, (ready) => {
  if (ready) initDataLayout()
})

// 数据拉取失败时给出用户可见提示（loader 已隐藏，避免页面静默空白）
// On fetch failure show a user-visible message (loader is hidden, so avoid a silent blank page).
watch(dataError, (failed) => {
  if (!failed) return
  // 说明：watch 回调没有组件实例，但 handleError 的错误文案已由 useAppError 在 setup 阶段
  // 注册好解析器（见 app/composables/useAppError.ts），故此处可以安全地传 messageKey。
  // Note: watch callbacks have no component instance, but the copy resolver is registered during
  // setup inside useAppError, so passing a messageKey here is safe.
  const failure = dataFetchError.value
  handleError(
    failure instanceof Error || typeof failure === 'string' ? failure : new Error('data fetch failed'),
    'DataFetch',
    true,
    'loadFailed'
  )
})

// 数据真正变化时（SSR 水合、语言切换、异步数据就绪）重新观察时间轴条目，
// 确保新渲染节点被 IntersectionObserver 捕获并按滚动渐显。
// 注意：不能用 onUpdated —— 否则故事文案每 4 秒轮换都会触发全量 getBoundingClientRect 强制重排。
// When data actually changes (SSR hydration, locale switch, async ready) re-observe timeline items so
// newly rendered nodes are caught by the IntersectionObserver and revealed on scroll.
// Note: do NOT use onUpdated — the 4s story rotation would trigger a full getBoundingClientRect reflow.
watch(sortedConcerts, () => {
  if (typeof document === 'undefined') return
  nextTick(() => initTimelineReveal())
})

// 模态框打开时锁定 body 滚动 · lock body scroll when any modal open
watch([cityModalOpen, videoModalOpen, galleryOpen, songlistOpen, ticketModalOpen], (vals) => {
  const anyOpen = vals.some(v => v)
  if (typeof document !== 'undefined') {
    document.body.style.overflow = anyOpen ? 'hidden' : ''
  }
})

</script>

<template>
  <div>
    <LanguageSwitcher />
    <MusicPlayer />

    <div class="background-circles">
      <div class="logo-letter">L</div>
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
      <div class="circle circle-3"></div>
    </div>

    <HeroSection />

    <StoriesSection />

    <StatsCards />

    <!-- 3D 专辑展示 · 3D Album showcase（已拆分为 AlbumShowcase 组件） -->
    <AlbumShowcase />

    <!-- 时间轴（已拆分为 TimelineSection） · Timeline -->
    <TimelineSection />

    <!-- 加载动画（已拆分为 SiteLoader） · Loader -->
    <SiteLoader />

    <!-- 城市列表模态（已拆分为 CityModal） · City modal -->
    <CityModal />

    <!-- 图片查看器模态（已拆分为 GalleryModal） · Image viewer modal -->
    <GalleryModal />

    <!-- 视频查看器模态（已拆分为 VideoModal） · Video modal -->
    <VideoModal />

    <!-- 歌单查看器模态（已拆分为 SonglistModal） · Songlist modal -->
    <SonglistModal />

    <!-- 票根模态（已拆分为 TicketModal 组件，含虚拟滚动） · Ticket modal -->
    <TicketModal />

    <!-- 许愿墙（已拆分为 WishWall） · Wish wall -->
    <WishWall />

    <!-- 留言板（已拆分为 GuestbookSection） · Guestbook -->
    <GuestbookSection />

    <!-- 页脚 / 反馈 / 返回顶部（已拆分为 SiteFooter / FeedbackButton / BackToTopButton） -->
    <SiteFooter />
    <FeedbackButton />
    <BackToTopButton />
  </div>
</template>
