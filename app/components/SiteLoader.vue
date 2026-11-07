<script setup lang="ts">
/**
 * 书册加载页 · Book-style full-screen loader
 *
 * @description 每次刷新播放：封面 → 19 场演唱会按「从慢到快」逐页翻阅 → 淡出显示首页面。
 *   · 数据：useData().localizedConcerts（真实 DB 数据，按日期倒序），海报走 thumbSrc() 与首页同 URL
 *   · 文案：i18n/locales/{zh-CN,en,zh-Hant}.ts 的 loadingBook 命名空间（tm + rt 解析引文数组）
 *   · 时序：useBookLoader 统一调度，数据就绪且过最短窗口即淡出，13.5s 硬上限兜底
 *   · 预取：翻页逐张预热 + 淡出期间 requestIdleCallback 补齐剩余海报
 *   · SSR：遮罩随 SSR 一起输出，避免水合前闪现首页；无 JS 时由纯 CSS 15s 兜底自动隐藏
 *
 *              Full-screen book loader fed by real concert data, localized copy, an accelerating
 *              page-turn timeline, early data-ready exit and a 15s hard cap.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData } from '~/composables/useData'
import {
  useBookLoader,
  createPosterPrefetcher,
  BOOK_FADE_MS,
  speedOf,
  type BookStep,
  type BookFinishReason
} from '~/composables/useBookLoader'
import { firstSentence } from '~/utils'
import { onThumbError, thumbSrc } from '~/utils/thumb'

const { dataReady, dataError, localizedConcerts } = useData()

/** vue-i18n：t 支持插值（引文改由真实数据的 theme 生成，不再依赖静态 message 数组） */
const i18n = useI18n() as any
function t(key: string, params?: Record<string, unknown>): string {
  return String(i18n.t(key, params ?? {}))
}

/** 书页视图数据 · view model for one page */
interface BookPage {
  id: number
  no: string
  date: string
  time: string
  artist: string
  name: string
  city: string
  venue: string
  poster: string
  rawPoster: string
  quote: string
}

/** 真实数据 → 书页（日期倒序，与目录一致）· real concerts → book pages (newest first) */
const pages = computed<BookPage[]>(() => {
  const list = [...localizedConcerts.value].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  const total = list.length
  return list.map((c, i) => ({
    id: c.id,
    no: String(total - i).padStart(2, '0'),
    date: c.date ?? '',
    time: c.time ?? '',
    artist: c.artist ?? '',
    name: c.concertName ?? '',
    city: c.locationDetail?.city ?? '',
    venue: c.locationDetail?.venue ?? '',
    poster: c.poster ? thumbSrc(c.poster) : '',
    rawPoster: c.poster ?? '',
    /** 引文 = 当前语言主题的第一句话 · quote = first sentence of the localized theme */
    quote: firstSentence(c.theme ?? '')
  }))
})

const total = computed(() => pages.value.length)
const posterUrls = computed(() => pages.value.map((p) => p.poster))

/** 文案插值参数（场次 / 城市数 / 起止年份均来自真实数据）· copy interpolation params */
const copyParams = computed(() => {
  const years = pages.value.map((p) => p.date.slice(0, 4)).filter(Boolean)
  return {
    count: total.value,
    cities: new Set(pages.value.map((p) => p.city).filter(Boolean)).size,
    from: years.length ? (years[years.length - 1] ?? '') : '',
    to: years.length ? (years[0] ?? '') : ''
  }
})

/** 静态文案集合（随语言响应式切换）· localized static copy */
const copy = computed(() => {
  const p = copyParams.value
  return {
    brand: t('loadingBook.brand'),
    brandTail: t('loadingBook.brandTail'),
    cvTop: t('loadingBook.cvTop'),
    cvTitle: t('loadingBook.cvTitle'),
    cvEn: t('loadingBook.cvEn', p),
    cvHint: t('loadingBook.cvHint'),
    cvCount: t('loadingBook.cvCount', p),
    tocKicker: t('loadingBook.tocKicker'),
    tocTitle: t('loadingBook.tocTitle'),
    tocSub: t('loadingBook.tocSub', p),
    labelNo: t('loadingBook.labelNo'),
    labelDate: t('loadingBook.labelDate'),
    labelCity: t('loadingBook.labelCity'),
    labelVenue: t('loadingBook.labelVenue'),
    labelContents: t('loadingBook.labelContents'),
    binding: t('loadingBook.binding'),
    closed: t('loadingBook.closed'),
    enter: t('loadingBook.enter', p)
  }
})

// ==================== 播放状态 · playback state ====================
/** 遮罩是否仍在 DOM（淡出结束后移除，e2e 的 #loader toBeHidden 依赖此行为） */
const visible = ref(true)
const phase = ref<'cover' | 'reading' | 'done'>('cover')
const page = ref(0)
const flipping = ref(false)
const flipKey = ref(0)
const flipMs = ref(500)
const speed = ref(1)
const flipFrom = ref(0)
const flipTo = ref(0)
/** 结束原因（暴露到 data-finish，便于 e2e / 排查）· finish reason */
const finishReason = ref<BookFinishReason | null>(null)

const current = computed(() => pages.value[page.value] ?? null)
const flipFromPage = computed(() => pages.value[flipFrom.value] ?? null)
const flipToPage = computed(() => pages.value[flipTo.value] ?? null)

/** 淡入速度写进 CSS 变量，随翻页节奏同步加快 · fade speed follows the pace */
const sheetStyle = computed(() => ({ '--spd': String(speed.value) }))
const flipperStyle = computed(() => ({ '--flip-ms': `${flipMs.value}ms` }))

/** 移动端迷你目录：当前页及前后各一行 · compact TOC rows (mobile) */
const nearbyRows = computed(() => {
  const rows: { index: number; no: string; artist: string; date: string }[] = []
  for (let k = page.value - 1; k <= page.value + 1; k++) {
    const p = pages.value[k]
    if (!p) continue
    rows.push({ index: k, no: p.no, artist: p.artist, date: p.date })
  }
  return rows
})

/** 淡出时进度条补满（提前因数据就绪而结束时也给出「完成」反馈）· complete the bar on finish */
const progressText = computed(() => {
  const n = phase.value === 'done' ? total.value : Math.min(page.value + 1, Math.max(total.value, 1))
  return `${String(n).padStart(2, '0')} / ${String(total.value).padStart(2, '0')}`
})
const progressPct = computed(() =>
  phase.value === 'done' || !total.value ? 100 : ((page.value + 1) / total.value) * 100
)
const barLabel = computed(() => {
  if (phase.value === 'done') return copy.value.closed
  const p = current.value
  if (phase.value === 'cover' || !p) return copy.value.binding
  return t('loadingBook.turning', { a: p.artist, n: p.name })
})

// ==================== 预取 / 调度 · prefetch & scheduling ====================
/** 与首页 AlbumShowcase 使用同一 thumb URL，淡出后 <img> 直接命中 HTTP cache */
const prefetcher = createPosterPrefetcher()
let loader: ReturnType<typeof useBookLoader> | null = null
let fadeTimer: ReturnType<typeof setTimeout> | null = null

function finish(reason: BookFinishReason): void {
  finishReason.value = reason
  phase.value = 'done'
  flipping.value = false
  // 淡出期间用空闲时间补齐剩余海报，不改变淡出时机
  prefetcher.fill(posterUrls.value)
  fadeTimer = setTimeout(() => {
    visible.value = false
    document.documentElement.classList.remove('book-loader-active', 'book-loader-armed')
  }, BOOK_FADE_MS)
}

onMounted(() => {
  // 水合成功才武装 CSS 兜底计时（与 SSR 资源下载耗时解耦）
  document.documentElement.classList.add('book-loader-active', 'book-loader-armed')
  loader = useBookLoader({
    total: total.value,
    onOpen: (gap) => {
      phase.value = 'reading'
      page.value = 0
      speed.value = speedOf(gap)
      prefetcher.warmAround(posterUrls.value, 0)
    },
    onFlip: (step: BookStep) => {
      flipFrom.value = Math.max(0, step.page - 1)
      flipTo.value = step.page
      flipMs.value = step.flipMs
      flipKey.value += 1
      flipping.value = true
    },
    onPage: (step: BookStep) => {
      page.value = step.page
      speed.value = step.speed
      prefetcher.warmAround(posterUrls.value, step.page)
    },
    onFlipEnd: () => {
      flipping.value = false
    },
    onFinish: finish
  })
  loader.start()
  // SSR 水合 / 客户端导航时数据通常已就绪；失败则立即露出页面以便看到错误提示
  if (dataReady.value) loader.setReady()
  if (dataError.value) loader.setFailed()
})

watch(dataReady, (ready) => {
  if (ready) loader?.setReady()
})
watch(dataError, (failed) => {
  if (failed) loader?.setFailed()
})

onUnmounted(() => {
  loader?.stop()
  if (fadeTimer) clearTimeout(fadeTimer)
  if (typeof document !== 'undefined') {
    document.documentElement.classList.remove('book-loader-active', 'book-loader-armed')
  }
})
</script>

<template>
  <!-- 纯 CSS 15s 兜底：即使 JS 未执行，遮罩也会自动隐藏，不会永久盖住首页 -->
  <div
    v-if="visible"
    id="loader"
    class="bk-loader"
    :class="{ 'is-done': phase === 'done' }"
    :data-finish="finishReason"
    aria-busy="true"
    :aria-label="copy.binding"
  >
    <div class="bk-background-circles" aria-hidden="true">
      <div class="bk-logo-letter">L</div>
      <div class="bk-circle bk-circle-1"></div>
      <div class="bk-circle bk-circle-2"></div>
      <div class="bk-circle bk-circle-3"></div>
    </div>

    <div class="bk-stage">
      <div class="bk-brand-mini">{{ copy.brand }} <span>·</span> {{ copy.brandTail }}</div>
      <div class="bk-enter-msg">{{ copy.enter }}</div>

      <div class="bk-book-scene">
        <div class="bk-book">
          <!-- 左页：完整目录（日期带年份） -->
          <div class="bk-page bk-page-left">
            <div class="bk-toc">
              <div class="bk-toc-kicker">{{ copy.tocKicker }}</div>
              <div class="bk-toc-title">{{ copy.tocTitle }}</div>
              <div class="bk-toc-sub">{{ copy.tocSub }}</div>
              <div class="bk-toc-list">
                <div
                  v-for="(p, i) in pages"
                  :key="p.id"
                  class="bk-toc-row"
                  :class="{ active: i === page }"
                >
                  <span class="bk-n">{{ p.no }}</span>
                  <span class="bk-a">{{ p.artist }} · {{ p.name }}</span>
                  <span class="bk-dots"></span>
                  <span class="bk-d">{{ p.date }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 右页：当前演出详情（:key 保证每次翻页重建 DOM、重播淡入） -->
          <div class="bk-page bk-page-right">
            <div v-if="current" :key="'right-' + page" class="bk-detail" :style="sheetStyle">
              <div class="bk-detail-head bk-fade-item" style="--k:.02">
                <span>{{ copy.labelNo }} {{ current.no }}</span><span>LIVE ARCHIVE</span>
              </div>
              <div class="bk-mini-toc bk-fade-item" style="--k:.05">
                <b>{{ copy.labelContents }}</b> · {{ String(page + 1).padStart(2, '0') }}/{{ total }}
                <div
                  v-for="row in nearbyRows"
                  :key="row.index"
                  class="bk-mt-row"
                  :class="{ now: row.index === page }"
                >{{ row.no }} · {{ row.artist }} {{ row.date }}</div>
              </div>
              <div class="bk-poster-wrap bk-fade-item" style="--k:.10">
                <img
                  v-if="current.poster"
                  class="bk-poster"
                  :src="current.poster"
                  alt=""
                  decoding="async"
                  @error="onThumbError($event, current.rawPoster)"
                >
                <div v-else class="bk-poster bk-poster-empty"></div>
                <div class="bk-poster-cap">{{ current.date }} · {{ current.city }}</div>
              </div>
              <div class="bk-artist bk-fade-item" style="--k:.16">{{ current.artist }}</div>
              <div class="bk-cname bk-fade-item" style="--k:.20">{{ current.name }}</div>
              <div class="bk-rule bk-fade-item" style="--k:.24"></div>
              <dl class="bk-meta bk-fade-item" style="--k:.28">
                <dt>{{ copy.labelDate }}</dt>
                <dd>{{ current.date }}{{ current.time ? ' · ' + current.time : '' }}</dd>
                <dt>{{ copy.labelCity }}</dt><dd>{{ current.city }}</dd>
                <template v-if="current.venue">
                  <dt>{{ copy.labelVenue }}</dt><dd>{{ current.venue }}</dd>
                </template>
              </dl>
              <div v-if="current.quote" class="bk-quote bk-fade-item" style="--k:.32">「 {{ current.quote }} 」</div>
              <div class="bk-page-num">— {{ page + 1 }} —</div>
            </div>
            <div v-else class="bk-detail bk-empty">{{ copy.binding }}</div>
          </div>

          <div class="bk-spine" aria-hidden="true"></div>

          <!-- 翻页纸：CSS animation + :key 重播，避免 transition 需要双 rAF -->
          <div v-if="flipping" :key="flipKey" class="bk-flipper" :style="flipperStyle" aria-hidden="true">
            <div class="bk-flip-face bk-flip-front">
              <div v-if="flipFromPage" :key="'front-' + flipKey" class="bk-flip-sheet" :style="sheetStyle">
                <div class="bk-detail-head"><span>{{ copy.labelNo }} {{ flipFromPage.no }}</span><span>LIVE ARCHIVE</span></div>
                <div class="bk-poster-wrap">
                  <img
                    v-if="flipFromPage.poster"
                    class="bk-poster"
                    :src="flipFromPage.poster"
                    alt=""
                    @error="onThumbError($event, flipFromPage.rawPoster)"
                  >
                  <div v-else class="bk-poster bk-poster-empty"></div>
                  <div class="bk-poster-cap">{{ flipFromPage.date }} · {{ flipFromPage.city }}</div>
                </div>
                <div class="bk-artist">{{ flipFromPage.artist }}</div>
                <div class="bk-cname">{{ flipFromPage.name }}</div>
                <div class="bk-rule"></div>
                <dl class="bk-meta">
                  <dt>{{ copy.labelDate }}</dt><dd>{{ flipFromPage.date }}</dd>
                  <dt>{{ copy.labelCity }}</dt><dd>{{ flipFromPage.city }}</dd>
                </dl>
              </div>
            </div>
            <div class="bk-flip-face bk-flip-back">
              <div v-if="flipToPage" :key="'back-' + flipKey" class="bk-flip-sheet" :style="sheetStyle">
                <div class="bk-detail-head"><span>{{ copy.labelNo }} {{ flipToPage.no }}</span><span>LIVE ARCHIVE</span></div>
                <div class="bk-poster-wrap">
                  <img
                    v-if="flipToPage.poster"
                    class="bk-poster"
                    :src="flipToPage.poster"
                    alt=""
                    @error="onThumbError($event, flipToPage.rawPoster)"
                  >
                  <div v-else class="bk-poster bk-poster-empty"></div>
                  <div class="bk-poster-cap">{{ flipToPage.date }} · {{ flipToPage.city }}</div>
                </div>
                <div class="bk-artist">{{ flipToPage.artist }}</div>
                <div class="bk-cname">{{ flipToPage.name }}</div>
                <div class="bk-rule"></div>
                <dl class="bk-meta">
                  <dt>{{ copy.labelDate }}</dt><dd>{{ flipToPage.date }}</dd>
                  <dt>{{ copy.labelCity }}</dt><dd>{{ flipToPage.city }}</dd>
                </dl>
              </div>
              <div v-else class="bk-fin">— Fin —</div>
            </div>
          </div>

          <!-- 封面 -->
          <div class="bk-cover" :class="{ open: phase !== 'cover' }" aria-hidden="true">
            <div class="bk-cv-top">{{ copy.cvTop }}</div>
            <div class="bk-cv-mark">L</div>
            <div class="bk-cv-title">{{ copy.cvTitle }}</div>
            <div class="bk-cv-en">{{ copy.cvEn }}</div>
            <div class="bk-cv-line"></div>
            <div class="bk-cv-count">{{ copy.cvCount }}</div>
            <div class="bk-cv-hint">{{ copy.cvHint }}</div>
          </div>
        </div>
      </div>

      <!-- 进度条（纯自动，无按钮 / 不可跳过） -->
      <div class="bk-loading-bar">
        <div class="bk-lb-text"><span>{{ barLabel }}</span><b>{{ progressText }}</b></div>
        <div class="bk-lb-track"><div class="bk-lb-fill" :style="{ width: progressPct + '%' }"></div></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== 遮罩与背景（沿用站点 #fafafa） ===== */
.bk-loader {
  position: fixed;
  inset: 0;
  z-index: 9000;
  overflow: hidden;
  background-color: #fafafa;
  color: #3a3a3a;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
/**
 * 纯 CSS 兜底只在「水合成功后」武装：慢网下 JS 可能十几秒后才到，
 * 若从页面加载起算 15s，遮罩会在动画开始前就被隐藏（40 KB/s 实测如此）。
 * 无 JS 场景由 app.head.noscript 里的 bk-nojs-hide 规则兜底。
 */
:global(html.book-loader-armed) .bk-loader {
  animation: bk-failsafe 0s linear 15s forwards;
}
@keyframes bk-failsafe {
  to { opacity: 0; visibility: hidden; pointer-events: none; }
}
:global(html.book-loader-active) { overflow: hidden; }

.bk-background-circles { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
.bk-logo-letter {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  font-size: 300px; font-weight: 800; font-family: Georgia, 'Times New Roman', serif;
  font-style: italic; letter-spacing: -15px; z-index: 2; user-select: none;
  background: linear-gradient(135deg, rgba(72,81,173,.15) 0%, rgba(255,107,53,.15) 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  text-shadow: 0 0 40px rgba(255,107,53,.1);
}
.bk-circle {
  position: absolute; top: 50%; left: 50%; border-radius: 50%;
  border: 1px dashed rgba(0,0,0,.25); animation: bk-rotate 30s linear infinite;
}
.bk-circle-1 { width: 400px; height: 400px; margin: -200px 0 0 -200px; animation-duration: 25s; }
.bk-circle-2 { width: 550px; height: 550px; margin: -275px 0 0 -275px; animation-duration: 35s; animation-direction: reverse; }
.bk-circle-3 { width: 700px; height: 700px; margin: -350px 0 0 -350px; animation-duration: 45s; }
@keyframes bk-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.bk-stage {
  position: relative; z-index: 5; height: 100%; min-height: 100dvh;
  display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px;
}
.bk-brand-mini {
  position: absolute; top: 34px; left: 50%; transform: translateX(-50%);
  font-size: 12px; letter-spacing: .32em; text-transform: uppercase;
  color: #4851AD; opacity: .75; font-weight: 600; white-space: nowrap;
}
.bk-brand-mini span { color: #FF6B35; }

/* ===== 书本 ===== */
.bk-book-scene { perspective: 2400px; width: min(940px, 92vw); margin-top: 18px; }
.bk-book {
  position: relative; width: 100%; aspect-ratio: 1.72 / 1; transform-style: preserve-3d;
  animation: bk-book-in 1.1s cubic-bezier(.2,.8,.25,1) both;
  filter: drop-shadow(0 34px 52px rgba(40,36,70,.18));
}
@keyframes bk-book-in {
  from { opacity: 0; transform: translateY(46px) rotateX(20deg) scale(.9); }
  to   { opacity: 1; transform: translateY(0) rotateX(0) scale(1); }
}
.bk-book::before, .bk-book::after {
  content: ''; position: absolute; left: 1.2%; right: 1.2%; bottom: -7px; height: 22px;
  background: repeating-linear-gradient(180deg,#fff 0 2px,#e9e5dc 2px 3px);
  border-radius: 0 0 8px 8px; box-shadow: 0 10px 18px rgba(0,0,0,.10); z-index: -1;
}
.bk-book::after { bottom: -13px; height: 12px; opacity: .6; }
.bk-page {
  position: absolute; top: 0; bottom: 0; width: 50%; overflow: hidden; background: #fffdf7;
  background-image:
    linear-gradient(90deg, rgba(120,100,70,.035) 0 1px, transparent 1px),
    radial-gradient(circle at 20% 30%, rgba(255,255,255,.9), transparent 60%);
  background-size: 26px 100%, 100% 100%;
}
.bk-page-left  { left: 0; border-radius: 8px 2px 2px 8px; box-shadow: inset -26px 0 34px -26px rgba(60,45,20,.5); }
.bk-page-right { right: 0; border-radius: 2px 8px 8px 2px; box-shadow: inset 26px 0 34px -26px rgba(60,45,20,.5); }
.bk-spine {
  position: absolute; top: 0; bottom: 0; left: calc(50% - 16px); width: 32px; z-index: 6;
  background: linear-gradient(90deg, rgba(70,55,30,.02), rgba(70,55,30,.20) 45%, rgba(70,55,30,.20) 55%, rgba(70,55,30,.02));
  pointer-events: none;
}

/* ===== 目录 ===== */
.bk-toc { padding: 38px 34px 26px 40px; height: 100%; display: flex; flex-direction: column; }
.bk-toc-kicker { font-size: 10px; letter-spacing: .3em; color: #b08d6a; text-transform: uppercase; }
.bk-toc-title {
  font-family: Georgia, serif; font-size: 34px; font-style: italic; margin: 6px 0 2px;
  background: linear-gradient(135deg,#4851AD,#FF6B35);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.bk-toc-sub { font-size: 11px; color: #9a8d7d; margin-bottom: 16px; }
.bk-toc-list { flex: 1; overflow: hidden; position: relative; }
.bk-toc-row {
  position: relative; display: flex; align-items: baseline; gap: 8px;
  font-size: 11px; color: #6b6257; padding: 1.6px 6px; border-radius: 4px;
  line-height: 1.35; transition: background .18s ease, color .18s ease;
}
.bk-toc-row .bk-n { width: 20px; color: #b5a894; font-variant-numeric: tabular-nums; flex: none; }
.bk-toc-row .bk-a { flex: none; max-width: 128px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bk-toc-row .bk-dots { flex: 1; border-bottom: 1px dotted #d8cfc0; transform: translateY(-3px); min-width: 6px; }
.bk-toc-row .bk-d { flex: none; font-variant-numeric: tabular-nums; color: #a1958a; font-size: 10px; }
.bk-toc-row.active { background: linear-gradient(90deg, rgba(72,81,173,.10), rgba(255,107,53,.06)); color: #4851AD; font-weight: 700; }
.bk-toc-row.active .bk-n, .bk-toc-row.active .bk-d { color: #FF6B35; }
.bk-toc-row.active::before { content: '▸'; position: absolute; left: -12px; color: #FF6B35; }

/* ===== 详情页 ===== */
.bk-detail, .bk-flip-sheet { padding: 34px 40px 26px 34px; height: 100%; display: flex; flex-direction: column; }
.bk-empty { align-items: center; justify-content: center; font-size: 13px; color: #a1958a; letter-spacing: .1em; }
.bk-detail-head { display: flex; justify-content: space-between; align-items: center; font-size: 10px; letter-spacing: .24em; color: #b08d6a; text-transform: uppercase; }
.bk-mini-toc { display: none; }
.bk-poster-wrap { position: relative; margin: 14px 0 16px; align-self: center; }
.bk-poster {
  width: 196px; height: 132px; object-fit: cover; border-radius: 3px; display: block;
  border: 6px solid #fff; box-shadow: 0 8px 20px rgba(60,45,30,.22);
  background: linear-gradient(135deg,#4851AD,#FF6B35); transform: rotate(-1.6deg);
}
.bk-poster-empty { border-color: #fff; }
.bk-poster-wrap::after {
  content: ''; position: absolute; inset: -6px; border-radius: 5px; pointer-events: none;
  background: linear-gradient(120deg, rgba(255,255,255,.42), transparent 42%);
}
.bk-poster-cap { text-align: center; font-size: 9px; letter-spacing: .22em; color: #a1958a; margin-top: 9px; }
.bk-artist { font-size: 27px; font-weight: 700; letter-spacing: -.02em; color: #2f2b26; line-height: 1.15; overflow-wrap: anywhere; }
.bk-cname { font-size: 14px; color: #4851AD; margin-top: 4px; font-weight: 600; overflow-wrap: anywhere; }
.bk-rule { height: 1px; background: linear-gradient(90deg,#d9cfbd,transparent); margin: 14px 0 12px; }
.bk-meta { display: grid; grid-template-columns: 52px 1fr; row-gap: 7px; font-size: 11.5px; }
.bk-meta dt { color: #b08d6a; letter-spacing: .08em; }
.bk-meta dd { margin: 0; color: #5b534a; overflow-wrap: anywhere; }
.bk-quote {
  margin-top: auto; font-family: Georgia, serif; font-style: italic; font-size: 11.5px;
  color: #8a7d6c; line-height: 1.6; border-left: 2px solid #FF6B35; padding-left: 10px;
}
.bk-page-num { position: absolute; bottom: 16px; right: 26px; font-size: 10px; color: #b5a894; font-family: Georgia, serif; }

/* ===== 翻页纸 ===== */
.bk-flipper {
  position: absolute; top: 0; bottom: 0; right: 0; width: 50%; z-index: 7;
  transform-origin: left center; transform-style: preserve-3d; pointer-events: none;
  animation: bk-flip var(--flip-ms, 500ms) cubic-bezier(.62,.03,.3,1) forwards;
}
@keyframes bk-flip { from { transform: rotateY(0deg); } to { transform: rotateY(-178deg); } }
.bk-flip-face {
  position: absolute; inset: 0; backface-visibility: hidden; overflow: hidden;
  border-radius: 2px 8px 8px 2px; background: #fffdf7;
}
.bk-flip-front { box-shadow: inset 26px 0 34px -26px rgba(60,45,20,.5); }
.bk-flip-front::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, rgba(0,0,0,0), rgba(0,0,0,.16));
}
.bk-flip-back {
  transform: rotateY(180deg); background: #f6f1e6; box-shadow: inset -26px 0 34px -26px rgba(60,45,20,.4);
  background-image: repeating-linear-gradient(180deg, transparent 0 23px, rgba(120,100,70,.045) 23px 24px);
}
.bk-flip-back::after {
  content: ''; position: absolute; inset: 0; z-index: 2; pointer-events: none;
  background: linear-gradient(90deg, rgba(60,45,20,.10), transparent 30%, transparent 70%, rgba(60,45,20,.05));
}
/* 桌面保持纯纸背（不遮挡左页目录）；移动端才预绘下一页，避免整页空白 */
.bk-flip-back .bk-flip-sheet, .bk-flip-back .bk-fin { display: none; }
.bk-flip-sheet { padding: 34px 40px; }
.bk-flip-back .bk-flip-sheet { opacity: .82; }
.bk-flip-sheet .bk-artist { font-size: 24px; }
.bk-flip-sheet .bk-poster { width: 150px; height: 100px; margin: 12px auto; }
.bk-fin {
  position: absolute; inset: 0; align-items: center; justify-content: center;
  font-family: Georgia, serif; font-style: italic; font-size: 20px; color: #b5a894;
}

/* ===== 封面 ===== */
.bk-cover {
  position: absolute; inset: 0; z-index: 9; border-radius: 8px; overflow: hidden;
  transform-origin: left center; transform-style: preserve-3d; pointer-events: none;
  transition: transform .8s cubic-bezier(.62,.03,.3,1), opacity .8s ease;
  background: linear-gradient(135deg,#3f478f 0%,#4851AD 42%,#7b4ea8 74%,#FF6B35 130%);
  color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center;
  box-shadow: inset 0 0 90px rgba(0,0,0,.28), 0 20px 40px rgba(40,36,70,.22);
}
.bk-cover::before { content: ''; position: absolute; inset: 14px; border: 1px solid rgba(255,255,255,.32); border-radius: 3px; }
.bk-cover::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(115deg, transparent 34%, rgba(255,255,255,.14) 50%, transparent 66%);
  animation: bk-sheen 3.2s ease-in-out infinite;
}
@keyframes bk-sheen { 0%,55% { transform: translateX(-100%); } 85%,100% { transform: translateX(100%); } }
.bk-cover.open { transform: rotateY(-168deg); opacity: 0; }
.bk-cv-top { font-size: 11px; letter-spacing: .5em; opacity: .75; z-index: 2; }
.bk-cv-mark { font-family: Georgia, serif; font-style: italic; font-size: 88px; line-height: 1; margin: 8px 0 2px; z-index: 2; }
.bk-cv-title { font-size: 26px; letter-spacing: .34em; z-index: 2; font-weight: 300; text-align: center; }
.bk-cv-en { font-family: Georgia, serif; font-style: italic; font-size: 15px; letter-spacing: .16em; opacity: .82; margin-top: 10px; z-index: 2; }
.bk-cv-line { width: 90px; height: 1px; background: rgba(255,255,255,.55); margin: 22px 0; z-index: 2; }
.bk-cv-count { font-size: 11px; letter-spacing: .28em; opacity: .8; z-index: 2; }
.bk-cv-hint { position: absolute; bottom: 26px; font-size: 10px; letter-spacing: .2em; opacity: .66; z-index: 2; animation: bk-breathe 1.5s ease-in-out infinite; }
@keyframes bk-breathe { 0%,100% { opacity: .35; } 50% { opacity: .9; } }

/* ===== 进度条 ===== */
.bk-loading-bar { width: min(940px, 92vw); margin-top: 30px; }
.bk-lb-text { display: flex; justify-content: space-between; gap: 12px; font-size: 11px; color: #8a8175; margin-bottom: 9px; letter-spacing: .06em; }
.bk-lb-text span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bk-lb-text b { color: #4851AD; font-weight: 600; flex: none; }
.bk-lb-track { height: 3px; background: rgba(72,81,173,.12); border-radius: 3px; overflow: hidden; }
.bk-lb-fill { height: 100%; width: 0; border-radius: 3px; background: linear-gradient(90deg,#4851AD,#FF6B35); transition: width .22s ease; }

/* ===== 收尾淡出 ===== */
.is-done .bk-book-scene { animation: bk-fade-out .9s ease forwards; }
.is-done .bk-loading-bar, .is-done .bk-brand-mini { opacity: 0; transition: opacity .5s; }
@keyframes bk-fade-out { to { opacity: 0; transform: scale(.94) translateY(-20px); } }
.bk-enter-msg {
  position: absolute; z-index: 4; font-family: Georgia, serif; font-style: italic;
  font-size: 20px; color: #4851AD; opacity: 0; transition: opacity .8s .6s ease;
  text-align: center; padding: 0 20px;
}
.is-done .bk-enter-msg { opacity: 1; }
/* --spd 由翻页节奏注入：慢翻=1，快翻≈.35，让内容淡入同步加速 */
.bk-fade-item {
  opacity: 0;
  animation: bk-fade-up calc(.45s * var(--spd, 1)) ease
             calc(var(--k, 0) * 1s * var(--spd, 1)) forwards;
}
@keyframes bk-fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* ===== 移动端：单页书册 ===== */
@media (max-width: 720px) {
  .bk-stage { padding: 16px; }
  .bk-brand-mini { top: 20px; font-size: 9px; letter-spacing: .22em; }
  .bk-logo-letter { font-size: 200px; }
  .bk-book-scene { width: min(360px, 88vw); margin-top: 8px; }
  .bk-book { aspect-ratio: .78 / 1; }
  .bk-book::before, .bk-book::after { left: 2%; right: 2%; }
  .bk-page-left { display: none; }
  .bk-page-right {
    width: 100%; left: 0; right: auto; border-radius: 4px 8px 8px 4px;
    box-shadow: inset 22px 0 30px -24px rgba(60,45,20,.5);
  }
  .bk-spine { left: 0; width: 16px; background: linear-gradient(90deg, rgba(70,55,30,.24), rgba(70,55,30,.04) 80%); }
  .bk-flipper { width: 100%; }
  .bk-flip-face { border-radius: 4px 8px 8px 4px; }
  .bk-flip-back .bk-flip-sheet { display: flex; }
  .bk-flip-back .bk-fin { display: flex; }
  .bk-flip-sheet { padding: 22px 22px 22px 28px; }
  .bk-flip-sheet .bk-detail-head { font-size: 8px; }
  .bk-flip-sheet .bk-poster { width: 96px; height: 66px; border-width: 4px; }
  .bk-flip-sheet .bk-artist { font-size: 15px; }
  .bk-flip-sheet .bk-cname { font-size: 10px; }
  .bk-flip-sheet .bk-rule { margin: 8px 0; }
  .bk-flip-sheet .bk-meta { font-size: 9px; grid-template-columns: 36px 1fr; row-gap: 4px; }

  .bk-detail { padding: 22px 20px 20px 28px; }
  .bk-detail-head { font-size: 8px; letter-spacing: .16em; }
  .bk-mini-toc {
    display: block; margin-top: 12px; padding: 7px 9px; border-radius: 4px;
    background: rgba(72,81,173,.055); border-left: 2px solid #FF6B35;
    font-size: 9px; color: #8a7d6c; line-height: 1.6;
  }
  .bk-mini-toc b { color: #4851AD; font-weight: 600; }
  .bk-mt-row { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: .55; }
  .bk-mt-row.now { opacity: 1; font-weight: 700; color: #4851AD; }
  .bk-poster-wrap { margin: 12px 0; }
  .bk-poster { width: min(150px, 42vw); height: auto; aspect-ratio: 3/2; border-width: 5px; }
  .bk-artist { font-size: clamp(16px, 5.2vw, 22px); }
  .bk-cname { font-size: clamp(11px, 3.4vw, 14px); }
  .bk-rule { margin: 10px 0 9px; }
  .bk-meta { font-size: clamp(9.5px, 2.9vw, 11.5px); grid-template-columns: 38px 1fr; row-gap: 5px; }
  .bk-quote { font-size: 10px; line-height: 1.5; }
  .bk-page-num { bottom: 12px; right: 18px; font-size: 9px; }
  .bk-cover::before { inset: 10px; }
  .bk-cv-top { font-size: 8px; letter-spacing: .34em; }
  .bk-cv-mark { font-size: 62px; }
  .bk-cv-title { font-size: clamp(15px, 4.6vw, 20px); letter-spacing: .2em; }
  .bk-cv-en { font-size: 11px; letter-spacing: .08em; }
  .bk-cv-line { margin: 16px 0; }
  .bk-cv-count { font-size: 9px; letter-spacing: .16em; }
  .bk-cv-hint { bottom: 18px; font-size: 9px; }
  .bk-loading-bar { width: min(360px, 88vw); margin-top: 24px; }
  .bk-lb-text { font-size: 9.5px; }
  .bk-enter-msg { font-size: 15px; }
}
@media (max-width: 380px) {
  .bk-quote { display: none; }
  .bk-cv-mark { font-size: 52px; }
}
@media (prefers-reduced-motion: reduce) {
  .bk-circle, .bk-cover::after, .bk-cv-hint { animation: none; }
}
</style>
