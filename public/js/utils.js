/**
 * 工具函数模块
 *
 * @module utils
 * @description 提供通用辅助函数，包括语言切换、XSS防护、时间格式化、性能优化等
 * @requires config.js（CONFIG配置）
 * @requires language.js（currentLanguage变量）
 *
 * 主要功能：
 * - getLangData：根据当前语言获取对应数据对象
 * - t：翻译函数，返回中英文文本
 * - escapeHtml：HTML转义，防止XSS攻击
 * - safeCreateElement：安全创建DOM元素
 * - safeHtml：允许安全标签的HTML处理
 * - formatWishTime：许愿时间格式化
 * - applyComputedProperties：为数据对象添加计算属性
 * - debounce：防抖函数，延迟执行高频事件
 * - throttle：节流函数，限制执行频率
 */

// ==================== 性能优化函数 ====================
/**
 * 防抖函数
 * @param {Function} fn - 需要防抖的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 防抖后的函数
 * @description 延迟执行函数，在延迟期间多次调用只执行最后一次
 *              适用于 resize、输入验证等场景
 * @example
 * window.addEventListener('resize', debounce(handleResize, 200));
 */
function debounce(fn, delay) {
    let timeoutId = null;
    return function(...args) {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            fn.apply(this, args);
            timeoutId = null;
        }, delay);
    };
}

/**
 * 节流函数
 * @param {Function} fn - 需要节流的函数
 * @param {number} interval - 执行间隔（毫秒）
 * @returns {Function} 节流后的函数
 * @description 限制函数执行频率，在指定间隔内只执行一次
 *              适用于 scroll、mousemove 等高频事件
 * @example
 * window.addEventListener('scroll', throttle(handleScroll, 100));
 */
function throttle(fn, interval) {
    let lastTime = 0;
    let timeoutId = null;
    return function(...args) {
        const now = Date.now();
        const remaining = interval - (now - lastTime);
        
        if (remaining <= 0 || remaining > interval) {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            lastTime = now;
            fn.apply(this, args);
        } else if (!timeoutId) {
            timeoutId = setTimeout(() => {
                lastTime = Date.now();
                timeoutId = null;
                fn.apply(this, args);
            }, remaining);
        }
    };
}

// ==================== 语言切换函数 ====================

/**
 * 获取指定语言的数据对象
 * @param {Object} zhData - 中文数据对象
 * @param {Object} enData - 英文数据对象
 * @param {string} [lang] - 语言代码，默认使用 currentLanguage
 * @returns {Object} 对应语言的数据对象
 */
function getLangData(zhData, enData, lang) {
    const currentLang = lang || (typeof currentLanguage !== 'undefined' ? currentLanguage : 'zh');
    return currentLang === 'zh' ? zhData : enData;
}

/**
 * 歌单数据本地化处理
 * @param {Array} songlist - 歌曲数组，每项可为 { zh, en, link } 对象
 * @param {string} lang - 语言代码（'zh' 或 'en'）
 * @returns {Array} 处理后的歌单，每项为 { name, link }（无链接时 link 为 null）
 * @description 将双语歌单对象按当前语言映射为 { name, link }，供 songlist.js 渲染。
 */
function processSonglist(songlist, lang) {
    if (!Array.isArray(songlist)) return [];
    const currentLang = lang || (typeof currentLanguage !== 'undefined' ? currentLanguage : 'zh');
    return songlist.map(item => {
        if (item && typeof item === 'object') {
            const name = currentLang === 'zh' ? item.zh : (item.en || item.zh);
            return { name: name, link: item.link || null };
        }
        return { name: String(item), link: null };
    });
}

/**
 * 翻译函数
 * @param {string} zhText - 中文文本
 * @param {string} enText - 英文文本
 * @param {string} [lang] - 语言代码，默认使用 currentLanguage
 * @returns {string} 对应语言的文本
 */
function t(zhText, enText, lang) {
    const currentLang = lang || (typeof currentLanguage !== 'undefined' ? currentLanguage : 'zh');
    return currentLang === 'zh' ? zhText : enText;
}

/**
 * HTML转义（防止XSS攻击）
 * @param {string} text - 需要转义的文本
 * @returns {string} 转义后的安全文本
 * @description 转义8种危险字符：& < > " ' ` = /
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return text;

    const escapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };

    return text.replace(/[&<>"'`=\/]/g, char => escapeMap[char] || char);
}

/**
 * 安全创建DOM元素
 * @param {string} tag - 元素标签名
 * @param {string} [content] - 元素文本内容（自动安全处理）
 * @param {string} [className] - 元素类名
 * @returns {HTMLElement} 创建的DOM元素
 * @description 使用 textContent 自动安全处理内容，替代 innerHTML
 */
function safeCreateElement(tag, content, className) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content) element.textContent = content;
    return element;
}

/**
 * 安全HTML处理（允许特定安全标签，过滤所有属性）
 * @param {string} html - HTML字符串
 * @returns {string} 处理后的安全HTML
 * @description 使用 DOMParser 解析并过滤，仅保留允许的安全标签，
 *              所有属性（包括事件处理属性）均被移除，防止XSS攻击。
 *              允许的安全标签：br, b, i, strong, em, span, p
 */
function safeHtml(html) {
    if (typeof html !== 'string') return html;

    const allowedTags = new Set(['br', 'b', 'i', 'strong', 'em', 'span', 'p']);

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    function cleanNode(node) {
        const result = [];
        for (const child of node.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                result.push(document.createTextNode(child.textContent));
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const tagName = child.tagName.toLowerCase();
                if (allowedTags.has(tagName)) {
                    const newEl = document.createElement(tagName);
                    // 允许 <span> 保留 style 属性（用于项目中的高亮），
                    // 但仍严格过滤事件处理属性（如 onclick, onerror, onload 等）
                    if (tagName === 'span' && child.hasAttribute('style')) {
                        const styleValue = child.getAttribute('style');
                        // 过滤掉包含 'javascript:' 或表达式引用的 style
                        if (styleValue && !/javascript:/i.test(styleValue)) {
                            newEl.setAttribute('style', styleValue);
                        }
                    }
                    // 递归处理子节点
                    cleanNode(child).forEach(n => newEl.appendChild(n));
                    result.push(newEl);
                } else {
                    // 不在白名单的标签，丢弃标签本身，只保留子节点
                    result.push(...cleanNode(child));
                }
            }
        }
        return result;
    }

    const container = document.createElement('div');
    cleanNode(doc.body).forEach(node => container.appendChild(node));

    return container.innerHTML;
}

/**
 * 输入验证和净化（用于搜索等用户输入）
 * @param {string} input - 用户输入
 * @param {number} maxLength - 最大长度限制（默认100）
 * @returns {string} 验证后的安全输入
 * @description 去除前后空格，限制长度，转义HTML特殊字符，防止XSS注入
 */
function sanitizeInput(input, maxLength = 100) {
    if (typeof input !== 'string') return '';

    // 去除前后空格
    let sanitized = input.trim();

    // 限制长度（防止过长输入）
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }

    // 转义HTML特殊字符（防止XSS）
    sanitized = escapeHtml(sanitized);

    return sanitized;
}

/**
 * 图片错误处理函数
 * @param {HTMLImageElement} img - 图片元素
 * @param {string} originalSrc - 原始图片地址
 * @param {string} [fallbackSrc='img/logo.jpg'] - 失败后的占位图地址
 * @description 统一处理图片加载失败逻辑，包括：
 *              1. 尝试降级加载（缩略图 → 中等图 → 原图）
 *              2. 重试机制（最多3次）
 *              3. 显示占位图
 * @example
 * imgElement.onerror = function() {
 *     handleImageError(this, originalImageUrl);
 * };
 */
function handleImageError(img, originalSrc, fallbackSrc = 'img/logo.jpg') {
    // 累计错误次数
    img.errorCount = (img.errorCount || 0) + 1;

    // 如果当前是缩略图或中等尺寸图，尝试降级到原图
    if (img.src.includes('_thumb.jpg') || img.src.includes('_medium.jpg')) {
        console.warn(`图片加载失败（尝试 ${img.errorCount}），使用原图:`, originalSrc);
        img.src = originalSrc;
        img.srcset = '';
        return;
    }

    // 如果是原图且重试次数未达上限，延迟重试
    if (img.errorCount < CONFIG.IMAGE_RETRY_MAX) {
        const retryDelay = CONFIG.IMAGE_RETRY_DELAY * img.errorCount;
        console.warn(`原图加载失败（尝试 ${img.errorCount}），${retryDelay}ms 后重试`);
        setTimeout(() => {
            // 添加随机参数避免缓存
            img.src = img.src.split('?')[0] + '?retry=' + img.errorCount;
        }, retryDelay);
        return;
    }

    // 重试次数已达上限，显示占位图
    console.error(`图片加载失败（尝试 ${img.errorCount}），显示占位图`);
    img.src = fallbackSrc;
    img.onerror = null; // 移除错误处理器，避免无限循环
}

// ==================== URL安全验证 ====================
/**
 * 验证URL安全性
 * @param {string} url - 需要验证的URL
 * @returns {boolean} 是否为安全的URL
 * @description 只允许http/https协议，防止javascript:等危险协议
 *              用于防御XSS攻击中的协议注入
 */
function isValidUrl(url) {
    if (typeof url !== 'string') return false;

    // 允许的协议白名单
    const allowedProtocols = ['http://', 'https://', 'mailto:', 'tel:'];
    const lowerUrl = url.toLowerCase().trim();

    // 检查是否以安全协议开头
    return allowedProtocols.some(protocol => lowerUrl.startsWith(protocol));
}

/**
 * 安全设置URL属性
 * @param {HTMLElement} element - DOM元素
 * @param {string} attr - 属性名（href/src）
 * @param {string} url - URL值
 * @returns {boolean} 是否成功设置
 * @description 验证URL安全性后再设置，防止javascript:协议注入
 */
function safeSetUrl(element, attr, url) {
    if (isValidUrl(url)) {
        element.setAttribute(attr, url);
        return true;
    } else {
        console.warn('不安全的URL被阻止:', url);
        return false;
    }
}

/**
 * 格式化许愿时间
 * @param {string} timeString - 时间字符串（ISO格式）
 * @param {string} [lang] - 语言代码，默认使用 currentLanguage
 * @returns {string} 格式化后的时间文本
 * @description 显示相对时间（刚刚、分钟前、小时前、天前）
 *              超过7天则显示具体日期
 */
function formatWishTime(timeString, lang) {
    const currentLang = lang || (typeof currentLanguage !== 'undefined' ? currentLanguage : 'zh');
    const date = new Date(timeString);
    const now = new Date();
    const diff = now - date;

    // 获取时间格式文本（从配置或后备）
    const getTimeText = (key) => {
        if (typeof currentData !== 'undefined' && currentData.timeFormat) {
            return currentData.timeFormat[key];
        }
        // 后备文本
        const fallback = {
            zh: { justNow: '刚刚', minutesAgo: '分钟前', hoursAgo: '小时前', daysAgo: '天前' },
            en: { justNow: 'Just now', minutesAgo: ' min ago', hoursAgo: ' hours ago', daysAgo: ' days ago' }
        };
        return fallback[currentLang][key];
    };

    if (diff < 60000) return getTimeText('justNow');
    if (diff < 3600000) return Math.floor(diff / 60000) + getTimeText('minutesAgo');
    if (diff < 86400000) return Math.floor(diff / 3600000) + getTimeText('hoursAgo');
    if (diff < 604800000) return Math.floor(diff / 86400000) + getTimeText('daysAgo');

    return date.toLocaleDateString(currentLang === 'zh' ? 'zh-CN' : 'en-US');
}

/**
 * 为数据对象添加计算属性
 * @param {Object} dataObj - 数据对象（concertDataZH 或 concertDataEN）
 * @param {string} showFirStr - 显示前缀字符串
 * @description 添加以下计算属性：
 *              - totalConcerts：演唱会总数
 *              - totalArtists：艺人数目
 *              - totalCities：城市数目
 *              - roles：角色描述数组
 *              使用缓存机制避免重复计算
 */
function applyComputedProperties(dataObj, showFirStr) {
    const cache = new Map();

    Object.defineProperty(dataObj, 'totalConcerts', {
        get: function() {
            const key = 'totalConcerts';
            if (cache.has(key)) return cache.get(key);
            const value = this.concerts.length;
            cache.set(key, value);
            return value;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(dataObj, 'totalArtists', {
        get: function() {
            const key = 'totalArtists';
            if (cache.has(key)) return cache.get(key);
            const value = new Set(this.concerts.map(c => c.artist)).size;
            cache.set(key, value);
            return value;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(dataObj, 'totalCities', {
        get: function() {
            const key = 'totalCities';
            if (cache.has(key)) return cache.get(key);
            const value = new Set(this.cities.map(c => c.name)).size;
            cache.set(key, value);
            return value;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(dataObj, 'roles', {
        get: function() {
            const key = `roles-${showFirStr}`;
            if (cache.has(key)) return cache.get(key);
            const roleTexts = this === concertDataZH ? roleTextsZH : roleTextsEN;
            const value = [
                showFirStr + roleTexts.declaration,
                showFirStr + this.totalConcerts + "   （" + roleTexts.concertsLabel + "）",
                showFirStr + this.totalCities + "   （" + roleTexts.citiesLabel + "）"
            ];
            cache.set(key, value);
            return value;
        },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(dataObj, '_cache', {
        value: cache,
        writable: true,
        enumerable: false,
        configurable: true
    });
}