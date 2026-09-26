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
import type { AppLocale } from '~/composables/useI18n'
import { useData } from '~/composables/useData'
import { useMusic } from '~/composables/useMusic'
import { useGallery } from '~/composables/useGallery'
import { useSonglist } from '~/composables/useSonglist'
import { useNavigation } from '~/composables/useNavigation'
import { useTimeline } from '~/composables/useTimeline'
import { useAlbumShowcase } from '~/composables/useAlbumShowcase'
import { useTicketModal } from '~/composables/useTicketModal'
import { useFriendLink } from '~/composables/useFriendLink'
import { useAppError } from '~/composables/useAppError'
import { useCountUp } from '~/composables/useCountUp'
import { useGuestbook } from '~/composables/useGuestbook'
import { safeHtml, formatWishDate, pickLocale, pickHotConcertIds } from '~/utils'
import { CONFIG } from '~/utils/config'
import { LOCALE_DEFINITIONS } from '~~/server/lib/locales'
import { ARTIST_DELIMITER, buildHreflangLinks, buildSiteDescription, resolveSiteUrl, toAbsoluteImageUrl } from '~/utils/seo'

const { currentLanguage, currentData, currentStoriesText, initLanguage, switchLanguage } = useAppI18n()
/** vue-i18n 原始 t：带参数插值（如 songlist.totalSongs 的 {count}）· raw t for parameterized messages */
const { t } = useI18n()

// 语言切换器列表 · language switcher list（源自 server/lib/locales 单一真源；中文为默认语言，无 URL 前缀）
const langs: { code: AppLocale; label: string; name: string }[] = LOCALE_DEFINITIONS.map((l) => ({
  code: l.code,
  label: l.short,
  name: l.name
}))

// ==================== 语言下拉框 · Language dropdown ====================
const langOpen = ref(false)
const langSwitcherRef = ref<HTMLElement | null>(null)
/** 当前语言项（下拉触发器展示母语全称）· current locale entry for the trigger */
const currentLang = computed(() => langs.find((l) => l.code === currentLanguage.value) ?? langs[0])
/** 选择语言：关闭下拉并切换（同语言不重复导航）· pick a locale */
function selectLang(code: AppLocale): void {
  langOpen.value = false
  if (code === currentLanguage.value) return
  onSwitchLang(code)
}
/** 点击外部关闭下拉 · close on outside click */
function onLangDocClick(e: MouseEvent): void {
  if (!langOpen.value) return
  if (langSwitcherRef.value && !langSwitcherRef.value.contains(e.target as Node)) {
    langOpen.value = false
  }
}
/** Esc 关闭下拉 · close on Escape */
function onLangKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') langOpen.value = false
}
onMounted(() => {
  document.addEventListener('click', onLangDocClick)
  document.addEventListener('keydown', onLangKeydown)
})
onUnmounted(() => {
  document.removeEventListener('click', onLangDocClick)
  document.removeEventListener('keydown', onLangKeydown)
})
const { stats, dataReady, dataError, error: dataFetchError, localizedConcerts, localizedCities, localizedWishes, counts, seo, toggleLike } = useData()

// ==================== 统计卡片数字滚动 · Stats count-up ====================
/**
 * 三张卡片（城市 / 艺人 / 场次）从 0 平滑计数到真实值。
 * 挂载后首播一次，之后每隔 STAT_COUNTUP_REPEAT 毫秒从 0 重播一次。
 * Stats count-up: first play on mount, then replay from 0 every STAT_COUNTUP_REPEAT ms.
 */
const STAT_COUNTUP_DURATION = 5000
const STAT_COUNTUP_REPEAT = 120_000
const citiesCount = useCountUp(() => stats.value.totalCities, STAT_COUNTUP_DURATION, STAT_COUNTUP_REPEAT)
const artistsCount = useCountUp(() => stats.value.totalArtists, STAT_COUNTUP_DURATION, STAT_COUNTUP_REPEAT)
const concertsCount = useCountUp(() => stats.value.totalConcerts, STAT_COUNTUP_DURATION, STAT_COUNTUP_REPEAT)
const { isPlaying, initBgMusic, toggleMusic } = useMusic()
const { galleryOpen, currentImage, openGallery, closeGallery, prevImage, nextImage } = useGallery()
const { songlistOpen, activeConcert, filteredSonglist, songlistSearch, openSonglistModal, closeSonglistModal } = useSonglist()
const { backToTopVisible, cityModalOpen, videoModalOpen, videoModalUrl, videoModalTitle, openCityModal, closeCityModal, openVideoModal, closeVideoModal, openFeedback, backToTop } = useNavigation()
const { sortedConcerts, visibleIds, initTimelineReveal } = useTimeline()
const { selectedAlbumIndex, albums, selectAlbum, applyCarouselLayout, init3DAlbumShowcase } = useAlbumShowcase()
const { ticketModalOpen, openTicketModal, closeTicketModal } = useTicketModal()
const { friendLinks } = useFriendLink()
const { handleError, showUserMessage } = useAppError()

// ==================== 留言板 · Guestbook ====================
const {
  messages: gbMessages,
  page: gbPage,
  totalPages: gbTotalPages,
  loading: gbLoading,
  error: gbError,
  view: gbView,
  fetchMessages,
  postMessage,
  postReply,
  setView,
  prevPage,
  nextPage
} = useGuestbook()

// 主留言表单 · message form
const gbForm = reactive({ nickname: '', email: '', content: '' })
const gbFormError = ref('')

// 邮箱格式：与服务端一致的基础校验（避免依赖浏览器原生校验气泡）· email format (mirrors server, avoids native bubble)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 回复表单（同一时刻仅一条打开）· reply form (one open at a time)
const replyOpenId = ref<number | null>(null)
const replyForm = reactive({ nickname: '', email: '', content: '' })
const replyError = ref('')

// 回复分页：默认显示 3 条，点「更多」每次再显示 10 条 · reply paging: 3 by default, +10 per "more"
const REPLY_INITIAL = 3
const REPLY_STEP = 10
const replyLimits = reactive<Record<number, number>>({})
function replyLimit(id: number): number {
  return replyLimits[id] ?? REPLY_INITIAL
}
function showMoreReplies(id: number): void {
  replyLimits[id] = replyLimit(id) + REPLY_STEP
}

// emoji 面板 · emoji panel（点击插入到当前聚焦的输入框）
const EMOJI_LIST = ['😀', '😁', '😂', '🤣', '😊', '😉', '😍', '🥰', '😎', '🤗', '😶', '🙃', '🤔', '👍', '👌', '🎉', '✨', '💯', '❤️', '🔥']
const emojiPanelOpen = ref(false)
const emojiTarget = ref<'content' | 'reply'>('content')
function toggleEmojiPanel(target: 'content' | 'reply'): void {
  // 同一目标再次点击则收起；切换到另一目标则直接打开 · toggle off if same target, else open for the new target
  if (emojiPanelOpen.value && emojiTarget.value === target) {
    emojiPanelOpen.value = false
    return
  }
  emojiTarget.value = target
  emojiPanelOpen.value = true
}
function insertEmoji(e: string): void {
  if (emojiTarget.value === 'content') gbForm.content += e
  else replyForm.content += e
  emojiPanelOpen.value = false
}

function toggleReply(id: number): void {
  emojiPanelOpen.value = false
  if (replyOpenId.value === id) {
    replyOpenId.value = null
    return
  }
  replyOpenId.value = id
  replyForm.nickname = ''
  replyForm.email = ''
  replyForm.content = ''
  replyError.value = ''
}

// 接口错误 → 友好文案 · map API error to a friendly message
function resolveGuestbookError(e: any): string {
  if (e?.status === 429) return t('errorMessages.rateLimited')
  if (e?.status === 400 && e?.data?.error) return String(e.data.error)
  return t('errorMessages.generic')
}

async function submitMessage(): Promise<void> {
  gbFormError.value = ''
  const nickname = gbForm.nickname.trim()
  const email = gbForm.email.trim()
  const content = gbForm.content.trim()
  if (!nickname || !email || !content) {
    gbFormError.value = t('guestbook.required')
    return
  }
  if (!EMAIL_RE.test(email)) {
    gbFormError.value = t('guestbook.invalidEmail')
    return
  }
  try {
    await postMessage({ nickname, email, content })
    gbForm.nickname = ''
    gbForm.email = ''
    gbForm.content = ''
    emojiPanelOpen.value = false
  } catch (e: any) {
    gbFormError.value = resolveGuestbookError(e)
  }
}

async function submitReply(id: number): Promise<void> {
  replyError.value = ''
  const nickname = replyForm.nickname.trim()
  const email = replyForm.email.trim()
  const content = replyForm.content.trim()
  if (!nickname || !email || !content) {
    replyError.value = t('guestbook.required')
    return
  }
  if (!EMAIL_RE.test(email)) {
    replyError.value = t('guestbook.invalidEmail')
    return
  }
  try {
    await postReply({ guestbookId: id, nickname, email, content })
    replyOpenId.value = null
  } catch (e: any) {
    replyError.value = resolveGuestbookError(e)
  }
}

// 日期格式化（复用 wish 的绝对日期格式化，SSR 稳定）· date formatting (SSR-stable)
function formatGuestbookDate(s: string): string {
  return formatWishDate(s)
}

onMounted(() => {
  void fetchMessages()
})

// ==================== 点赞与「热度」标记 · Likes & hot badge ====================
/**
 * 点赞数前三的演唱会 id 集合（仅统计 >0，并列同显）· Top-3 liked concert ids
 * @description 判定逻辑见 `pickHotConcertIds`（纯函数，可单测）：取点赞数最高的 3 个不同数值为阈值，
 *              凡点赞数 ≥ 阈值者均展示火图标；不足三档时有几档显示几档。
 *              Logic in `pickHotConcertIds`: the threshold is the top-3 distinct like levels; every concert
 *              at or above the threshold gets the badge (fewer levels → fewer badges).
 */
const hotConcertIds = computed<Set<number>>(() => pickHotConcertIds(localizedConcerts.value))

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

// 仅 SSR 输出 JSON-LD 与 hreflang；客户端元信息交给 app.vue 与 useSeoMeta
// 说明：hreflang 与 app/app.vue 使用同一组 key，由 unhead 合并去重，避免同一 hreflang 重复输出。
// Emit JSON-LD & hreflang on SSR only; client meta is handled by app.vue and useSeoMeta.
// hreflang links share the same keys as app/app.vue so unhead merges/dedupes them.
if (import.meta.server) {
  useHead({
    script: [
      {
        type: 'application/ld+json',
        innerHTML: jsonLdHTML
      }
    ],
    link: buildHreflangLinks(langs.map(({ code }) => code), siteUrl.value)
  })
}

// 语言切换：更新 document.title + 重置故事文案 + 重新应用专辑布局（模板自动更新文案，零请求）
// Locale switch: update document.title, reset story texts, re-apply album layout (templates update with zero extra requests).
watch(currentLanguage, () => {
  if (typeof document === 'undefined') return
  // 标题来源与 useHead 保持一致：DB 的 site_title 优先，回退 `pageTitle - siteName`
  // （修复：此前直接写入 pageTitle，导致客户端切换语言后 <title> 与 SSR 直出的标题不一致）
  document.title = currentPageTitle.value
  // 对齐原版 initStoriesText：切换语言后重置为第 0 组并重新播放高亮动画 · same as original initStoriesText: reset to group 0 and replay the highlight animation
  storyIndex.value = 0
  if (highlightTimer) clearTimeout(highlightTimer)
  highlightTimer = setTimeout(playHighlight, CONFIG.HIGHLIGHT_ANIMATION_DELAY)
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
    init3DAlbumShowcase()
  })
}

// 客户端挂载后初始化；若数据已就绪（SSR 水合）则同步初始化数据布局
// Init after client mount; if data is already ready (SSR hydration), init the data layout synchronously.
onMounted(() => {
  if (clientInited) return
  clientInited = true
  initLanguage()
  initBgMusic()
  startDynamicTextTimers()
  // 首屏：文字先显示，延迟再播放第二行高亮填充（对齐原版 initStoriesText）· first paint: show text first, then play the second-line highlight fill after a delay (same as original initStoriesText)
  if (highlightTimer) clearTimeout(highlightTimer)
  highlightTimer = setTimeout(playHighlight, CONFIG.HIGHLIGHT_ANIMATION_DELAY)
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

// ==================== 故事动态文本 · Stories text ====================
// 三组轮换：每组 = 第一行(text1[i]) + 第二行(text3[i]，高亮填充)。
// 节奏（对齐原版）：先显示第一行 → 再显示第二行 → 第二行慢慢变色 → 整组隐藏 → 下一组。
// text2 恒为空，不参与显示。
// Three rotating groups: each = line 1 (text1[i]) + line 2 (text3[i], highlighted fill).
// Rhythm (same as original): show line 1 → show line 2 → line 2 slowly changes color → hide group → next.
// text2 is always empty and never displayed.
/** 当前组索引（0/1/2）· current group index */
const storyIndex = ref(0)
/** 第三行是否播放填充动画（延迟激活，实现"先显示再变色"）· highlight playing flag */
const highlightActive = ref(false)
let dynamicTextTimers: ReturnType<typeof setInterval>[] = []
let highlightTimer: ReturnType<typeof setTimeout> | null = null

/** 第一段（第一行）文案 · first line text */
const storyText1 = computed(() => {
  const list = currentStoriesText.value.text1
  return list && list.length > 0 ? list[storyIndex.value % list.length] : ''
})
/** 第三段（第二行，高亮）文案 · second line (highlighted) text */
const storyText2 = computed(() => {
  const list = currentStoriesText.value.text3
  return list && list.length > 0 ? list[storyIndex.value % list.length] : ''
})

/** 播放第三行高亮填充（先清除旧动画再重播，对齐原版 playHighlightAnimation）· play the highlight fill (clear old animation then replay; same as original playHighlightAnimation) */
function playHighlight(): void {
  highlightActive.value = false
  // 下一帧再激活，确保浏览器重排后重新播放 fillBackground · re-activate on the next frame so fillBackground replays after the browser reflow
  requestAnimationFrame(() => { highlightActive.value = true })
}

/** 切换到下一组 · advance to next group */
function nextStoryGroup(): void {
  const len = currentStoriesText.value.text1?.length || 0
  if (len === 0) return
  storyIndex.value = (storyIndex.value + 1) % len
  // 整组切换后，延迟再播放第二行高亮（先显示文字，再慢慢变色）· after switching the whole group, replay the line-2 highlight with a delay (show text first, then fade in color)
  if (highlightTimer) clearTimeout(highlightTimer)
  highlightTimer = setTimeout(playHighlight, 600)
}

function startDynamicTextTimers(): void {
  if (typeof window === 'undefined' || dynamicTextTimers.length > 0) return
  dynamicTextTimers = [
    setInterval(nextStoryGroup, CONFIG.DYNAMIC_TEXT_INTERVAL)
  ]
}

// 卸载时清理定时器，避免泄漏 · clear timers on unmount
onUnmounted(() => {
  dynamicTextTimers.forEach(timer => clearInterval(timer))
  dynamicTextTimers = []
  if (highlightTimer) clearTimeout(highlightTimer)
})

// ==================== 个人资料角色 · Profile roles ====================
/**
 * 三项 role 的点击滚动目标（CSS 选择器）· Scroll targets for role clicks
 * @description 顺序与 roleItems 一致：宣言 → 故事区 / 演唱会 → 时间轴 / 城市 → 统计卡片。
 *              属 UI 结构配置（非文案），故不再放 i18n。
 *              This is UI-structure config (not copy), so it is intentionally kept out of i18n.
 */
const ROLE_TARGETS = ['.section-spacing', '#timeline', '.stats-grid'] as const

/** 三项 role 文本（与原版 applyComputedProperties 一致）· three role texts (same as original applyComputedProperties) */
const roleItems = computed(() => {
  const prefix = currentData.value.rolesPrefix || ''
  const rolesConf = currentData.value.roles
  return [
    `${prefix}${rolesConf.declaration}`,
    `${prefix}${stats.value.totalConcerts}   （${rolesConf.concertsLabel}）`,
    `${prefix}${stats.value.totalCities}   （${rolesConf.citiesLabel}）`
  ]
})

function handleRoleClick(index: number): void {
  const targetSelector = ROLE_TARGETS[index] ?? '#timeline'
  const target = document.querySelector(targetSelector) as HTMLElement | null
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ==================== 时间轴 helpers · Timeline helpers ====================
/** 缩略图地址 · thumbnail src */
function thumbSrc(src: string): string {
  return src.replace('.jpg', '_thumb.jpg')
}

/** 图片加载失败回退到原图 · fallback to full image */
function onThumbError(event: Event, src: string): void {
  const img = event.target as HTMLImageElement
  img.src = src
  img.onerror = null
}

// ==================== 事件处理 · Event handlers ====================
function onSwitchLang(lang: AppLocale): void {
  switchLanguage(lang)
}

function onToggleMusic(): void {
  toggleMusic()
}

function onShowCityModal(): void {
  openCityModal()
}

function onShowTicketModal(): void {
  openTicketModal()
}

function onBackToTop(): void {
  backToTop()
}

/** 打开图片画廊 · open gallery */
function onGalleryItemClick(concertId: number, index: number): void {
  openGallery(concertId, index)
}

/** 打开外链视频 · open external video link */
function openVideoLink(url: string): void {
  if (url) window.open(url, '_blank', 'noopener')
}

/** 点赞 / 取消点赞（乐观更新，失败回滚并提示）· toggle like with optimistic update */
async function onToggleLike(concert: { id: number }): Promise<void> {
  try {
    await toggleLike(concert.id)
  } catch (err: any) {
    // 注：useAppError 已在 setup 阶段注册文案解析器，事件回调里调用 handleError 是安全的；
    // 但此处需按错误类型分别提示，且限流不打 console.error（避免惊吓用户），故直接弹 Toast 而非走 handleError。
    // Note: useAppError registers its copy resolver during setup, so calling handleError in an event
    // callback is safe now; here we still branch on the error type (and avoid console.error on
    // rate-limit), hence the direct showUserMessage instead of handleError.
    // 限流：友好提示，不打 console.error（避免惊吓用户）· rate-limited: friendly toast, no scary log
    if (err?.code === 'rate_limited') {
      showUserMessage(String(currentData.value.errorMessages.rateLimited ?? ''))
      return
    }
    // 其他错误：仅开发环境记录，并弹通用提示 · other errors: log in dev, show generic toast
    if (import.meta.dev) console.error('[ToggleLike]', err)
    showUserMessage(String(currentData.value.errorMessages.generic ?? ''))
  }
}

</script>

<template>
  <div>
    <div ref="langSwitcherRef" class="language-switcher" :class="{ open: langOpen }">
      <button
        type="button"
        class="lang-trigger"
        aria-haspopup="listbox"
        :aria-expanded="langOpen"
        aria-label="语言选择"
        @click="langOpen = !langOpen"
      >
        <i class="fas fa-globe" aria-hidden="true"></i>
        <span class="lang-trigger-label">{{ currentLang.name }}</span>
        <i class="fas fa-chevron-down lang-trigger-arrow" aria-hidden="true"></i>
      </button>
      <transition name="lang-drop">
        <ul v-show="langOpen" class="lang-menu" role="listbox" aria-label="语言选择">
          <li
            v-for="l in langs"
            :key="l.code"
            class="lang-option"
            :class="{ active: currentLanguage === l.code }"
            role="option"
            :aria-selected="currentLanguage === l.code"
            :data-lang="l.code"
            :aria-label="`切换到${l.label}`"
            @click="selectLang(l.code)"
          >
            <span class="lang-option-name">{{ l.name }}</span>
            <i v-if="currentLanguage === l.code" class="fas fa-check lang-option-check" aria-hidden="true"></i>
          </li>
        </ul>
      </transition>
    </div>
    <div class="music-player">
      <div class="music-main">
        <button class="music-btn" id="musicToggle" :class="{ playing: isPlaying }" aria-label="播放/暂停背景音乐" @click="onToggleMusic">
          <i :class="isPlaying ? 'fas fa-pause' : 'fas fa-music'" id="musicIcon" aria-hidden="true"></i>
          <span class="tooltip-text">{{ currentData.tooltips.musicToggle }}</span>
        </button>
        <span class="music-wave" :class="{ active: isPlaying }" id="musicWave" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </span>
      </div>
      <a
        class="music-btn xy-btn"
        href="http://iliveworld.lyc.la"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="currentData.tooltips.universe"
      >
        <svg class="xy-icon" viewBox="0 0 24 24" role="img" aria-hidden="true">
          <defs>
            <!-- 背景渐变取自设计稿图片（横向 紫粉渐变） -->
            <linearGradient id="xyGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#C896B2" />
              <stop offset="1" stop-color="#D993A7" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#xyGrad)" />
          <!-- 星球 + 星环（宇宙主题）· planet with ring -->
          <ellipse cx="11" cy="12" rx="8.6" ry="3.2" fill="none" stroke="#fff" stroke-width="1.8" transform="rotate(-22 11 12)" />
          <circle cx="11" cy="12" r="4.4" fill="#fff" />
          <circle cx="18.6" cy="6.4" r="1" fill="#fff" />
          <circle cx="5.4" cy="6" r="0.8" fill="#fff" />
        </svg>
        <span class="tooltip-text">{{ currentData.tooltips.universe }}</span>
      </a>
    </div>
    <audio id="bgMusic" loop>
      <source id="bgMusicSource" :src="currentData.bgMusic" type="audio/mpeg">
    </audio>

    <div class="background-circles">
      <div class="logo-letter">L</div>
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
      <div class="circle circle-3"></div>
    </div>

    <section class="hero-section">
      <div class="profile-wrapper">
        <div class="orbit-container">
          <div class="avatar-section">
            <div class="avatar-container">
              <img src="/img/logo.jpg" alt="layicr" class="avatar-image" decoding="async" onerror="this.src='/img/logo.jpg'">
              <div class="status-dot"></div>
            </div>
            <div class="avatar-border"></div>
          </div>
        </div>

        <div class="profile-card">
          <div class="profile-label" id="profile-label">{{ currentData.profileLabel }}</div>
          <h1 class="profile-name">layicr</h1>

          <div class="profile-subtitle" id="profile-subtitle">{{ currentData.profileSubtitle }}</div>
          <ul class="roles-list" id="roles-list">
            <li
              v-for="(role, index) in roleItems"
              :key="index"
              class="role-item"
              :data-role-index="index"
              @click="handleRoleClick(index)"
            >{{ role }}</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Stories · 文字介绍区域 -->
    <section class="section-spacing">
      <div class="max-w-4xl mx-auto px-6 mb-16">
        <p class="text-2xl md:text-3xl text-gray-400 leading-relaxed max-w-3xl">
          <Transition name="story-fade" mode="out-in">
            <span :key="storyIndex" class="story-lines">
              <span class="story-line">{{ storyText1 }}</span>
              <span class="story-line highlight-fill" :class="{ animate: highlightActive }">{{ storyText2 }}</span>
            </span>
          </Transition>
        </p>
      </div>
    </section>

    <!-- Social Media Stats · 统计卡片 -->
    <section class="social-stats" id="influencer">
      <div class="stats-grid">
        <div class="stat-card cities" id="city-card" @click="onShowCityModal">
          <div class="stat-number" id="total-cities">{{ citiesCount }}</div>
          <div class="stat-label" id="cities-label">{{ currentData.citiesLabel }}</div>
        </div>
        <div class="stat-card artists">
          <div class="stat-number" id="total-artists">{{ artistsCount }}</div>
          <div class="stat-label" id="artists-label">{{ currentData.artistsLabel }}</div>
        </div>
        <div class="stat-card total" @click="onShowTicketModal">
          <div class="stat-number" id="total-concerts">{{ concertsCount }}</div>
          <div class="stat-label" id="total-label">{{ currentData.concertsLabel }}</div>
        </div>
      </div>
    </section>

    <!-- 3D 专辑展示 · 3D Album showcase -->
    <div class="album-showcase-container">
      <div class="album-stack-container">
        <div class="album-stack" id="albumStack">
          <div
            v-for="(album, index) in albums"
            :key="album.id"
            class="album-card"
            :id="'album-' + album.id"
            :data-index="index"
            @click="selectAlbum(index)"
          >
            <div class="album-cover">
              <img
                class="album-cover-img"
                :src="album.image"
                :alt="album.title"
                :loading="index === selectedAlbumIndex ? 'eager' : 'lazy'"
                :fetchpriority="index === selectedAlbumIndex ? 'high' : 'low'"
                decoding="async"
              >
            </div>
          </div>
        </div>
      </div>
      <div class="detail-panel">
        <button class="detail-nav detail-prev" id="prevConcert" aria-label="上一场演唱会" :disabled="selectedAlbumIndex === 0" :class="{ disabled: selectedAlbumIndex === 0 }" @click="selectAlbum(selectedAlbumIndex - 1)">
          <i class="fas fa-chevron-left" aria-hidden="true"></i>
        </button>
        <button class="detail-nav detail-next" id="nextConcert" aria-label="下一场演唱会" :disabled="selectedAlbumIndex >= albums.length - 1" :class="{ disabled: selectedAlbumIndex >= albums.length - 1 }" @click="selectAlbum(selectedAlbumIndex + 1)">
          <i class="fas fa-chevron-right" aria-hidden="true"></i>
        </button>
        <div class="detail-header">
          <h2 class="detail-title" id="detailTitle">{{ albums[selectedAlbumIndex]?.title || 'Loading...' }}</h2>
          <p class="detail-subtitle" id="detailSubtitle">{{ albums[selectedAlbumIndex]?.subtitle || '-' }}</p>
          <p class="detail-date" id="detailDate">{{ albums[selectedAlbumIndex] ? albums[selectedAlbumIndex].date + (albums[selectedAlbumIndex].time ? ' ' + albums[selectedAlbumIndex].time : '') + ' ' : '-' }}</p>
        </div>
        <div class="detail-content">
          <div class="album-intro" id="albumIntro">{{ albums[selectedAlbumIndex]?.intro || 'Loading...' }}</div>
        </div>
      </div>
    </div>

    <!-- 时间轴 · Timeline -->
    <div class="timeline" id="timeline">
      <div
        v-for="(concert, index) in sortedConcerts"
        :key="concert.id"
        class="timeline-item"
        :class="{ visible: visibleIds[concert.id] }"
        :data-concert-id="concert.id"
        :style="{ animationDelay: index * 0.1 + 's' }"
      >
        <div class="timeline-content">
          <div class="concert-date">{{ concert.date }}{{ concert.time ? ' ' + concert.time : '' }}</div>
          <h2 class="concert-artist">
            <span>{{ concert.artist }}</span>
            <!-- 热度标记：点赞数排前三（仅 >0，并列同显），跟在歌手名后 · hot badge after the artist -->
            <span
              v-if="hotConcertIds.has(concert.id)"
              class="concert-hot"
              :title="currentData.buttons.hot"
              :aria-label="currentData.buttons.hot"
              role="img"
            >
              <i class="fas fa-fire" aria-hidden="true"></i>
            </span>
          </h2>
          <div v-if="concert.concertName" class="concert-name">{{ concert.concertName }}</div>
          <div class="concert-location">
            <i class="fas fa-map-marker-alt" aria-hidden="true"></i> {{ concert.location }}
          </div>
          <div v-if="concert.seat || concert.price" class="concert-seat-price">
            <span v-if="concert.seat" class="seat-info">
              <i class="fas fa-chair" aria-hidden="true"></i> {{ concert.seat }}
            </span>
            <span v-if="concert.seat && concert.price" class="seat-price-separator"> | </span>
            <span v-if="concert.price" class="price-info">
              <i class="fas fa-ticket-alt" aria-hidden="true"></i> {{ concert.price }}
            </span>
          </div>
          <div v-if="concert.tags && concert.tags.length" class="concert-tags">
            <span v-for="tag in concert.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
          <div v-if="concert.description" class="concert-description" v-html="safeHtml(concert.description)"></div>
          <div v-if="concert.images && concert.images.length" class="gallery">
            <div
              v-for="(img, imgIndex) in concert.images"
              :key="img.src"
              class="gallery-item"
              :data-concert-id="concert.id"
              :data-index="imgIndex"
              @click="onGalleryItemClick(concert.id, imgIndex)"
            >
              <img
                :src="thumbSrc(img.src)"
                :alt="img.alt"
                loading="lazy"
                decoding="async"
                @error="onThumbError($event, img.src)"
              >
            </div>
          </div>
          <div class="timeline-buttons">
            <!-- 爱心点赞：图标在上、点赞数在下 · like button (heart above, count below) -->
            <button
              type="button"
              class="like-btn"
              :class="{ liked: concert.liked }"
              :data-concert-id="concert.id"
              :aria-pressed="concert.liked ? 'true' : 'false'"
              :aria-label="concert.liked ? currentData.buttons.unlike : currentData.buttons.like"
              :title="concert.liked ? currentData.buttons.unlike : currentData.buttons.like"
              @click="onToggleLike(concert)"
            >
              <i class="fas fa-heart" aria-hidden="true"></i>
              <span class="like-count">{{ concert.likes || 0 }}</span>
            </button>
            <button v-if="concert.songlist && concert.songlist.length" class="songlist-btn" :data-concert-id="concert.id" @click="openSonglistModal(concert)">
              <i class="fas fa-music" aria-hidden="true"></i> {{ currentData.buttons.songlist }}
            </button>
            <button v-if="concert.video" class="video-btn" :data-video-id="concert.video" :data-video-title="concert.artist + ' - ' + concert.concertName" @click="openVideoModal(concert.video, concert.artist + ' - ' + concert.concertName)">
              <i class="fas fa-video" aria-hidden="true"></i> {{ currentData.buttons.watchVideo }}
            </button>
            <button v-if="concert.videoUrl" class="video-link-btn" :data-video-url="concert.videoUrl" @click="openVideoLink(concert.videoUrl)">
              <i class="fas fa-external-link-alt" aria-hidden="true"></i> {{ currentData.buttons.openVideo }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 加载动画 · Loader -->
    <div class="loader" id="loader" v-show="!dataReady">
      <div class="spinner"></div>
      <p id="loading-text">{{ currentData.status.loading }}</p>
    </div>

    <!-- 城市列表模态框 · City modal -->
    <div class="city-modal" id="cityModal" :class="{ active: cityModalOpen }">
      <div class="city-modal-content">
        <div class="city-modal-header">
          <button class="city-modal-close" id="closeCityModal" @click="closeCityModal">&times;</button>
          <h2 class="city-modal-title" id="city-modal-title">{{ currentData.modalTitle }}</h2>
        </div>
        <div class="city-list" id="cityList">
          <div v-for="city in localizedCities" :key="city.id" class="city-item" :data-city-id="city.id">
            <span v-if="city.icon" class="city-icon">{{ city.icon }}</span>
            <span class="city-name">{{ city.name }}</span>
            <span class="city-concerts">{{ currentData.cityList.concertsPrefix }}{{ counts[city.id] ?? 0 }}{{ currentData.cityList.concertsSuffix }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 图片查看器模态框 · Image viewer modal -->
    <div class="modal" id="imageModal" role="dialog" aria-modal="true" aria-labelledby="modalCaption" aria-label="演唱会图片查看器" :class="{ show: galleryOpen }">
      <button class="close" id="closeModal" aria-label="关闭图片查看器" @click="closeGallery">&times;</button>
      <button class="modal-nav modal-prev" id="prevImage" aria-label="上一张图片" @click="prevImage">
        <i class="fas fa-chevron-left" aria-hidden="true"></i>
      </button>
      <button class="modal-nav modal-next" id="nextImage" aria-label="下一张图片" @click="nextImage">
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </button>
      <img v-if="currentImage" class="modal-content" id="modalImage" :src="currentImage.src" :alt="currentImage.alt" decoding="async">
      <div class="modal-caption" id="modalCaption" role="status" aria-live="polite">{{ currentImage ? currentImage.index + 1 + ' / ' + currentImage.total : '' }}</div>
    </div>

    <!-- 视频查看器模态框 · Video modal -->
    <div class="video-modal" id="videoModal" role="dialog" aria-modal="true" aria-labelledby="videoModalTitle" aria-label="演唱会视频查看器" :class="{ show: videoModalOpen }">
      <div class="video-modal-content">
        <button class="video-close" id="closeVideoModal" aria-label="关闭视频查看器" @click="closeVideoModal">&times;</button>
        <div class="video-modal-header">
          <h3 id="videoModalTitle">{{ videoModalTitle }}</h3>
        </div>
        <div class="video-container">
          <iframe v-if="videoModalOpen" id="videoPlayer" :src="videoModalUrl" frameborder="0" allowfullscreen allow="autoplay; encrypted-media" title="演唱会视频"></iframe>
        </div>
      </div>
    </div>

    <!-- 歌单查看器模态框 · Songlist modal -->
    <div class="songlist-modal" id="songlistModal" role="dialog" aria-modal="true" aria-labelledby="songlistModalTitle" aria-label="演唱会歌单查看器" :class="{ show: songlistOpen }">
      <div class="songlist-modal-content">
        <button class="songlist-close" id="closeSonglistModal" aria-label="关闭歌单查看器" @click="closeSonglistModal">&times;</button>
        <div class="songlist-modal-header">
          <h3 id="songlistModalTitle">{{ activeConcert ? activeConcert.artist + ' - ' + activeConcert.concertName : '' }}</h3>
          <p class="songlist-modal-subtitle" id="songlistModalSubtitle">{{ t('songlist.totalSongs', { count: filteredSonglist.length }) }}</p>
          <div class="songlist-search-container">
            <input type="text" id="songlistSearchInput" class="songlist-search-input" :placeholder="currentData.songlist.searchPlaceholder" :aria-label="currentData.songlist.searchPlaceholder" v-model="songlistSearch">
            <i class="fas fa-search songlist-search-icon"></i>
          </div>
        </div>
        <div class="songlist-container" id="songlistContainer">
          <ol class="songlist-list">
            <li v-for="song in filteredSonglist" :key="song.name" class="songlist-item" :class="{ 'has-link': !!song.link }">
              <span class="songlist-item-name">{{ song.name }}</span>
              <a v-if="song.link" class="songlist-play-btn" :href="song.link" target="_blank" rel="noopener noreferrer" :aria-label="'播放: ' + song.name">
                <i class="fas fa-play"></i>
              </a>
            </li>
          </ol>
        </div>
      </div>
    </div>

    <!-- 票根模态框 · Ticket modal -->
    <div class="ticket-modal" id="ticketModal" role="dialog" aria-modal="true" aria-label="演唱会票根展示" :class="{ active: ticketModalOpen }">
      <div class="ticket-modal-overlay" id="ticketModalOverlay" @click="closeTicketModal"></div>
      <div class="ticket-modal-content">
        <div class="ticket-modal-header">
          <h2 class="ticket-modal-title" id="ticketModalTitle">{{ currentData.ticketModalTitle }}</h2>
          <button class="ticket-close" id="closeTicketModal" aria-label="关闭票根展示" @click="closeTicketModal">&times;</button>
        </div>
        <div class="ticket-container" id="ticketContainer">
          <div v-for="(concert, index) in sortedConcerts" :key="concert.id" class="ticket-card" :style="{ transitionDelay: 50 * index + 'ms' }">
            <div class="ticket-poster" :style="{ backgroundImage: 'url(\'' + (concert.poster || 'img/logo.jpg') + '\')' }"></div>
            <div class="ticket-content">
              <div class="ticket-artist">{{ concert.artist }}</div>
              <div class="ticket-concert">{{ concert.concertName }}</div>
              <div class="ticket-divider"></div>
              <div class="ticket-info">
                <div class="ticket-info-item">
                  <i class="fas fa-calendar"></i>
                  <span>{{ concert.date }}{{ concert.time ? ' ' + concert.time : '' }}</span>
                </div>
                <div class="ticket-info-item">
                  <i class="fas fa-map-marker-alt"></i>
                  <span>{{ concert.location }}</span>
                </div>
                <div v-if="concert.seat || concert.price" class="ticket-info-item ticket-seat-price">
                  <span v-if="concert.seat" class="ticket-seat">
                    <i class="fas fa-chair"></i>
                    {{ concert.seat }}
                  </span>
                  <span v-if="concert.seat && concert.price" class="ticket-separator">|</span>
                  <span v-if="concert.price" class="ticket-price">
                    <i class="fas fa-ticket-alt"></i>
                    {{ concert.price }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Wish Wall · 许愿墙 -->
    <section class="wish-section" id="wishSection">
      <div class="wish-header">
        <h2 class="wish-title" id="wishTitle">{{ currentData.wishWall.title }}</h2>
        <div class="wish-count" id="wishCount">{{ currentData.wishWall.countPrefix }}<span>{{ localizedWishes.length }}</span>{{ currentData.wishWall.countSuffix }}</div>
      </div>
      <div v-if="localizedWishes.length === 0" class="wish-grid" id="wishGrid">
        <div class="wish-empty">{{ currentData.wishWall.emptyMessage }}</div>
      </div>
      <div v-else class="wish-grid" id="wishGrid">
        <div v-for="(wish, index) in localizedWishes" :key="wish.id" class="wish-card" :data-index="index" :data-wish-id="wish.id">
          <div class="wish-card-content">{{ wish.content }}</div>
          <div class="wish-card-footer">
            <div class="wish-card-likes" :class="{ liked: wish.liked }">
              <span>{{ wish.liked ? '❤️' : '🤍' }}</span>
              <span>{{ wish.likes || 0 }}</span>
            </div>
            <div class="wish-card-footer-spacer"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Guestbook · 留言板 -->
    <section class="guestbook-section" id="guestbookSection">
      <div class="gb-header">
        <h2 class="gb-title">{{ currentData.guestbook.title }}</h2>
      </div>

      <!-- 提交卡片 · submit card -->
      <form class="gb-submit-card" novalidate @submit.prevent="submitMessage">
        <div class="gb-form-row">
          <input class="gb-input" type="text" v-model="gbForm.nickname" :placeholder="currentData.guestbook.nicknamePlaceholder" maxlength="40" />
          <input class="gb-input" type="email" v-model="gbForm.email" :placeholder="currentData.guestbook.emailPlaceholder" maxlength="120" />
          <input class="gb-input gb-input-content" type="text" v-model="gbForm.content" :placeholder="currentData.guestbook.contentPlaceholder" maxlength="1000" />
          <button type="button" class="gb-emoji-btn" @click="toggleEmojiPanel('content')" aria-label="emoji">😊</button>
          <button type="submit" class="gb-btn">{{ currentData.guestbook.publish }}</button>
        </div>
        <div class="gb-emoji-panel" :class="{ show: emojiPanelOpen && emojiTarget === 'content' }">
          <span class="gb-emoji-item" v-for="e in EMOJI_LIST" :key="e" @click="insertEmoji(e)">{{ e }}</span>
        </div>
        <p v-if="gbFormError" class="gb-form-error">{{ gbFormError }}</p>
      </form>

      <!-- 工具栏：视图切换 · toolbar -->
      <div class="gb-toolbar">
        <div class="gb-view-switch">
          <button type="button" :class="{ active: gbView === 'card' }" @click="setView('card')">{{ currentData.guestbook.viewCard }}</button>
          <button type="button" :class="{ active: gbView === 'list' }" @click="setView('list')">{{ currentData.guestbook.viewList }}</button>
        </div>
      </div>

      <!-- 加载 / 错误 / 空态 · loading / error / empty -->
      <div v-if="gbLoading" class="gb-status">{{ currentData.status.loading }}</div>
      <div v-else-if="gbError" class="gb-status gb-status-error">{{ currentData.errorMessages.loadFailed }}</div>
      <div v-else-if="gbMessages.length === 0" class="gb-empty">{{ currentData.guestbook.empty }}</div>

      <template v-else>
        <div class="gb-wall" :class="gbView === 'card' ? 'gb-card-wall' : 'gb-list-view'">
          <article class="gb-message-card" v-for="m in gbMessages" :key="m.id" :data-gid="m.id">
            <p class="gb-message-text">{{ m.content }}</p>
            <div class="gb-message-meta">
              <div class="gb-meta-row">
                <span>{{ m.nickname }}</span>
                <span>{{ formatGuestbookDate(m.createdAt) }}</span>
              </div>
              <div class="gb-meta-row" v-if="m.browser || m.os">
                <span v-if="m.browser">🌐 {{ m.browser }}</span>
                <span v-if="m.os">💻 {{ m.os }}</span>
              </div>
            </div>
            <button type="button" class="gb-btn gb-btn-ghost gb-btn-sm gb-reply-toggle" @click="toggleReply(m.id)">{{ currentData.guestbook.reply }}</button>

            <div class="gb-reply-list" v-if="m.replies.length">
              <div class="gb-reply-item" v-for="r in m.replies.slice(0, replyLimit(m.id))" :key="r.id">
                <div class="gb-reply-content">{{ r.content }}</div>
                <div class="gb-reply-meta">
                  <span>{{ r.nickname }}</span>
                  <span>{{ formatGuestbookDate(r.createdAt) }}<template v-if="r.browser || r.os"> · 🌐{{ r.browser }} 💻{{ r.os }}</template></span>
                </div>
              </div>
              <button
                v-if="m.replies.length > replyLimit(m.id)"
                type="button"
                class="gb-btn gb-btn-ghost gb-btn-sm gb-reply-more"
                @click="showMoreReplies(m.id)"
              >{{ currentData.guestbook.more }}</button>
            </div>

            <div class="gb-reply-form" :class="{ show: replyOpenId === m.id }">
              <input class="gb-input-sm" type="text" v-model="replyForm.nickname" :placeholder="currentData.guestbook.replyNicknamePlaceholder" maxlength="40" />
              <input class="gb-input-sm" type="email" v-model="replyForm.email" :placeholder="currentData.guestbook.replyEmailPlaceholder" maxlength="120" />
              <input class="gb-input-sm" type="text" v-model="replyForm.content" :placeholder="currentData.guestbook.replyContentPlaceholder" maxlength="1000" />
              <button type="button" class="gb-emoji-btn" @click="toggleEmojiPanel('reply')" aria-label="emoji">😊</button>
              <button type="button" class="gb-btn gb-btn-sm" @click="submitReply(m.id)">{{ currentData.guestbook.replySubmit }}</button>
              <p v-if="replyOpenId === m.id && replyError" class="gb-form-error gb-form-error--inline">{{ replyError }}</p>
              <div class="gb-emoji-panel" :class="{ show: emojiPanelOpen && emojiTarget === 'reply' }">
                <span class="gb-emoji-item" v-for="e in EMOJI_LIST" :key="e" @click="insertEmoji(e)">{{ e }}</span>
              </div>
            </div>
          </article>
        </div>

        <!-- 分页 · pagination -->
        <div class="gb-pagination">
          <button type="button" class="gb-btn gb-btn-ghost" @click="prevPage" :disabled="gbPage <= 1">{{ currentData.guestbook.prev }}</button>
          <div class="gb-page-info">{{ gbPage }} / {{ gbTotalPages }}</div>
          <button type="button" class="gb-btn" @click="nextPage" :disabled="gbPage >= gbTotalPages">{{ currentData.guestbook.next }}</button>
        </div>
      </template>
    </section>

    <!-- 页脚 · Footer -->
    <footer class="footer">
      <div class="footer-content">
        <div class="footer-brand">
          <span class="footer-logo"></span>
          <span class="footer-divider"></span>
          <span class="footer-tagline" id="footer-text">{{ currentData.footerText }}</span>
        </div>
        <div class="footer-social">
          <a
            v-for="link in friendLinks"
            :key="link.href"
            class="social-link"
            :href="link.href"
            target="_blank"
            rel="noopener noreferrer"
            :title="link.title"
          >
            <i :class="link.icon" aria-hidden="true"></i>
          </a>
        </div>
        <div class="footer-bottom">
          <span> ©<span id="site-name">{{ currentData.siteName }}</span></span>
          <span class="footer-separator"></span>
          <span></span>
        </div>
      </div>
    </footer>

    <!-- 反馈问题按钮 · Feedback button -->
    <button class="feedback-btn" id="feedbackBtn" aria-label="反馈问题到GitHub" @click="openFeedback">
      <i class="fas fa-lightbulb" aria-hidden="true"></i>
      <span class="tooltip-text">{{ currentData.tooltips.feedback }}</span>
    </button>

    <!-- 返回顶部按钮 · Back to top button -->
    <button class="back-to-top" :class="{ visible: backToTopVisible }" id="backToTop" aria-label="返回页面顶部" @click="onBackToTop">
      <i class="fas fa-arrow-up" aria-hidden="true"></i>
      <span class="tooltip-text">{{ currentData.tooltips.backToTop }}</span>
    </button>
  </div>
</template>

<style>
/* 故事动态文本淡入淡出 · story text fade */
.story-fade-enter-active,
.story-fade-leave-active {
  transition: opacity 0.3s ease;
}

.story-fade-enter-from,
.story-fade-leave-to {
  opacity: 0;
}

/* 故事两行布局：上下间隔加大 · story lines spacing */
.story-lines {
  display: block;
}
.story-line {
  display: block;
}
.story-line + .story-line {
  margin-top: 1.25rem;
  display: inline-block;
  vertical-align: top;
}

/* 画廊关闭按钮 · gallery close button */
#closeModal {
  position: absolute;
  top: -12px;
  right: -12px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: #000;
  color: #fff;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.15s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
#closeModal:hover {
  background: #222;
  transform: scale(1.08);
}

/* 城市弹窗关闭按钮 · city modal close button */
#closeCityModal {
  position: absolute;
  top: 8px;
  right: 12px;
  border: none;
  background: transparent;
  color: #fff;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  z-index: 10;
  padding: 4px 8px;
  transition: opacity 0.2s, transform 0.15s;
}
#closeCityModal:hover {
  opacity: 0.7;
  transform: scale(1.1);
}
</style>
