<script setup lang="ts">
/** 视频查看器模态 · Video modal（状态来自 useNavigation 共享态） */
import { useNavigation } from '~/composables/useNavigation'

const { videoModalOpen, videoModalUrl, videoModalTitle, closeVideoModal } = useNavigation()
</script>

<template>
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
</template>
