/**
 * i18n composable · 双语文案与语言切换
 *
 * @description 从 language.js（文案部分）+ datas_zh/en.js 迁移而来。
 *              管理当前语言状态（zh/en），提供文案访问与语言切换。
 *              数据（concerts/cities/wishes）不在此承载，由 useData 独立管理。
 */
import { zh, storiesTextDataZH, roleTextsZH } from '~/locales/zh'
import { en, storiesTextDataEN, roleTextsEN } from '~/locales/en'
import type { Lang } from '~/types'
import { useSharedState } from './useSharedState'

const STORAGE_KEY = 'concertJourneyLang'

/** 当前语言 · Current language（共享状态，懒初始化，避免模块顶层调用 useState 导致 SSR 实例不可用） */
function getCurrentLanguage() {
  return useSharedState<Lang>('i18n:lang', () => 'zh')
}

/** 是否已初始化语言（避免重复读取 localStorage） */
let languageInitialized = false

/** 当前语言文案 · Current language texts */
function getCurrentData() {
  return computed(() => (getCurrentLanguage().value === 'zh' ? zh : en))
}

/** 当前故事文本 · Current stories texts */
function getCurrentStoriesText() {
  return computed(() =>
    getCurrentLanguage().value === 'zh' ? storiesTextDataZH : storiesTextDataEN
  )
}

/** 当前角色文本 · Current role texts */
function getCurrentRoleTexts() {
  return computed(() =>
    getCurrentLanguage().value === 'zh' ? roleTextsZH : roleTextsEN
  )
}

/**
 * 初始化语言（读取 localStorage 或浏览器语言）
 * @description 在客户端 onMounted 后调用，替代原 initPage 中的语言初始化逻辑。
 */
function initLanguage(): void {
  if (languageInitialized) return
  languageInitialized = true

  const currentLanguage = getCurrentLanguage()
  const savedLang = localStorage.getItem(STORAGE_KEY)
  if (savedLang === 'zh' || savedLang === 'en') {
    currentLanguage.value = savedLang
  } else {
    currentLanguage.value = navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  }
}

/**
 * 切换语言 · Switch language
 * @param lang 目标语言 · target language
 */
function switchLanguage(lang: Lang): void {
  const currentLanguage = getCurrentLanguage()
  if (lang === currentLanguage.value) return
  currentLanguage.value = lang
  localStorage.setItem(STORAGE_KEY, lang)
}

/**
 * 翻译函数 · Translate
 * @description 根据当前语言返回 zh/en 文本。
 */
function t(zhText: string, enText: string): string {
  return getCurrentLanguage().value === 'zh' ? zhText : enText
}

/**
 * useI18n 组合式入口 · Composable entry
 */
export function useI18n() {
  const currentLanguage = getCurrentLanguage()
  const currentData = getCurrentData()
  const currentStoriesText = getCurrentStoriesText()
  const currentRoleTexts = getCurrentRoleTexts()

  return {
    currentLanguage,
    currentData,
    currentStoriesText,
    currentRoleTexts,
    initLanguage,
    switchLanguage,
    t
  }
}
