<script setup lang="ts">
/** 返回顶部按钮 · Back-to-top button（滚轮监听在 useNavigation，随 app 生命周期） */
import { useNavigation } from '~/composables/useNavigation'
import { useAppI18n } from '~/composables/useI18n'

const { backToTopVisible, backToTop } = useNavigation()
const { currentData } = useAppI18n()
</script>

<template>
  <button class="back-to-top" :class="{ visible: backToTopVisible }" id="backToTop" aria-label="返回页面顶部" @click="backToTop">
    <i class="fas fa-arrow-up" aria-hidden="true"></i>
    <span class="tooltip-text">{{ currentData.tooltips.backToTop }}</span>
  </button>
</template>
