/**
 * 错误处理模块
 *
 * @module error
 * @description 提供统一的错误处理机制，包括错误捕获、用户提示、日志记录
 * @requires config.js（CONFIG配置）
 * @requires language.js（currentLanguage、currentData变量）
 *
 * 主要功能：
 * - handle：统一处理错误，支持用户提示和日志记录
 * - showUserMessage：显示Toast错误提示
 * - logError：本地存储错误日志（最多50条）
 * - getErrorLogs/clearErrorLogs：查询/清空错误日志
 * - safeExecute/safeExecuteAsync：安全执行函数（自动捕获错误）
 * - 全局错误捕获：window.onerror + unhandledrejection
 *
 * 错误类型（messageKey）：
 * - generic：通用错误
 * - network：网络错误
 * - loadFailed：加载失败
 * - musicPlay：音乐播放失败
 * - imageLoad：图片加载失败
 */

class ErrorHandler {
    /**
     * 处理错误
     * @param {Error|string} error - 错误对象或错误消息
     * @param {string} [context=''] - 错误发生的上下文（用于日志）
     * @param {boolean} [showUser=true] - 是否显示用户提示
     * @param {string} [messageKey='generic'] - 错误消息键名
     * @returns {Object} 错误信息对象
     */
    static handle(error, context = '', showUser = true, messageKey = 'generic') {
        const errorInfo = {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : null,
            context,
            timestamp: new Date().toISOString()
        };

        // 控制台输出
        console.error(`[${context}]`, error);

        // 显示用户友好的错误提示
        if (showUser) {
            const message = this.getErrorMessage(messageKey);
            this.showUserMessage(message);
        }

        // 记录错误日志
        this.logError(errorInfo);

        return errorInfo;
    }

    /**
     * 获取错误提示文本（根据当前语言）
     * @param {string} key - 错误消息键名
     * @returns {string} 错误提示文本
     */
    static getErrorMessage(key) {
        // 尝试从 currentData 获取
        if (typeof currentData !== 'undefined' && currentData.errorMessages) {
            return currentData.errorMessages[key] || currentData.errorMessages.generic;
        }

        // 后备默认文本
        const fallbackMessages = {
            zh: {
                generic: '操作失败，请稍后重试',
                network: '网络连接失败，请检查网络',
                loadFailed: '加载失败，请刷新页面',
                musicPlay: '音乐播放失败',
                imageLoad: '图片加载失败'
            },
            en: {
                generic: 'Operation failed, please try again later',
                network: 'Network connection failed, please check your network',
                loadFailed: 'Loading failed, please refresh the page',
                musicPlay: 'Music playback failed',
                imageLoad: 'Image loading failed'
            }
        };

        const lang = typeof currentLanguage !== 'undefined' ? currentLanguage : 'zh';
        return fallbackMessages[lang][key] || fallbackMessages[lang].generic;
    }

    /**
     * 显示用户友好的错误提示（Toast）
     * @param {string} message - 提示消息
     */
    static showUserMessage(message) {
        // 移除已有的 toast
        const existingToast = document.querySelector('.error-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = 'error-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            background: #f44336;
            color: white;
            border-radius: 8px;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: toastFadeIn 0.3s ease;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastFadeOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, CONFIG.TOAST_DURATION);
    }

    /**
     * 记录错误日志
     * @param {Object} errorInfo - 错误信息对象
     */
    static logError(errorInfo) {
        // 本地存储错误日志（最多保留50条）
        try {
            const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
            logs.push(errorInfo);

            // 保留最近50条
            if (logs.length > 50) logs.shift();

            localStorage.setItem('errorLogs', JSON.stringify(logs));
        } catch (e) {
            console.warn('无法保存错误日志:', e);
        }

        // 性能监控模式下打印详细信息
        if (CONFIG.PERFORMANCE_MONITOR) {
            console.table([errorInfo]);
        }
    }

    /**
     * 获取错误日志
     * @returns {Array} 错误日志列表
     */
    static getErrorLogs() {
        try {
            return JSON.parse(localStorage.getItem('errorLogs') || '[]');
        } catch (e) {
            return [];
        }
    }

    /**
     * 清空错误日志
     */
    static clearErrorLogs() {
        localStorage.removeItem('errorLogs');
    }

    /**
     * 安全执行函数（自动捕获错误）
     * @param {Function} fn - 要执行的函数
     * @param {string} context - 上下文
     * @param {*} fallback - 失败时的返回值
     */
    static safeExecute(fn, context = '', fallback = null) {
        try {
            return fn();
        } catch (error) {
            this.handle(error, context, false);
            return fallback;
        }
    }

    /**
     * 安全执行异步函数
     * @param {Function} fn - 要执行的异步函数
     * @param {string} context - 上下文
     * @param {*} fallback - 失败时的返回值
     */
    static async safeExecuteAsync(fn, context = '', fallback = null) {
        try {
            return await fn();
        } catch (error) {
            this.handle(error, context, false);
            return fallback;
        }
    }
}

// Toast 动画样式（动态注入）
const toastStyles = document.createElement('style');
toastStyles.textContent = `
    @keyframes toastFadeIn {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes toastFadeOut {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(20px); }
    }
`;
document.head.appendChild(toastStyles);

// 全局错误捕获
window.addEventListener('error', (e) => {
    ErrorHandler.handle(e.error, 'GlobalError', false);
});

window.addEventListener('unhandledrejection', (e) => {
    ErrorHandler.handle(e.reason, 'UnhandledPromise', false);
    e.preventDefault();
});