/**
 * 错误处理 composable · Error handling
 *
 * @description 从 error.js 迁移而来。
 *              统一错误处理：Toast 展示、错误日志（localStorage）、全局 error/unhandledrejection 监听。
 *              命名 useAppError 以避免与 Nuxt 内置 useError 冲突。
 */
import { getCurrentInstance } from 'vue'
import type { Ref } from 'vue'
import { CONFIG } from '~/utils/config'
import { useAppI18n } from './useI18n'
import { useSharedState } from './useSharedState'

/** 单条错误记录（持久化到 localStorage）· One error record persisted to localStorage */
interface ErrorInfo {
  /** 错误消息 · error message */
  message: string
  /** 堆栈（非 Error 时为 null）· stack (null for non-Error) */
  stack: string | null
  /** 触发上下文（如 GlobalError / UnhandledPromise）· context tag */
  context: string
  /** ISO 时间戳 · ISO timestamp */
  timestamp: string
}

/** localStorage 存储键 · localStorage key */
const LOG_KEY = 'errorLogs'
/** 最多保留的错误条数（超出丢弃最旧）· max retained logs (oldest dropped) */
const MAX_LOGS = 50

/** 响应式 toast 消息状态 · Reactive toast message（共享状态，懒初始化） */
let toastTimer: ReturnType<typeof setTimeout> | null = null

function getToastMessage(): Ref<string | null> {
  return useSharedState<string | null>('error:toast', () => null) as Ref<string | null>
}

/**
 * 错误文案解析器 · Error copy resolver
 * @description 在 **setup 阶段**注册（此时 `useAppI18n` 可用），供之后 watch / 事件回调 /
 *              全局监听等**非 setup 上下文**的调用复用，从而不再在回调里解析 i18n。
 *
 *              原因：vue-i18n 的 `useI18n()` 取不到组件实例时会**直接抛**
 *              `Must be called at the top of a 'setup' function`（见 vue-i18n dist 的 useI18n 守卫）。
 *              若在回调中才解析文案，错误提示会整体失效并把该异常抛到上层（历史 bug）。
 *
 *              Registered during setup (where useAppI18n works) and reused by non-setup callers —
 *              resolving i18n inside callbacks throws and silently kills the user-facing message.
 */
let resolveCopy: ((key: string) => string) | null = null

/**
 * 注册 / 刷新错误文案解析器 · Register (or refresh) the error copy resolver
 * @description 仅在处于 setup 上下文时尝试注册，保证文案跟随最新语言与实例；
 *              非 setup 上下文且已有解析器时直接跳过（此时真实 `useI18n()` 必然抛错，无需尝试）。
 *              Refreshed while inside setup; non-setup callers reuse the last registered resolver.
 */
function refreshCopyResolver(): void {
  const inSetup = getCurrentInstance() !== null
  if (!inSetup && resolveCopy) return
  try {
    const { currentData } = useAppI18n()
    resolveCopy = (key: string): string => {
      const messages = currentData.value.errorMessages as Record<string, string>
      // String() 显式求值：currentData 是深层 i18n 代理，取其原始字符串
      // Explicit String(): currentData is a deep i18n proxy; force the primitive value.
      return String(messages[key] || messages.generic || '')
    }
  } catch {
    // 既不在 setup 上下文、又从未注册过（正常流程不会发生）：保留 null，由 getErrorMessage 兜底
    // Neither in setup nor previously registered (should not happen): keep null, handleError falls back.
  }
}

/**
 * 获取错误提示文案 · Get localized error copy by key
 * @description 读已注册的解析器而非直接调用 `useAppI18n`，因此在任意上下文（含回调）都安全。
 *              Reads the registered resolver instead of calling useAppI18n, so it is safe in any context.
 */
function getErrorMessage(key: string): string {
  if (!resolveCopy) {
    if (import.meta.dev) console.warn('[useAppError] 文案解析器未注册（缺少 setup 上下文），错误提示已跳过')
    return ''
  }
  return resolveCopy(key)
}

/** 显示 Toast 错误提示 · Show toast */
function showUserMessage(message: string): void {
  const toastMessage = getToastMessage()
  toastMessage.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMessage.value = null
  }, CONFIG.TOAST_DURATION)
}

/** 记录错误日志 · Log error to localStorage */
function logError(errorInfo: ErrorInfo): void {
  try {
    const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]') as ErrorInfo[]
    logs.push(errorInfo)
    if (logs.length > MAX_LOGS) logs.shift()
    localStorage.setItem(LOG_KEY, JSON.stringify(logs))
  } catch (e) {
    console.warn('无法保存错误日志:', e)
  }

  if (CONFIG.PERFORMANCE_MONITOR) {
    console.table([errorInfo])
  }
}

/** 统一错误处理 · Handle error */
function handleError(
  error: Error | string,
  context = '',
  showUser = true,
  messageKey = 'generic'
): ErrorInfo {
  const errorInfo: ErrorInfo = {
    message: error instanceof Error ? (error.message ?? '') : String(error),
    stack: error instanceof Error ? error.stack : null,
    context,
    timestamp: new Date().toISOString()
  }

  console.error(`[${context}]`, error)

  if (showUser) {
    showUserMessage(getErrorMessage(messageKey))
  }

  logError(errorInfo)
  return errorInfo
}

/** 是否已注入全局错误监听 · Whether global listeners are injected */
let injected = false

/**
 * useAppError 组合式入口 · Composable entry
 * @description 首次调用时注入全局错误监听；toast 由响应式状态驱动，渲染交给 app.vue。
 */
export function useAppError() {
  // 在 setup 上下文中注册 / 刷新文案解析器；非 setup 调用（如 useMusic 的事件回调）沿用上一次
  // Register/refresh the copy resolver in setup contexts; non-setup callers reuse the last one.
  refreshCopyResolver()

  if (!injected && typeof document !== 'undefined') {
    injected = true

    // 全局错误捕获 · global error capture
    window.addEventListener('error', (e) => {
      handleError(e.error, 'GlobalError', false)
    })

    window.addEventListener('unhandledrejection', (e) => {
      handleError(e.reason, 'UnhandledPromise', false)
      e.preventDefault()
    })
  }

  return {
    toastMessage: getToastMessage(),
    handleError,
    showUserMessage
  }
}
