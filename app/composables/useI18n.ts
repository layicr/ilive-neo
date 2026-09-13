/**
 * i18n 应用层 composable · App i18n wrapper over @nuxtjs/i18n
 *
 * @description 包装官方 @nuxtjs/i18n（vue-i18n），向业务层暴露既有的
 *              { currentLanguage, currentData, currentStoriesText, initLanguage, switchLanguage }
 *              形状，避免一次性大改模板与众多 composable。
 *              底层 locale 由 URL 前缀驱动（SSR 安全、无 localStorage 自管）。
 *
 *              关键：UI 文案经 vue-i18n 的 `t()` 在 SSR 下保证可用；currentData 用深层代理把
 *              `currentData.a.b.c` 的取值解析为 `t('a.b.c')`（直接读 messages 在 SSR 异步加载时为空）。
 *
 *              注意：本文件不再导出名为 `useI18n` 的函数，以避免与 @nuxtjs/i18n 自动导入的
 *              `useI18n` 冲突；业务方统一 import `useAppI18n`。
 */

import { computed, unref } from 'vue'
import type { Locale } from '../types'
import { DEFAULT_LOCALE } from '../../server/lib/locales'

/** 语言类型 · Locale（中文 zh 为默认语言，无 URL 前缀）· 复用共享 Locale，避免联合类型两处维护 */
export type AppLocale = Locale

/** 当前语言文案（vue-i18n messages 形状，宽松类型）· messages in vue-i18n shape (loosely typed) */
export type AppMessages = Record<string, any>

/**
 * 应用层 i18n 入口 · Composable entry
 * @description 内部的 `useI18n` / `useSwitchLocalePath` / `navigateTo` 由 Nuxt 全局自动导入提供。
 */
export function useAppI18n() {
  const i18n = useI18n() as any
  const locale = i18n.locale as globalThis.Ref<AppLocale>

  /** 当前语言 · Current language（URL 驱动，响应式；SSR 下 locale 可能为 undefined，用 computed 包装避免 watch(undefined) 报错） */
  const currentLanguage = computed(() => locale.value ?? DEFAULT_LOCALE)

  /**
   * 深层 i18n 代理 · Deep i18n proxy
   * @description 业务层沿用 `currentData.a.b.c` 的取值写法；代理在「作为值使用」时经
   *              Symbol.toPrimitive 解析为 `t('a.b.c')`，从而保证 SSR 下文案可用
   *              （直接读 `messages` 在 SSR 异步加载时为空）。数组场景（stories）由
   *              currentStoriesText 另行用 `tm()` 提供。
   */
  function createI18nProxy(prefix: string): any {
    const resolve = () => (prefix ? i18n.t(prefix) : '')
    // 标准对象方法：全部返回 undefined，避免 Vue 响应式追踪 / JSON.stringify 触发 t('xxx.method')
    // standard object methods: return undefined so Vue reactivity / JSON.stringify won't trigger t('xxx.method')
    const OBJ_METHODS = new Set(['then', 'toJSON', 'toString', 'valueOf', 'toLocaleString', 'constructor'])
    const STR_METHODS = new Set(['replace', 'match', 'split', 'slice', 'substring', 'substr', 'concat', 'toUpperCase', 'toLowerCase', 'trim', 'padStart', 'padEnd', 'includes', 'startsWith', 'endsWith', 'indexOf', 'lastIndexOf', 'charAt', 'charCodeAt', 'localeCompare', 'repeat', 'normalize', 'codePointAt', 'anchor', 'big', 'blink', 'bold', 'fixed', 'fontcolor', 'fontsize', 'italics', 'link', 'small', 'strike', 'sub', 'sup'])
    return new Proxy(function () {} as any, {
      get(_target, key: string | symbol) {
        if (key === Symbol.toPrimitive) return () => resolve()
        if (key === 'toString') return () => String(resolve())
        if (key === Symbol.toStringTag) return undefined
        if (key === Symbol.iterator) {
          // 数组场景（如 v-for）：尝试用 tm() 取原值 · array case (e.g. v-for): try tm() to get the raw value
          const arr = i18n.tm?.(prefix)
          return arr != null && typeof arr[Symbol.iterator] === 'function'
            ? arr[Symbol.iterator].bind(arr)
            : undefined
        }
        if (typeof key === 'symbol') return undefined
        if (OBJ_METHODS.has(key as string)) return undefined
        if (STR_METHODS.has(key as string)) return undefined
        return createI18nProxy(prefix ? `${prefix}.${key}` : key)
      },
      apply() {
        return resolve()
      }
    })
  }

  /** 当前语言文案 · Current locale messages（经 t() 解析，SSR 安全） */
  const currentData = computed(() => createI18nProxy(''))

  /**
   * 将 `tm()` 返回的 locale message 解析为纯字符串 · Resolve a tm() locale message to plain text
   * @description vue-i18n 在消息被编译后，`tm()` 返回的是消息 AST（形如
   *              `{ type: 0, source, body: { items: [...] } }`）而非字符串，直接渲染会输出 JSON。
   *              按官方约定 `tm()` 的返回值必须配对使用 `rt()` 解析。
   */
  function resolveMsg(value: any): string {
    if (typeof value === 'string') return value
    if (value == null) return ''
    return typeof i18n.rt === 'function' ? i18n.rt(value) : ''
  }

  /** 解析数组型 locale message · Resolve an array locale message */
  function resolveMsgList(value: any): string[] {
    return Array.isArray(value) ? value.map(resolveMsg) : []
  }

  /**
   * 当前故事文本 · Stories texts（数组，tm() + rt()）
   * @description 注意：`tm()` 对「当前语言缺失的键」**不会**回退到 fallbackLocale ——
   *              @nuxtjs/i18n 按请求只注册当前语言的 message，其它语言的 message 在运行时
   *              getLocaleMessage / tm(key, locale) 均取不到（实测返回空对象）。
   *              因此 `stories` 必须在每个语言文件中都定义，否则该语言页面故事区渲染为空。
   */
  const currentStoriesText = computed<{ text1: string[]; text3: string[] }>(() => {
    const stories = i18n.tm?.('stories') ?? {}
    return {
      text1: resolveMsgList(stories.text1),
      text3: resolveMsgList(stories.text3)
    }
  })

  /** 初始化语言（已由 @nuxtjs/i18n 接管，保留空实现以兼容调用方）· init language (no-op; kept for API compatibility) */
  function initLanguage(): void {}

  /**
   * 切换语言 · Switch language
   * @description 通过 URL 前缀导航（prefix_except_default 策略），触发 SSR 重新渲染对应语言页。
   */
  function switchLanguage(lang: AppLocale): void {
    const path = useSwitchLocalePath()(lang)
    if (path) {
      navigateTo(path)
    }
  }

  return {
    currentLanguage,
    currentData,
    currentStoriesText,
    initLanguage,
    switchLanguage
  }
}
