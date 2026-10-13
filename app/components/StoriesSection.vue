<script setup lang="ts">
/**
 * 故事动态文本 · Stories text
 * @description 三组轮换：第一行 + 第二行（高亮填充）；定时器随本组件生命周期启停，
 *              语言切换在本组件内重置到第 0 组并重播高亮。
 */
import { onMounted, onUnmounted, watch } from 'vue'
import { useAppI18n } from '~/composables/useI18n'
import { CONFIG } from '~/utils/config'

const { currentStoriesText, currentLanguage } = useAppI18n()

/** 当前组索引（0/1/2）· current group index */
const storyIndex = ref(0)
/** 第三行是否播放填充动画（延迟激活，实现"先显示再变色"）· highlight playing flag */
const highlightActive = ref(false)
let dynamicTextTimers: ReturnType<typeof setInterval>[] = []
let highlightTimer: ReturnType<typeof setTimeout> | null = null

/** 第一段（第一行）文案 · first line text */
const storyText1 = computed(() => {
  const list = currentStoriesText.value.text1
  return list && list.length > 0 ? list[storyIndex.value % list.length] : ''
})
/** 第三段（第二行，高亮）文案 · second line (highlighted) text */
const storyText2 = computed(() => {
  const list = currentStoriesText.value.text3
  return list && list.length > 0 ? list[storyIndex.value % list.length] : ''
})

/** 播放第三行高亮填充 · play the highlight fill */
function playHighlight(): void {
  highlightActive.value = false
  requestAnimationFrame(() => { highlightActive.value = true })
}

/** 切换到下一组 · advance to next group */
function nextStoryGroup(): void {
  const len = currentStoriesText.value.text1?.length || 0
  if (len === 0) return
  storyIndex.value = (storyIndex.value + 1) % len
  if (highlightTimer) clearTimeout(highlightTimer)
  highlightTimer = setTimeout(playHighlight, 600)
}

function startDynamicTextTimers(): void {
  if (typeof window === 'undefined' || dynamicTextTimers.length > 0) return
  dynamicTextTimers = [
    setInterval(nextStoryGroup, CONFIG.DYNAMIC_TEXT_INTERVAL)
  ]
}

onMounted(() => {
  startDynamicTextTimers()
  // 首屏：文字先显示，延迟再播放第二行高亮填充 · first paint then replay highlight after a delay
  if (highlightTimer) clearTimeout(highlightTimer)
  highlightTimer = setTimeout(playHighlight, CONFIG.HIGHLIGHT_ANIMATION_DELAY)
})

onUnmounted(() => {
  dynamicTextTimers.forEach(timer => clearInterval(timer))
  dynamicTextTimers = []
  if (highlightTimer) clearTimeout(highlightTimer)
})

// 语言切换：重置到第 0 组并重播高亮（对齐原版 initStoriesText）· locale switch: reset to group 0 and replay
watch(currentLanguage, () => {
  storyIndex.value = 0
  if (highlightTimer) clearTimeout(highlightTimer)
  highlightTimer = setTimeout(playHighlight, CONFIG.HIGHLIGHT_ANIMATION_DELAY)
})
</script>

<template>
  <section class="section-spacing">
    <div class="max-w-4xl mx-auto px-6 mb-16">
      <p class="text-2xl md:text-3xl text-gray-400 leading-relaxed max-w-3xl">
        <Transition name="story-fade" mode="out-in">
          <span :key="storyIndex" class="story-lines">
            <span class="story-line">{{ storyText1 }}</span>
            <span class="story-line highlight-fill" :class="{ animate: highlightActive }">{{ storyText2 }}</span>
          </span>
        </Transition>
      </p>
    </div>
  </section>
</template>

<style>
/* 故事动态文本淡入淡出 · story text fade */
.story-fade-enter-active,
.story-fade-leave-active {
  transition: opacity 0.3s ease;
}
.story-fade-enter-from,
.story-fade-leave-to {
  opacity: 0;
}

/* 故事两行布局：上下间隔加大 · story lines spacing */
.story-lines {
  display: block;
}
.story-line {
  display: block;
}
.story-line + .story-line {
  margin-top: 1.25rem;
  display: inline-block;
  vertical-align: top;
}
</style>
