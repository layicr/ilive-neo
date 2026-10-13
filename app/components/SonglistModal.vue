<script setup lang="ts">
/** 歌单查看器模态 · Songlist modal（状态来自 useSonglist 共享态；t() 为 vue-i18n 自动导入） */
import { useSonglist } from '~/composables/useSonglist'
import { useAppI18n } from '~/composables/useI18n'

const { songlistOpen, activeConcert, filteredSonglist, songlistSearch, closeSonglistModal } = useSonglist()
const { currentData } = useAppI18n()
/** vue-i18n 原始 t（参数化插值，自动导入）· raw t for parameterized messages */
const { t } = useI18n()
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
</template>
