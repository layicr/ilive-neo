/**
 * Nuxt 自动导入桩 · Stubs for Nuxt auto-imports（仅测试环境使用）
 *
 * @description `vitest.config.ts` 将 `#app` / `#imports` 别名指向本文件，
 *              使依赖 Nuxt 运行时的 composables（useData / useSharedState 等）
 *              与 server/lib/db-config 可在纯 node / happy-dom 环境下被单测。
 *              本文件不参与生产构建，仅由 test/ 下的用例引用。
 *
 *              Aliased from `#app` / `#imports` in vitest.config.ts so that composables
 *              (which rely on Nuxt auto-imports) can be unit-tested outside Nuxt.
 */
import { ref, type Ref } from 'vue'

// ==================== 共享状态 · Shared state ====================

const stateMap = new Map<string, Ref<unknown>>()

/** 模拟 Nuxt `useState`（同 key 返回同一 ref，天然按 key 共享）· Nuxt useState stub */
export function useState<T>(key: string, init?: () => T): Ref<T> {
  if (!stateMap.has(key)) {
    stateMap.set(key, ref(init ? init() : (undefined as unknown)))
  }
  return stateMap.get(key) as Ref<T>
}

/** 清空共享状态（用例隔离）· reset shared state between tests */
export function __resetNuxtState(): void {
  stateMap.clear()
}

// ==================== 异步数据 · useAsyncData ====================

const pendingTasks: Promise<unknown>[] = []
/** 记录每次 useAsyncData 的 key（供断言）· recorded keys */
export const __asyncDataKeys: string[] = []

/** 模拟 Nuxt `useAsyncData`：立即执行 fetcher，返回 data/pending/error/refresh */
export function useAsyncData<T>(key: string, fn: () => Promise<T> | T) {
  __asyncDataKeys.push(key)
  const data = ref<T | null>(null) as Ref<T | null>
  const pending = ref(true)
  const error = ref<unknown>(null)

  const run = async () => {
    pending.value = true
    try {
      data.value = await fn()
      error.value = null
    } catch (e) {
      error.value = e
    } finally {
      pending.value = false
    }
  }

  pendingTasks.push(run())

  return {
    data,
    pending,
    error,
    refresh: async () => {
      await run()
    },
    execute: run,
    status: ref('pending'),
    clear: () => {
      data.value = null
    }
  } as unknown as ReturnType<typeof useAsyncDataRealShape>
}

/** 仅用于类型占位 · type placeholder */
declare function useAsyncDataRealShape(): {
  data: Ref<unknown>
  pending: Ref<boolean>
  error: Ref<unknown>
  refresh: () => Promise<void>
}

/** 等待所有 useAsyncData 首次请求完成 · flush pending async data fetches */
export async function __flushAsyncData(): Promise<void> {
  while (pendingTasks.length) {
    const tasks = pendingTasks.splice(0, pendingTasks.length)
    await Promise.all(tasks)
  }
  // 让 computed / 微任务队列清空 · let microtasks drain
  await Promise.resolve()
}

// ==================== 运行时配置 · Runtime config ====================

let runtimeConfig: Record<string, unknown> = { turso: {}, public: {} }

/** 模拟 Nuxt `useRuntimeConfig` · runtimeConfig stub */
export function useRuntimeConfig(): Record<string, any> {
  return runtimeConfig as Record<string, any>
}

/** 设置 runtimeConfig（用例内注入）· inject runtimeConfig in tests */
export function __setRuntimeConfig(cfg: Record<string, unknown>): void {
  runtimeConfig = cfg
}

// ==================== 请求 · $fetch / headers ====================

let fetchImpl: (url: string, opts?: Record<string, unknown>) => Promise<unknown> = async () => {
  throw new Error('__setFetch 未配置 · __setFetch not configured')
}

/** 模拟 Nuxt `$fetch` · $fetch stub */
export function $fetch(url: string, opts?: Record<string, unknown>): Promise<unknown> {
  return fetchImpl(url, opts) as Promise<unknown>
}

/** 注入 $fetch 实现 · inject $fetch impl */
export function __setFetch(fn: (url: string, opts?: Record<string, unknown>) => Promise<unknown>): void {
  fetchImpl = fn
}

/** 模拟 `useRequestHeaders`（SSR 转发 IP 头）· stub */
export function useRequestHeaders(_names?: string[]): Record<string, string> {
  return {}
}

// ==================== i18n ====================

const localeRef = ref<string>('zh-CN')

/** 当前 locale（可注入）· current locale ref */
export function __localeRef(): Ref<string> {
  return localeRef
}

/** 设置当前 locale · set current locale */
export function __setLocale(l: string): void {
  localeRef.value = l
}

/** 记录 navigateTo 调用 · recorded navigations */
export const __navigations: string[] = []

/** 模拟 Nuxt `navigateTo` · navigateTo stub */
export function navigateTo(path: string): Promise<string> {
  __navigations.push(path)
  return Promise.resolve(path)
}

/** 模拟 `useSwitchLocalePath` · switchLocalePath stub */
export function useSwitchLocalePath(): (l: string) => string {
  return (l: string) => (l === 'zh-CN' ? '/' : `/${l}`)
}

/** 记录 t() 调用（供 i18n 代理断言）· recorded t() keys */
export const __tKeys: string[] = []

/** 模拟 `useI18n`（vue-i18n）· i18n stub */
export function useI18n(): Record<string, any> {
  return {
    locale: localeRef,
    t: (key: string) => {
      __tKeys.push(key)
      return key
    },
    tm: () => ({}),
    rt: (v: unknown) => (typeof v === 'string' ? v : '')
  }
}

/** 清空调用记录 · clear recorded calls */
export function __resetRecords(): void {
  __navigations.length = 0
  __tKeys.length = 0
  __asyncDataKeys.length = 0
}
