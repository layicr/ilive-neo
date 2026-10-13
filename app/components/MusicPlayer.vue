<script setup lang="ts">
/**
 * 背景音乐播放器 + 宇宙入口 · Music player
 * @description 注意：audio/source 的 id 必须保留（initBgMusic / 语言切换换源依赖）。
 */
import { useMusic } from '~/composables/useMusic'
import { useAppI18n } from '~/composables/useI18n'

const { isPlaying, toggleMusic } = useMusic()
const { currentData } = useAppI18n()
</script>

<template>
  <div class="music-player">
    <div class="music-main">
      <button class="music-btn" id="musicToggle" :class="{ playing: isPlaying }" aria-label="播放/暂停背景音乐" @click="toggleMusic">
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
          <linearGradient id="xyGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#C896B2" />
            <stop offset="1" stop-color="#D993A7" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#xyGrad)" />
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
</template>
