/**
 * 共享响应式状态 helper · Shared reactive state helper
 *
 * @description 封装 Nuxt `useState` 的「模块级单例 + 懒初始化」样板。
 *              同一 key 全局共享同一 ref，`initial` 仅在首次初始化时执行一次。
 *              SSR 安全：仅在实际调用时才触发 `useState`，避免模块顶层导入即触发的实例不可用问题。
 *              Wraps Nuxt useState's "module-singleton + lazy init" boilerplate behind one helper.
 */
import type { Ref } from 'vue'

/** 模块级缓存，避免重复调用 useState 造成实例分裂 · module-level cache to dedupe useState instances */
const stateCache = new Map<string, Ref<unknown>>()

/**
 * 获取共享响应式状态 · Get a shared reactive state
 * @param key 全局唯一 key · globally unique key
 * @param initial 初始值工厂（惰性）· lazy initial value factory
 */
export function useSharedState<T>(key: string, initial: () => T): Ref<T> {
  if (!stateCache.has(key)) {
    stateCache.set(key, useState<T>(key, initial) as Ref<unknown>)
  }
  return stateCache.get(key) as Ref<T>
}