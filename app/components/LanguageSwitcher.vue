<script setup lang="ts">
/** 语言切换下拉 · Language switcher（document 监听在本组件配对注册/注销；切换走 useAppI18n.switchLanguage） */
import { onMounted, onUnmounted } from 'vue'
import { useAppI18n } from '~/composables/useI18n'
import type { AppLocale } from '~/composables/useI18n'
import { LOCALE_DEFINITIONS } from '~~/server/lib/locales'

const { currentLanguage, switchLanguage } = useAppI18n()

// 语言切换器列表 · language switcher list（源自 server/lib/locales 单一真源）
const langs: { code: AppLocale; label: string; name: string }[] = LOCALE_DEFINITIONS.map((l) => ({
  code: l.code,
  label: l.short,
  name: l.name
}))

const langOpen = ref(false)
const langSwitcherRef = ref<HTMLElement | null>(null)
/** 当前语言项（下拉触发器展示母语全称）· current locale entry for the trigger */
const currentLang = computed(() => langs.find((l) => l.code === currentLanguage.value) ?? langs[0])
/** 选择语言：关闭下拉并切换（同语言不重复导航）· pick a locale */
function selectLang(code: AppLocale): void {
  langOpen.value = false
  if (code === currentLanguage.value) return
  switchLanguage(code)
}
/** 点击外部关闭下拉 · close on outside click */
function onLangDocClick(e: MouseEvent): void {
  if (!langOpen.value) return
  if (langSwitcherRef.value && !langSwitcherRef.value.contains(e.target as Node)) {
    langOpen.value = false
  }
}
/** Esc 关闭下拉 · close on Escape */
function onLangKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') langOpen.value = false
}
onMounted(() => {
  document.addEventListener('click', onLangDocClick)
  document.addEventListener('keydown', onLangKeydown)
})
onUnmounted(() => {
  document.removeEventListener('click', onLangDocClick)
  document.removeEventListener('keydown', onLangKeydown)
})
</script>

<template>
  <div ref="langSwitcherRef" class="language-switcher" :class="{ open: langOpen }">
    <button
      type="button"
      class="lang-trigger"
      aria-haspopup="listbox"
      :aria-expanded="langOpen"
      aria-label="语言选择"
      @click="langOpen = !langOpen"
    >
      <i class="fas fa-globe" aria-hidden="true"></i>
      <span class="lang-trigger-label">{{ currentLang.name }}</span>
      <i class="fas fa-chevron-down lang-trigger-arrow" aria-hidden="true"></i>
    </button>
    <transition name="lang-drop">
      <ul v-show="langOpen" class="lang-menu" role="listbox" aria-label="语言选择">
        <li
          v-for="l in langs"
          :key="l.code"
          class="lang-option"
          :class="{ active: currentLanguage === l.code }"
          role="option"
          :aria-selected="currentLanguage === l.code"
          :data-lang="l.code"
          :aria-label="`切换到${l.label}`"
          @click="selectLang(l.code)"
        >
          <span class="lang-option-name">{{ l.name }}</span>
          <i v-if="currentLanguage === l.code" class="fas fa-check lang-option-check" aria-hidden="true"></i>
        </li>
      </ul>
    </transition>
  </div>
</template>
