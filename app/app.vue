<script setup lang="ts">
/**
 * 应用根组件 · App root component
 * @description 渲染页面与全局 Toast，并输出「全站级 · 语言相关」SEO 元信息：
 *              按当前 locale 设置 <html lang>、5 个语言的 hreflang（含 x-default）、og:locale。
 *              页面级 title/description/og/twitter 由 app/pages/index.vue 的 useSeoMeta 负责；
 *              与语言无关的静态 meta（og:type/og:image/robots 等）留在 nuxt.config 的 app.head。
 *              Renders page + toast, and the site-wide locale-aware SEO tags.
 */
import { useAppError } from '~/composables/useAppError'
import { useData } from '~/composables/useData'
import { LOCALE_LANG, SEO_LOCALES, buildHreflangLinks, resolveSiteUrl, toLocaleUrl, toOgLocale } from '~/utils/seo'
import type { Locale } from '~/types'

const { toastMessage } = useAppError()

// ==================== 全站 SEO（语言相关）· Global locale-aware SEO ====================

const { locale, locales } = useI18n()

/** 站点 SEO（含 DB 的 site_url）· site SEO settings (DB-first) */
const { seo } = useData()
/** 生效的站点地址（DB site_settings.site_url 优先 → runtimeConfig.public.siteUrl/env → 代码兜底）· effective site URL */
const siteUrl = computed(() =>
  seo.value?.siteUrl || resolveSiteUrl(useRuntimeConfig().public.siteUrl as string | undefined)
)

/**
 * 输出 htmlAttrs.lang / hreflang / og:locale · Emit htmlAttrs.lang / hreflang / og:locale
 * @description hreflang link 使用稳定 key，与 app/pages/index.vue 中同名 key 合并去重，
 *              避免同一 hreflang 在页面中重复输出。
 *              hreflang links use stable keys merged with same-key links from index.vue to avoid duplicates.
 */
useHead(() => {
  const current = String(locale.value)
  const configured = (locales.value as unknown[])
    .map((l) => (typeof l === 'string' ? l : (l as { code?: string })?.code))
    .filter((c): c is string => !!c)
  const codes = configured.length > 0 ? configured : [...SEO_LOCALES]
  const currentLang = LOCALE_LANG[current as Locale] ?? current

  return {
    htmlAttrs: { lang: currentLang },
    link: [
      // canonical 按当前 locale 输出（默认语言无前缀，其余带语言前缀）· per-locale canonical
      { rel: 'canonical', href: toLocaleUrl(current, siteUrl.value), key: 'canonical' },
      ...buildHreflangLinks(codes, siteUrl.value)
    ],
    meta: [
      { property: 'og:locale', content: toOgLocale(currentLang), key: 'og-locale' },
      ...codes
        .filter((code) => code !== current)
        .map((code) => ({
          property: 'og:locale:alternate',
          content: toOgLocale(LOCALE_LANG[code as Locale] ?? code),
          key: `og-locale-alternate-${code}`
        }))
    ]
  }
})
</script>

<template>
  <div>
    <NuxtPage />
    <Transition name="toast">
      <div v-if="toastMessage" class="error-toast" role="alert">{{ toastMessage }}</div>
    </Transition>
  </div>
</template>

<style>
/* 全局错误提示 Toast · Global error toast */
.error-toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  background: #f44336;
  color: #fff;
  border-radius: 8px;
  font-size: 14px;
  z-index: 10000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
</style>
