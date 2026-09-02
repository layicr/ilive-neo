/**
 * 共享响应式状态 helper · Shared reactive state helper
 *
 * @description 封装 Nuxt `useState`，同时满足两个互相冲突的需求：
 *              1) 允许在 setup 之外（事件回调、工具函数）读取同一份状态；
 *              2) 服务端必须严格按请求隔离，不能跨请求共享。
 *
 *              因此按环境分流：
 *              - 服务端：直接委托 `useState`。`useState` 基于 `nuxtApp.payload.state`，
 *                天然按请求隔离；服务端所有调用都发生在 setup 阶段，不存在实例不可用问题。
 *                若在此缓存 ref，该 ref 会长期存活于 Node 进程并被后续请求复用，造成跨请求串数据。
 *              - 客户端：模块级缓存，使 `getErrorMessage()`、`openFeedback()` 等
 *                非 setup 上下文的调用仍能拿到同一个 ref。
 *
 *              Splits by environment: server delegates to useState (per-request isolation),
 *              client keeps a module-level cache so non-setup callers get the same ref.
 */
import type { Ref } from 'vue'

/** 客户端模块级缓存 · client-only cache (never populated on the server) */
const stateCache = new Map<string, Ref<unknown>>()

/**
 * 获取共享响应式状态 · Get a shared reactive state
 * @param key 全局唯一 key · globally unique key
 * @param initial 初始值工厂（惰性）· lazy initial value factory
 */
export function useSharedState<T>(key: string, initial: () => T): Ref<T> {
  // 服务端：不做任何缓存，避免跨请求泄漏 · server: no caching, avoid cross-request leaks
  if (import.meta.server) {
    return useState<T>(key, initial)
  }

  if (!stateCache.has(key)) {
    stateCache.set(key, useState<T>(key, initial) as Ref<unknown>)
  }
  return stateCache.get(key) as Ref<T>
}