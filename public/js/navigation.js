/**
 * 导航和切换功能模块
 *
 * @module navigation
 * @description 处理返回顶部、城市模态框、视频模态框、反馈按钮等导航功能
 * @requires config.js（CONFIG配置：滚动阈值、GitHub URL）
 * @requires language.js（currentLanguage、currentData变量）
 *
 * 主要功能：
 * - 返回顶部：使用 IntersectionObserver 检测页面顶部，高效显示/隐藏按钮
 * - 城市模态框：显示演唱会举办城市列表
 * - 视频模态框：嵌入式播放演唱会视频（Bilibili iframe）
 * - 视频跳转：外部链接打开视频页面
 * - 反馈按钮：跳转GitHub Issues页面
 *
 * DOM元素：
 * - backToTopBtn：返回顶部按钮
 * - cityModal：城市模态框容器
 * - cityList：城市列表容器
 * - videoModal：视频模态框容器
 * - videoPlayer：视频播放器（iframe）
 * - feedbackBtn：反馈按钮
 *
 * @performance 使用 IntersectionObserver 替代 scroll 事件监听，减少主线程阻塞
 */

// ==================== DOM 元素引用 ====================
const backToTopBtn = document.getElementById('backToTop');
const cityModal = document.getElementById('cityModal');
const cityModalTitle = document.getElementById('city-modal-title');
const cityList = document.getElementById('cityList');
const closeCityModal = document.getElementById('closeCityModal');
const cityCard = document.getElementById('city-card');
const videoModal = document.getElementById('videoModal');
const videoPlayer = document.getElementById('videoPlayer');
const videoModalTitle = document.getElementById('videoModalTitle');
const closeVideoModal = document.getElementById('closeVideoModal');
const feedbackBtn = document.getElementById('feedbackBtn');

// ==================== 返回顶部功能 ====================
/**
 * 创建顶部哨兵元素用于 IntersectionObserver 检测
 * @description 在页面顶部放置一个不可见的哨兵元素，当哨兵离开视口时显示返回顶部按钮
 * @performance 比 scroll 事件更高效，不会阻塞主线程
 */
const topSentinel = document.createElement('div');
topSentinel.id = 'top-sentinel';
topSentinel.style.cssText = 'position: absolute; top: 0; height: 1px; width: 100%; pointer-events: none; visibility: hidden;';
document.body.prepend(topSentinel);

/**
 * IntersectionObserver 回调：控制返回顶部按钮显示
 * @param {IntersectionObserverEntry[]} entries - 观察条目数组
 */
function handleTopSentinelIntersection(entries) {
    const [entry] = entries;
    // 哨兵离开视口 = 页面已向下滚动 = 显示返回顶部按钮
    if (!entry.isIntersecting) {
        backToTopBtn.classList.add('visible');
    } else {
        backToTopBtn.classList.remove('visible');
    }
}

/**
 * 创建 IntersectionObserver 监听顶部哨兵
 * @description rootMargin 定义触发区域，负值表示哨兵必须完全离开视口才触发
 */
const topObserver = new IntersectionObserver(handleTopSentinelIntersection, {
    root: null,           // 使用视口作为根
    rootMargin: `-${CONFIG.SCROLL_THRESHOLD}px 0px 0px 0px`, // 滚动超过阈值时触发
    threshold: 0          // 任何可见性变化都触发
});

// 开始观察哨兵元素
topObserver.observe(topSentinel);

backToTopBtn.addEventListener('click', function() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// 城市模态框控制
function openCityModal() {
    cityModal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeCityModalFunc() {
    cityModal.classList.remove('show');
    document.body.style.overflow = '';
}

cityCard.addEventListener('click', openCityModal);
closeCityModal.addEventListener('click', closeCityModalFunc);
cityModal.addEventListener('click', e => e.target === cityModal && closeCityModalFunc());

// 视频模态框控制
function openVideoModal(videoId, title) {
    if (!videoId) return;

    const embedUrl = `https://player.bilibili.com/player.html?bvid=${videoId}&autoplay=1`;

    // 安全验证URL
    if (typeof isValidUrl === 'function' && !isValidUrl(embedUrl)) {
        console.error('视频URL不安全，已阻止加载:', embedUrl);
        if (typeof showToast === 'function') {
            showToast('视频加载失败', 'error');
        }
        return;
    }

    videoPlayer.src = embedUrl;
    videoModalTitle.textContent = title;
    videoModal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeVideoModalFunc() {
    videoModal.classList.remove('show');
    videoPlayer.src = '';
    document.body.style.overflow = '';
}

closeVideoModal.addEventListener('click', closeVideoModalFunc);
videoModal.addEventListener('click', e => {
    if (e.target === videoModal || e.target.classList.contains('video-modal-content')) {
        closeVideoModalFunc();
    }
});

// 反馈按钮功能
function getFeedbackUrl() {
    const title = currentData.feedback.urlTitle;
    const body = currentData.feedback.urlBody;
    return `${CONFIG.GITHUB_ISSUES_URL}?title=${encodeURIComponent(title)}&body=${body}`;
}

feedbackBtn.addEventListener('click', () => {
    window.open(getFeedbackUrl(), '_blank');
});

// ==================== 触摸手势管理器 ====================
/**
 * 触摸手势管理器
 * @description 处理移动端滑动手势，支持左右切换
 * @class
 */
class TouchGestureManager {
    /**
     * 创建手势管理器实例
     * @param {HTMLElement} container - 监听手势的容器元素
     * @param {Object} callbacks - 回调函数对象 { onSwipeLeft, onSwipeRight }
     */
    constructor(container, callbacks) {
        this.container = container;
        this.callbacks = callbacks;
        this.startX = 0;
        this.startY = 0;
        this.startTime = 0;
        this.isSwiping = false;

        this.bindEvents();
    }

    /**
     * 绑定触摸事件
     * @private
     */
    bindEvents() {
        this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        this.container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.container.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
    }

    /**
     * 处理触摸开始事件
     * @private
     * @param {TouchEvent} e - 触摸事件对象
     */
    handleTouchStart(e) {
        if (e.touches.length === 1) {
            this.startX = e.touches[0].clientX;
            this.startY = e.touches[0].clientY;
            this.startTime = Date.now();
            this.isSwiping = false;
        }
    }

    /**
     * 处理触摸移动事件
     * @private
     * @param {TouchEvent} e - 触摸事件对象
     */
    handleTouchMove(e) {
        if (e.touches.length === 1) {
            const deltaX = e.touches[0].clientX - this.startX;
            const deltaY = e.touches[0].clientY - this.startY;

            // 判断是横向滑动（横向距离大于纵向距离）
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
                this.isSwiping = true;
                e.preventDefault(); // 阻止纵向滚动

                // 实时视觉反馈
                const opacity = Math.max(CONFIG.SWIPE_OPACITY_MIN, 1 - Math.abs(deltaX) / 200);
                this.container.style.opacity = opacity;
            }
        }
    }

    /**
     * 处理触摸结束事件
     * @private
     * @param {TouchEvent} e - 触摸事件对象
     */
    handleTouchEnd(e) {
        if (this.isSwiping) {
            const endX = e.changedTouches[0].clientX;
            const deltaX = endX - this.startX;
            const deltaTime = Date.now() - this.startTime;

            // 恢复透明度
            this.container.style.opacity = '1';

            // 判断是否触发切换
            if (Math.abs(deltaX) >= CONFIG.SWIPE_MIN_DISTANCE && 
                deltaTime <= CONFIG.SWIPE_MAX_TIME) {
                
                if (deltaX > 0 && this.callbacks.onSwipeRight) {
                    this.callbacks.onSwipeRight();
                } else if (deltaX < 0 && this.callbacks.onSwipeLeft) {
                    this.callbacks.onSwipeLeft();
                }
            }
        }
        this.isSwiping = false;
    }

    /**
     * 销毁手势管理器（移除事件监听）
     */
    destroy() {
        this.container.removeEventListener('touchstart', this.handleTouchStart);
        this.container.removeEventListener('touchmove', this.handleTouchMove);
        this.container.removeEventListener('touchend', this.handleTouchEnd);
    }
}

// ==================== 初始化手势管理 ====================
// 演唱会详情面板手势管理器实例
let detailGestureManager = null;

/**
 * 初始化演唱会详情面板手势
 * @description 仅在移动端初始化（屏幕宽度 <= 768px）
 * @param {Function} navigateCallback - 切换演唱会的回调函数
 */
function initDetailGesture(navigateCallback) {
    const detailPanel = document.querySelector('.detail-panel');
    if (detailPanel && window.innerWidth <= CONFIG.MOBILE_BREAKPOINT) {
        // 销毁旧实例（如果存在）
        if (detailGestureManager) {
            detailGestureManager.destroy();
        }
        
        // 创建新实例
        detailGestureManager = new TouchGestureManager(detailPanel, {
            onSwipeLeft: () => navigateCallback('next'),
            onSwipeRight: () => navigateCallback('prev')
        });
    }
}

// 歌单模态框手势管理器实例
let songlistGestureManager = null;

/**
 * 初始化歌单模态框手势
 * @description 仅在移动端初始化（屏幕宽度 <= 768px）
 * @param {Function} navigateCallback - 切换歌单的回调函数
 */
function initSonglistGesture(navigateCallback) {
    const songlistContent = document.querySelector('.songlist-modal-content');
    if (songlistContent && window.innerWidth <= CONFIG.MOBILE_BREAKPOINT) {
        // 销毁旧实例（如果存在）
        if (songlistGestureManager) {
            songlistGestureManager.destroy();
        }
        
        // 创建新实例
        songlistGestureManager = new TouchGestureManager(songlistContent, {
            onSwipeLeft: () => navigateCallback('next'),
            onSwipeRight: () => navigateCallback('prev')
        });
    }
}

// 窗口大小变化时重新初始化（防抖处理）
window.addEventListener('resize', debounce(() => {
    // 重新初始化手势（需在其他模块中调用）
    console.log('窗口大小变化，建议重新初始化手势管理器');
}, CONFIG.DEBOUNCE_RESIZE_DELAY));

// ==================== 导出供其他模块使用 ====================
window.TouchGestureManager = TouchGestureManager;
window.initDetailGesture = initDetailGesture;
window.initSonglistGesture = initSonglistGesture;

// ==================== 统一键盘事件管理 ====================
/**
 * ESC键统一处理器（优先级：低）
 * @description 处理所有模态框的ESC关闭逻辑
 */
function handleESCKey(e) {
    // 按照模态框打开顺序关闭（后打开的先关闭）
    // 图片模态框
    if (document.getElementById('imageModal').classList.contains('show')) {
        closeImageModal();
        return true;
    }
    // 票根模态框
    if (document.getElementById('ticketModal').classList.contains('active')) {
        closeTicketModal();
        return true;
    }
    // 歌单模态框
    if (document.getElementById('songlistModal').classList.contains('show')) {
        closeSonglistModalFunc();
        return true;
    }
    // 视频模态框
    if (document.getElementById('videoModal').classList.contains('show')) {
        closeVideoModalFunc();
        return true;
    }
    // 城市模态框
    if (document.getElementById('cityModal').classList.contains('show')) {
        closeCityModalFunc();
        return true;
    }

    return false;
}

// 注册全局ESC处理器（低优先级，作为默认处理器）
if (window.KeyboardManager) {
    window.KeyboardManager.register('Escape', handleESCKey, 1);
}