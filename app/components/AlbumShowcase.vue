<script setup lang="ts">
/** 3D 专辑展示 · 3D album showcase（布局/交互在 useAlbumShowcase；状态经 useState 共享，无需 props） */
import { onMounted, watch } from 'vue'
import { useAlbumShowcase } from '~/composables/useAlbumShowcase'
import { useData } from '~/composables/useData'
import { onThumbError } from '~/utils/thumb'

const { albums, selectedAlbumIndex, selectAlbum, init3DAlbumShowcase } = useAlbumShowcase()
const { dataReady } = useData()

// 客户端挂载后初始化 3D 布局；若数据在挂载后才就绪（异步加载），由 watch(dataReady) 补齐。
// Init the 3D layout after mount; if data resolves after mount, the dataReady watch covers it.
onMounted(() => {
  init3DAlbumShowcase()
})
watch(dataReady, (ready) => {
  if (ready) init3DAlbumShowcase()
})
</script>

<template>
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
              @error="onThumbError($event, album.rawPoster)"
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
</template>
