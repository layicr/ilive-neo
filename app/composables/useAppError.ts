/**
 * 错误处理 composable · Error handling
 *
 * @description 从 error.js 迁移而来。
 *              统一错误处理：Toast 展示、错误日志（localStorage）、全局 error/unhandledrejection 监听。
 *              命名 useAppError 以避免与 Nuxt 内置 useError 冲突。
 */
import type { Ref } from 'vue'
import { CONFIG } from '~/utils/config'
import { useI18n } from './useI18n'
import { useSharedState } from './useSharedState'

interface ErrorInfo {
  message: string
  stack: string | null
  context: string
  timestamp: string
}

const LOG_KEY = 'errorLogs'
const MAX_LOGS = 50

/** 响应式 toast 消息状态 · Reactive toast message（共享状态，懒初始化） */
let toastTimer: ReturnType<typeof setTimeout> | null = null

function getToastMessage(): Ref<string | null> {
  return useSharedState<string | null>('error:toast', () => null) as Ref<string | null>
}

/** 获取错误提示文本 · Get error message by key */
function getErrorMessage(key: string): string {
  const { currentData } = useI18n()
  const messages = currentData.value.errorMessages as Record<string, string>
  return messages[key] || messages.generic
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
  if (!injected && typeof document !== 'undefined') {
    injected = true

    // 全局错误捕获
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
