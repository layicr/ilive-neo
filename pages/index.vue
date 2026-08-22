<script setup lang="ts">
/**
 * 首页 · Home page
 * @description 迁移自原 index.html <body> 的完整 DOM 骨架，视觉与交互 100% 保持一致。
 *              已彻底 Vue 化：所有动态内容由模板声明式渲染（v-for/插值），
 *              交互逻辑由 composables 提供，数据一次拉取双语后按语言本地化显示。
 *
 *              Mirrored from the original index.html <body> to keep visuals identical.
 */
import { useI18n } from '~/composables/useI18n'
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
import { safeHtml, formatWishTime } from '~/utils'
import { CONFIG } from '~/utils/config'

const { currentLanguage, currentData, currentStoriesText, currentRoleTexts, initLanguage, switchLanguage } = useI18n()
const { stats, dataReady, localizedConcerts, localizedCities, localizedWishes } = useData()
const { isPlaying, initBgMusic, toggleMusic } = useMusic()
const { galleryOpen, currentImage, openGallery, closeGallery, prevImage, nextImage } = useGallery()
const { songlistOpen, activeConcert, filteredSonglist, songlistSearch, openSonglistModal, closeSonglistModal } = useSonglist()
const { backToTopVisible, cityModalOpen, videoModalOpen, videoModalUrl, videoModalTitle, openCityModal, closeCityModal, openVideoModal, closeVideoModal, openFeedback, backToTop } = useNavigation()
const { sortedConcerts, visibleIds, initTimelineReveal } = useTimeline()
const { selectedAlbumIndex, albums, selectAlbum, applyCarouselLayout, init3DAlbumShowcase } = useAlbumShowcase()
const { ticketModalOpen, openTicketModal, closeTicketModal } = useTicketModal()
const { friendLinks } = useFriendLink()
useAppError()

// 语言切换：更新 document.title + 重置故事文案 + 重新应用专辑布局（模板自动更新文案，零请求）
watch(currentLanguage, () => {
  if (typeof document === 'undefined') return
  document.title = currentData.value.pageTitle
  // 对齐原版 initStoriesText：切换语言后重置为第 0 组并重新播放高亮动画
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
onMounted(() => {
  if (clientInited) return
  clientInited = true
  initLanguage()
  initBgMusic()
  startDynamicTextTimers()
  // 首屏：文字先显示，延迟再播放第二行高亮填充（对齐原版 initStoriesText）
  if (highlightTimer) clearTimeout(highlightTimer)
  highlightTimer = setTimeout(playHighlight, CONFIG.HIGHLIGHT_ANIMATION_DELAY)
  if (dataReady.value) initDataLayout()
})

// 数据就绪后：若尚未初始化（异步加载场景）则补齐时间轴渐显与专辑布局
watch(dataReady, (ready) => {
  if (ready) initDataLayout()
})

// 每次 DOM 更新后重新观察时间轴条目，确保 SSR/水合/语言切换后新渲染的节点
// 都能被 IntersectionObserver 捕获，按滚动渐显（与原版一致，避免显示不全）
onUpdated(() => {
  if (typeof document === 'undefined') return
  initTimelineReveal()
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

/** 播放第三行高亮填充（先清除旧动画再重播，对齐原版 playHighlightAnimation） */
function playHighlight(): void {
  highlightActive.value = false
  // 下一帧再激活，确保浏览器重排后重新播放 fillBackground
  requestAnimationFrame(() => { highlightActive.value = true })
}

/** 切换到下一组 · advance to next group */
function nextStoryGroup(): void {
  const len = currentStoriesText.value.text1?.length || 0
  if (len === 0) return
  storyIndex.value = (storyIndex.value + 1) % len
  // 整组切换后，延迟再播放第二行高亮（先显示文字，再慢慢变色）
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
const ROLE_TARGET_KEYS = ['declaration', 'concerts', 'cities'] as const

/** 三项 role 文本（与原版 applyComputedProperties 一致） */
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
  const key = ROLE_TARGET_KEYS[index]
  if (!key) return
  const targetSelector = (currentData.value.roleTarget as Record<string, string>)[key] ?? '#timeline'
  const target = document.querySelector(targetSelector) as HTMLElement | null
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// ==================== 时间轴 helpers ====================
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
function onSwitchLang(lang: 'zh' | 'en'): void {
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
</script>

<template>
  <div>
    <div class="language-switcher" role="group" aria-label="语言选择">
      <button class="lang-btn" :class="{ active: currentLanguage === 'zh' }" data-lang="zh" aria-label="切换到中文" @click="onSwitchLang('zh')">中文</button>
      <button class="lang-btn" :class="{ active: currentLanguage === 'en' }" data-lang="en" aria-label="切换到英文" @click="onSwitchLang('en')">EN</button>
    </div>
    <div class="music-player">
      <button class="music-btn" id="musicToggle" :class="{ playing: isPlaying }" aria-label="播放/暂停背景音乐" @click="onToggleMusic">
        <i :class="isPlaying ? 'fas fa-pause' : 'fas fa-music'" id="musicIcon" aria-hidden="true"></i>
        <span class="tooltip-text">{{ currentData.tooltips.musicToggle }}</span>
      </button>
      <span class="music-wave" :class="{ active: isPlaying }" id="musicWave" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </span>
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
              <img src="/img/logo.jpg" alt="layicr" class="avatar-image" onerror="this.src='/img/logo.jpg'">
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
          <div class="stat-number" id="total-cities">{{ stats.totalCities }}</div>
          <div class="stat-label" id="cities-label">{{ currentData.citiesLabel }}</div>
        </div>
        <div class="stat-card artists">
          <div class="stat-number" id="total-artists">{{ stats.totalArtists }}</div>
          <div class="stat-label" id="artists-label">{{ currentData.artistsLabel }}</div>
        </div>
        <div class="stat-card total" @click="onShowTicketModal">
          <div class="stat-number" id="total-concerts">{{ stats.totalConcerts }}</div>
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
              <img class="album-cover-img" :src="album.image" :alt="album.title">
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
          <h2 class="concert-artist">{{ concert.artist }}</h2>
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
          <div v-if="(concert.songlist && concert.songlist.length) || concert.video || concert.videoUrl" class="timeline-buttons">
            <button v-if="concert.songlist && concert.songlist.length" class="songlist-btn" :data-concert-id="concert.id" @click="openSonglistModal(concert)">
              <i class="fas fa-music" aria-hidden="true"></i> {{ currentData.buttons.songlist }}
            </button>
            <button v-if="concert.video" class="video-btn" :data-video-id="concert.video" :data-video-title="concert.artist + ' - ' + concert.concertName" @click="openVideoModal(concert.video, concert.artist + ' - ' + concert.concertName)">
              <i class="fas fa-video" aria-hidden="true"></i> {{ currentData.buttons.watchVideo }}
            </button>
            <button v-if="concert.videoUrl" class="video-link-btn" :data-video-url="concert.videoUrl" @click="window.open(concert.videoUrl, '_blank', 'noopener')">
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
            <span class="city-concerts">{{ currentData.cityList.concertsPrefix }}{{ city.concerts }}{{ currentData.cityList.concertsSuffix }}</span>
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
      <img v-if="currentImage" class="modal-content" id="modalImage" :src="currentImage.src" :alt="currentImage.alt">
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
          <p class="songlist-modal-subtitle" id="songlistModalSubtitle">{{ currentData.songlist.totalSongs.replace('{count}', String(filteredSonglist.length)) }}</p>
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
            <div class="wish-card-time">{{ formatWishTime(wish.time, currentLanguage) }}</div>
          </div>
        </div>
      </div>
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
            :title="currentLanguage === 'zh' ? link.title.zh : link.title.en"
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
</style>
