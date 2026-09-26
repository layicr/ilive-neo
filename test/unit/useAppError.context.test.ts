// @vitest-environment happy-dom
/**
 * useAppError —— 上下文安全回归测试 · Context-safety regression
 *
 * @description 历史 bug：`handleError` 在 watch / 事件回调里走 `getErrorMessage` → `useAppI18n`
 *              → `useI18n()`，而 vue-i18n 在没有组件实例时会**直接抛**
 *              "Must be called at the top of a `setup` function"，导致「数据加载失败」的 Toast
 *              完全不显示且抛出未捕获异常。
 *
 *              修复后：文案解析器在 setup 阶段注册，非 setup 上下文复用。此处把 `useAppI18n`
 *              打桩成与真实 vue-i18n 一致的「无实例即抛错」，锁住该行为，防止回归。
 *
 *              Regression guard: handleError must still show localized copy when called outside
 *              setup. useAppI18n is stubbed to throw without an instance, like real vue-i18n.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

/** 错误文案解析器 mock：无组件实例时抛错，与真实 vue-i18n 行为一致 · stub mirroring real vue-i18n */
vi.mock('../../app/composables/useI18n', async () => {
  const { computed, getCurrentInstance } = await import('vue')
  return {
    useAppI18n: () => {
      if (getCurrentInstance() == null) {
        throw new Error('Must be called at the top of a `setup` function')
      }
      const currentData = computed(() => ({
        errorMessages: {
          generic: '出错了',
          loadFailed: '加载失败，请刷新页面',
          rateLimited: '操作太频繁'
        }
      }))
      return { currentLanguage: computed(() => 'zh-CN'), currentData }
    }
  }
})

import { useAppError } from '../../app/composables/useAppError'

/** 在真实 setup 上下文中调用 useAppError 并取出返回 API · call useAppError inside real setup */
function captureFromSetup() {
  let api!: ReturnType<typeof useAppError>
  const Host = defineComponent({
    setup() {
      api = useAppError()
      return () => h('div')
    }
  })
  const wrapper = mount(Host)
  return { api, wrapper }
}

/** 静音 handleError 的 console.error · silence handleError's console.error */
function muteConsole(): () => void {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  return () => spy.mockRestore()
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAppError — 非 setup 上下文调用（watch / 事件回调）', () => {
  it('setup 注册后，回调里 handleError 能展示本地化文案且不抛错', () => {
    const restore = muteConsole()
    const { api } = captureFromSetup()

    // 此处已离开 setup 作用域（getCurrentInstance() 为 null），正是历史 bug 的触发场景
    // We are outside setup here (getCurrentInstance() is null) — exactly the historical bug scenario.
    expect(() => {
      api.handleError(new Error('boom'), 'DataFetch', true, 'loadFailed')
    }).not.toThrow()
    expect(api.toastMessage.value).toBe('加载失败，请刷新页面')

    restore()
  })

  it('未知 key 在回调中同样回退到 generic 文案', () => {
    const restore = muteConsole()
    const { api } = captureFromSetup()

    expect(() => {
      api.handleError(new Error('x'), 'C', true, 'unknown_key')
    }).not.toThrow()
    expect(api.toastMessage.value).toBe('出错了')

    restore()
  })

  it('非 setup 上下文再次调用 useAppError() 不抛错（沿用已注册解析器）', () => {
    captureFromSetup()
    expect(() => useAppError()).not.toThrow()
  })

  it('showUser=false 时不弹 Toast，但仍记录错误日志', () => {
    const restore = muteConsole()
    const { api } = captureFromSetup()
    api.toastMessage.value = null

    api.handleError(new Error('silent'), 'DataFetch', false, 'loadFailed')

    expect(api.toastMessage.value).toBeNull()
    const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]')
    expect(logs.some((l: { context: string }) => l.context === 'DataFetch')).toBe(true)

    restore()
  })
})
