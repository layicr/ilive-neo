<script setup lang="ts">
/** 图片查看器模态 · Gallery modal（状态来自 useGallery 共享态，含键盘导航与卸载清理） */
import { useGallery } from '~/composables/useGallery'

const { galleryOpen, currentImage, closeGallery, prevImage, nextImage } = useGallery()
</script>

<template>
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
</template>

<style>
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
</style>
