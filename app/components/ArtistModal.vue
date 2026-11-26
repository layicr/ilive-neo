<script setup lang="ts">
/** 艺人列表模态 · Artist modal（打开态/聚合数据来自 useArtistModal 共享态；搜索为组件内本地态） */
import { ref, computed, watch } from 'vue'
import { useArtistModal } from '~/composables/useArtistModal'
import { useAppI18n } from '~/composables/useI18n'

const { artistModalOpen, artists, closeArtistModal } = useArtistModal()
const { currentData } = useAppI18n()

/** 搜索关键词 · search keyword */
const artistSearch = ref('')

/** 过滤后的艺人（大小写不敏感，兼容中英文）· filtered artists, case-insensitive */
const filteredArtists = computed(() => {
  const q = artistSearch.value.trim().toLowerCase()
  if (!q) return artists.value
  return artists.value.filter(a => a.name.toLowerCase().includes(q))
})

// 每次打开清空上次搜索 · reset search on open
watch(artistModalOpen, (open) => {
  if (open) artistSearch.value = ''
})
</script>

<template>
  <div class="artist-modal" id="artistModal" role="dialog" aria-modal="true" aria-labelledby="artistModalTitle" :class="{ active: artistModalOpen }" @click.self="closeArtistModal">
    <div class="artist-modal-content">
      <div class="artist-modal-header">
        <button class="artist-modal-close" id="closeArtistModal" aria-label="关闭艺人列表" @click="closeArtistModal">&times;</button>
        <h2 class="artist-modal-title" id="artistModalTitle">{{ currentData.artistModal.title }}</h2>
        <div class="songlist-search-container">
          <input
            type="text"
            id="artistSearchInput"
            class="songlist-search-input"
            :placeholder="currentData.artistModal.searchPlaceholder"
            :aria-label="currentData.artistModal.searchPlaceholder"
            v-model="artistSearch"
          >
          <i class="fas fa-search songlist-search-icon"></i>
        </div>
      </div>
      <div class="artist-list" id="artistList">
        <div v-if="filteredArtists.length === 0" class="artist-empty">{{ currentData.artistModal.empty }}</div>
        <div v-for="artist in filteredArtists" :key="artist.name" class="artist-item">
          <span class="artist-name">{{ artist.name }}</span>
          <span class="artist-count">{{ artist.count }}{{ currentData.artistModal.countSuffix }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
