/**
 * 键盘事件管理器模块
 *
 * @module keyboardManager
 * @description 统一管理全局键盘事件，避免重复监听
 * @requires 无依赖（独立加载）
 *
 * 主要功能：
 * - register：注册键盘事件处理器
 * - unregister：注销键盘事件处理器
 * - 自动根据当前活动的模态框执行对应处理器
 *
 * 使用方式：
 * // 注册处理器
 * KeyboardManager.register('Escape', closeAllModals);
 * KeyboardManager.register('ArrowLeft', navigatePrev);
 *
 * // 注销处理器
 * KeyboardManager.unregister('Escape', closeAllModals);
 */

class KeyboardManager {
    constructor() {
        // 存储所有注册的处理器 { key: [handlers] }
        this.handlers = new Map();

        // 模态框优先级队列（后打开的模态框优先处理）
        this.modalPriority = [];

        // 绑定全局事件监听器
        this.init();
    }

    /**
     * 初始化全局键盘事件监听
     * @private
     */
    init() {
        document.addEventListener('keydown', (e) => {
            this.handleKeydown(e);
        });
    }

    /**
     * 处理键盘按下事件
     * @private
     * @param {KeyboardEvent} e - 键盘事件对象
     */
    handleKeydown(e) {
        const handlers = this.handlers.get(e.key);
        if (!handlers || handlers.length === 0) return;

        // 按照注册顺序执行处理器（先进先出）
        // 如果处理器返回true，则停止传播
        for (const handlerObj of handlers) {
            try {
                const shouldStop = handlerObj.handler(e);
                if (shouldStop === true) {
                    e.preventDefault();
                    e.stopPropagation();
                    break; // 停止执行后续处理器
                }
            } catch (error) {
                console.error('键盘事件处理器执行错误:', error);
            }
        }
    }

    /**
     * 注册键盘事件处理器
     * @param {string} key - 按键名称（如 'Escape', 'ArrowLeft'）
     * @param {Function} handler - 处理函数，返回true表示停止传播
     * @param {number} [priority=0] - 优先级（数值越大优先级越高）
     * @returns {Function} 注销函数
     */
    register(key, handler, priority = 0) {
        if (!this.handlers.has(key)) {
            this.handlers.set(key, []);
        }

        const handlerObj = { handler, priority };
        const handlers = this.handlers.get(key);

        // 按优先级插入（优先级高的在前）
        let inserted = false;
        for (let i = 0; i < handlers.length; i++) {
            if (priority > handlers[i].priority) {
                handlers.splice(i, 0, handlerObj);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            handlers.push(handlerObj);
        }

        // 返回注销函数
        return () => this.unregister(key, handler);
    }

    /**
     * 注销键盘事件处理器
     * @param {string} key - 按键名称
     * @param {Function} handler - 要注销的处理函数
     */
    unregister(key, handler) {
        const handlers = this.handlers.get(key);
        if (!handlers) return;

        // 查找并移除对应的处理器
        const index = handlers.findIndex(h => h.handler === handler);
        if (index !== -1) {
            handlers.splice(index, 1);
        }
    }

    /**
     * 注销指定按键的所有处理器
     * @param {string} key - 按键名称
     */
    clear(key) {
        this.handlers.delete(key);
    }

    /**
     * 注销所有处理器
     */
    clearAll() {
        this.handlers.clear();
    }
}

// 创建全局实例
const keyboardManager = new KeyboardManager();

// 导出供其他模块使用
window.KeyboardManager = keyboardManager;