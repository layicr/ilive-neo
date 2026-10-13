<script setup lang="ts">
/**
 * 时间轴 · Timeline（渐显在 useTimeline）
 * @description 注意：description 走 safeHtml 白名单（v-html），勿改回原始插值（XSS 风险）。
 */
import { useTimeline } from '~/composables/useTimeline'
import { useData } from '~/composables/useData'
import { useGallery } from '~/composables/useGallery'
import { useSonglist } from '~/composables/useSonglist'
import { useNavigation } from '~/composables/useNavigation'
import { useAppError } from '~/composables/useAppError'
import { useAppI18n } from '~/composables/useI18n'
import { safeHtml, pickHotConcertIds } from '~/utils'
import { thumbSrc, onThumbError } from '~/utils/thumb'

const { sortedConcerts, visibleIds } = useTimeline()
const { localizedConcerts, toggleLike } = useData()
const { openGallery } = useGallery()
const { openSonglistModal } = useSonglist()
const { openVideoModal } = useNavigation()
const { showUserMessage } = useAppError()
const { currentData } = useAppI18n()

/** 点赞数前三的演唱会 id 集合（仅 >0，并列同显）· top-3 liked concert ids */
const hotConcertIds = computed<Set<number>>(() => pickHotConcertIds(localizedConcerts.value))

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
    // 限流：友好提示，不打 console.error · rate-limited: friendly toast, no scary log
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
</template>
