/**
 * 键盘事件管理 composable · Keyboard event management
 *
 * @description 从 keyboardManager.js 迁移而来。
 *              模块级单例，统一管理全局键盘事件，支持优先级排序。
 *              用 onMounted/onUnmounted 自动注册/注销。
 */

type KeyHandler = (e: KeyboardEvent) => boolean | void

interface HandlerEntry {
  handler: KeyHandler
  priority: number
}

class KeyboardManager {
  private handlers = new Map<string, HandlerEntry[]>()
  private listenerBound = false

  /** 确保全局监听只绑定一次 · Ensure global listener bound once */
  private ensureListener(): void {
    if (this.listenerBound) return
    this.listenerBound = true
    document.addEventListener('keydown', (e) => this.handleKeydown(e))
  }

  /** 处理键盘按下 · Handle keydown */
  private handleKeydown(e: KeyboardEvent): void {
    const handlers = this.handlers.get(e.key)
    if (!handlers || handlers.length === 0) return

    for (const entry of handlers) {
      try {
        const shouldStop = entry.handler(e)
        if (shouldStop === true) {
          e.preventDefault()
          e.stopPropagation()
          break
        }
      } catch (error) {
        console.error('键盘事件处理器执行错误:', error)
      }
    }
  }

  /** 注册处理器 · Register handler */
  register(key: string, handler: KeyHandler, priority = 0): () => void {
    this.ensureListener()

    if (!this.handlers.has(key)) {
      this.handlers.set(key, [])
    }

    const entry: HandlerEntry = { handler, priority }
    const handlers = this.handlers.get(key)!

    let inserted = false
    for (let i = 0; i < handlers.length; i++) {
      if (priority > handlers[i].priority) {
        handlers.splice(i, 0, entry)
        inserted = true
        break
      }
    }
    if (!inserted) {
      handlers.push(entry)
    }

    return () => this.unregister(key, handler)
  }

  /** 注销处理器 · Unregister handler */
  unregister(key: string, handler: KeyHandler): void {
    const handlers = this.handlers.get(key)
    if (!handlers) return

    const index = handlers.findIndex(h => h.handler === handler)
    if (index !== -1) {
      handlers.splice(index, 1)
    }
  }

  /** 清空指定按键 · Clear key */
  clear(key: string): void {
    this.handlers.delete(key)
  }

  /** 清空所有 · Clear all */
  clearAll(): void {
    this.handlers.clear()
  }
}

/** 全局单例 · Global singleton */
let instance: KeyboardManager | null = null

/**
 * useKeyboard 组合式入口 · Composable entry
 */
export function useKeyboard() {
  if (!instance) {
    instance = new KeyboardManager()
  }
  return instance
}
