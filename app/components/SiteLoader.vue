<script setup lang="ts">
/** 加载动画 · Loader（数据未就绪时显示） */
import { useData } from '~/composables/useData'
import { useAppI18n } from '~/composables/useI18n'

const { dataReady } = useData()
const { currentData } = useAppI18n()
</script>

<template>
  <div class="loader" id="loader" v-show="!dataReady">
    <div class="spinner"></div>
    <p id="loading-text">{{ currentData.status.loading }}</p>
  </div>
</template>
