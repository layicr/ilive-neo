<script setup lang="ts">
/** 反馈问题按钮 · Feedback button */
import { useNavigation } from '~/composables/useNavigation'
import { useAppI18n } from '~/composables/useI18n'

const { openFeedback } = useNavigation()
const { currentData } = useAppI18n()
</script>

<template>
  <button class="feedback-btn" id="feedbackBtn" aria-label="反馈问题到GitHub" @click="openFeedback">
    <i class="fas fa-lightbulb" aria-hidden="true"></i>
    <span class="tooltip-text">{{ currentData.tooltips.feedback }}</span>
  </button>
</template>
