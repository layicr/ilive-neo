/**
 * Nuxt 自动导入全局桩 · Global stubs for Nuxt auto-imports（仅测试环境）
 *
 * @description 业务源码中的 `useState` / `$fetch` / `useI18n` / `useSwitchLocalePath` /
 *              `navigateTo` 等是按 Nuxt 约定以「裸标识符」使用的（编译期由 Nuxt 注入），
 *              不经过任何模块 import，因此 `#app` 别名对它们无效。本 setup 文件把这些
 *              桩函数挂到 `globalThis`，使 composables / server lib 能在 vitest 下直接运行。
 *              单个用例可用 `vi.stubGlobal` 覆盖本文件注入的任一桩。
 *
 *              Business code consumes `useState` / `$fetch` / `useI18n` … as Nuxt auto-import
 *              globals (bare identifiers, no module import), so the `#app` alias cannot resolve
 *              them. This setup file attaches the stubs to `globalThis`; individual tests may
 *              override any of them with `vi.stubGlobal`.
 */
import {
  useState,
  useAsyncData,
  $fetch,
  useRuntimeConfig,
  useRequestHeaders,
  useI18n,
  useSwitchLocalePath,
  navigateTo
} from '#app'

const g = globalThis as unknown as Record<string, unknown>

g.useState = useState
g.useAsyncData = useAsyncData
// 代理函数：内部读取 stub 的 fetchImpl，故 __setFetch 注入后立即生效
// proxy: reads the stub's fetchImpl, so a later __setFetch takes effect immediately
g.$fetch = (url: string, opts?: Record<string, unknown>) => $fetch(url, opts)
g.useRuntimeConfig = useRuntimeConfig
g.useRequestHeaders = useRequestHeaders
g.useI18n = useI18n
g.useSwitchLocalePath = useSwitchLocalePath
g.navigateTo = navigateTo

export {}
