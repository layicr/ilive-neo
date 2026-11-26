<script setup lang="ts">
/**
 * 歌单查看器模态 · Songlist modal（状态来自 useSonglist 共享态；t() 为 vue-i18n 自动导入）
 * @description 列表按行窗口化渲染（复用票根弹窗的 vue-virtual 方案），避免长歌单一次性挂载全部 DOM；
 *              外链经 sanitizeHref 白名单校验，防止 javascript: 协议注入。
 */
import { computed, nextTick, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useSonglist } from '~/composables/useSonglist'
import { useAppI18n } from '~/composables/useI18n'
import { sanitizeHref } from '~/utils/friendLinks'

const { songlistOpen, songlistLoading, activeConcert, filteredSonglist, songlistSearch, closeSonglistModal } = useSonglist()
const { currentData } = useAppI18n()
/** vue-i18n 原始 t（参数化插值，自动导入）· raw t for parameterized messages */
const { t } = useI18n()

/** 虚拟滚动容器（滚动元素是 .songlist-container，不是 ol）· scroll element */
const songlistContainerRef = ref<HTMLElement | null>(null)
const SONG_ROW_GAP = 8
/**
 * options 必须整体包成 computed；count 必须是数字（传函数会让库内部 new Array(count) 抛 RangeError）。
 * 与 TicketModal.vue 保持同一写法。
 */
const virtualizer = useVirtualizer(computed(() => ({
  count: filteredSonglist.value.length,
  getScrollElement: () => songlistContainerRef.value,
  estimateSize: () => 44,
  overscan: 6,
  gap: SONG_ROW_GAP,
})))
/** 动态测量行高 · measure rendered row */
function setSonglistRowRef(el: Element | ComponentPublicInstance | null): void {
  virtualizer.value?.measureElement(el as HTMLElement | null)
}
watch(songlistOpen, (open) => {
  if (open) nextTick(() => virtualizer.value?.measure())
})
watch(filteredSonglist, () => {
  virtualizer.value?.scrollToOffset(0)
  nextTick(() => virtualizer.value?.measure())
})
/** 播放链接白名单校验（服务端已清洗，客户端再兜底）· allowlist href */
function safeSongLink(link: string | null | undefined): string | null {
  return sanitizeHref(link ?? null) || null
}
</script>

<template>
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
      <div class="songlist-container" id="songlistContainer" ref="songlistContainerRef">
        <div v-if="songlistLoading" class="songlist-loading" role="status" aria-live="polite">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        </div>
        <ol v-else class="songlist-list" :style="{ height: virtualizer.getTotalSize() + 'px' }">
          <li
            v-for="row in virtualizer.getVirtualItems()"
            :key="row.index"
            :ref="setSonglistRowRef"
            class="songlist-virtual-row"
            :style="{ transform: `translateY(${row.start}px)` }"
          >
            <div class="songlist-item" :class="{ 'has-link': !!safeSongLink(filteredSonglist[row.index]?.link) }">
              <span class="songlist-item-name">{{ filteredSonglist[row.index]?.name }}</span>
              <a
                v-if="safeSongLink(filteredSonglist[row.index]?.link)"
                class="songlist-play-btn"
                :href="safeSongLink(filteredSonglist[row.index]?.link) ?? undefined"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="'播放: ' + filteredSonglist[row.index]?.name"
              >
                <i class="fas fa-play"></i>
              </a>
            </div>
          </li>
        </ol>
      </div>
    </div>
  </div>
</template>
