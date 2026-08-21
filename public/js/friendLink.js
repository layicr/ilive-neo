/**
 * 页脚友情链接模块
 *
 * @module friendLink
 * @description 动态生成页脚友情链接，支持中英文双语切换
 * @requires language.js（currentLanguage变量）
 *
 * 主要功能：
 * - generateFriendLinks：动态生成友情链接HTML
 * - updateFriendLinks：语言切换时更新友情链接title
 * - 支持中英文title属性自动切换
 *
 * 友情链接数据结构：
 * - href：链接地址
 * - icon：Font Awesome图标类名
 * - title：双语标题对象 { zh: "中文", en: "英文" }
 *
 *
 * DOM元素：
 * - footer-social：页脚社交链接容器
 *
 * 事件监听：
 * - DOMContentLoaded：页面加载时生成友情链接
 * - 语言切换：通过language.js调用updateFriendLinks更新
 */

// ==================== 友情链接数据 ====================
/**
 * 友情链接数据数组
 * @type {Array<Object>}
 * @description 包含9个友情链接对象，每个对象包含href、icon、title属性
 */
const friendLinksData = [
    {
        href: "http://www.lyc.la",
        icon: "fas fa-globe",
        title: { zh: "lyc.la", en: "lyc.la" }
    },
    {
        href: "https://github.com/layicr/ilive",
        icon: "fab fa-github",
        title: { zh: "Github", en: "Github" }
    },
    {
        href: "http://weibo.com/layicr",
        icon: "fab fa-weibo",
        title: { zh: "微博", en: "Weibo" }
    },
    {
        href: "https://mp.weixin.qq.com/s/S1sq45LC_iQuCLYxzoaRkw",
        icon: "fab fa-weixin",
        title: { zh: "微信", en: "WeChat" }
    },
    {
        href: "https://v.douyin.com/5nAiAZQoUXw/",
        icon: "fab fa-tiktok",
        title: { zh: "抖音", en: "Douyin" }
    },
    {
        href: "https://space.bilibili.com/29825132",
        icon: "fa fa-video-camera",
        title: { zh: "B站", en: "Bilibili" }
    },
    {
        href: "http://twitter.com/layicr",
        icon: "fab fa-twitter",
        title: { zh: "推特", en: "Twitter" }
    },
    {
        href: "http://www.instagram.com/ilayicr",
        icon: "fab fa-instagram",
        title: { zh: "Instagram", en: "Instagram" }
    },
    {
        href: "http://www.facebook.com/layicr",
        icon: "fab fa-facebook",
        title: { zh: "Facebook", en: "Facebook" }
    }
];

// ==================== 动态生成友情链接 ====================
/**
 * 生成友情链接HTML并插入页面
 * @function generateFriendLinks
 * @description 遍历friendLinksData数组，动态创建链接元素
 *              每个链接包含：
 *              - href属性：链接地址
 *              - target="_blank"：新窗口打开
 *              - rel="noopener noreferrer"：安全属性（已在CSS中设置）
 *              - class="social-link"：样式类
 *              - title属性：根据currentLanguage显示对应语言
 *              - Font Awesome图标
 * @returns {void}
 * @performance 使用innerHTML清空容器，使用createElement创建元素（安全）
 */
function generateFriendLinks() {
    const footerSocialContainer = document.querySelector('.footer-social');
    if (!footerSocialContainer) return;

    // 清空容器（避免重复生成）
    footerSocialContainer.innerHTML = '';

    // 生成友情链接
    friendLinksData.forEach(link => {
        // 安全验证URL
        if (typeof isValidUrl === 'function' && !isValidUrl(link.href)) {
            console.warn('友情链接URL不安全，已跳过:', link.href);
            return; // 跳过不安全的链接
        }

        const anchor = document.createElement('a');
        anchor.href = link.href;
        anchor.target = '_blank';
        anchor.className = 'social-link';
        anchor.title = currentLanguage === 'zh' ? link.title.zh : link.title.en;

        const icon = document.createElement('i');
        icon.className = link.icon;
        anchor.appendChild(icon);

        footerSocialContainer.appendChild(anchor);
    });
}

// ==================== 页面加载时生成 ====================
/**
 * 页面加载事件监听
 * @description 在DOMContentLoaded事件触发时生成友情链接
 *              确保DOM元素已加载完成
 */
document.addEventListener('DOMContentLoaded', function() {
    generateFriendLinks();
});

// ==================== 语言切换时更新 ====================
/**
 * 更新友情链接函数（供language.js调用）
 * @function updateFriendLinks
 * @description 语言切换时重新生成友情链接，更新title属性
 *              导出为全局函数，供language.js的updatePageContent调用
 * @returns {void}
 * @example
 * // 在language.js中调用
 * if (typeof window.updateFriendLinks === 'function') {
 *     window.updateFriendLinks();
 * }
 */
window.updateFriendLinks = function() {
    generateFriendLinks();
};