/**
 * 配置常量模块
 *
 * @module config
 * @description 集中管理所有全局配置参数，便于维护和调整
 * @requires 无依赖（最先加载）
 *
 * 配置分类：
 * - GitHub配置：仓库URL、Issues URL
 * - 音乐配置：音量、自动播放、淡入淡出时长
 * - 图片配置：加载延迟、懒加载阈值、重试策略
 * - 动画配置：动画时长、轮播间隔、GSAP参数
 * - 手势配置：滑动距离、时间、透明度阈值
 * - 缓存配置：Service Worker缓存版本和策略
 * - UI配置：滚动阈值、Toast时长、骨架屏等待时间
 * - 性能配置：监控开关、防抖延迟
 * - 设备检测：移动端断点
 *
 * 使用方式：
 * - 直接访问 CONFIG 对象：CONFIG.MUSIC_VOLUME
 * - 使用便捷别名：GITHUB_REPO_URL
 */

const CONFIG = {
    // ==================== GitHub配置 ====================
    GITHUB_REPO_URL: 'https://github.com/layicr/ilive_V2/',
    GITHUB_ISSUES_URL: 'https://github.com/layicr/ilive_V2/issues/new',

    // ==================== 音乐配置 ====================
    MUSIC_VOLUME: 0.5,
    MUSIC_AUTOPLAY: true,
    MUSIC_FADE_DURATION: 300,

    // ==================== 图片配置 ====================
    IMAGE_LOAD_DELAY: 300,
    LAZY_LOAD_THRESHOLD: 200,       // 懒加载提前加载距离（px）
    IMAGE_RETRY_MAX: 3,             // 图片加载失败最大重试次数
    IMAGE_RETRY_DELAY: 500,         // 图片重试延迟基数（ms）

    // ==================== 动画配置 ====================
    ANIMATION_DURATION: 300,
    DYNAMIC_TEXT_INTERVAL: 4000,    // 动态文本更新间隔（ms）
    CAROUSEL_INTERVAL: 4000,        // 专辑轮播间隔（ms）
    MODAL_FADE_DURATION: 200,       // 模态框淡入淡出时间（ms）
    HIGHLIGHT_ANIMATION_DELAY: 500, // 高亮动画延迟（ms）
    GSAP_ALBUM_DURATION: 1.3,       // GSAP专辑动画时长（s）
    GSAP_ALBUM_DELAY: 0.5,          // GSAP专辑动画延迟（s）
    GSAP_PANEL_DELAY: 0.7,          // GSAP详情面板动画延迟（s）

    // ==================== 专辑轮播配置 ====================
    ALBUM_CAROUSEL: {
        DESKTOP_RADIUS: 320,            // 桌面端轮播半径（px）
        MOBILE_RADIUS: 220,             // 移动端轮播半径（px）
        DESKTOP_SELECTED_X: 200,        // 桌面端选中卡片X偏移（px）
        MOBILE_SELECTED_X: 100,         // 移动端选中卡片X偏移（px）
        DESKTOP_SELECTED_Y: 90,         // 桌面端选中卡片Y偏移（px）
        MOBILE_SELECTED_Y: 40,          // 移动端选中卡片Y偏移（px）
        DESKTOP_SELECTED_SCALE: 1.4,    // 桌面端选中卡片缩放比例
        MOBILE_SELECTED_SCALE: 1.3,     // 移动端选中卡片缩放比例
        DESKTOP_BASE_SCALE: 0.9,        // 桌面端未选中卡片基础缩放
        MOBILE_BASE_SCALE: 0.85,        // 移动端未选中卡片基础缩放
        SCALE_DECREMENT_DESKTOP: 0.05,  // 桌面端缩放递减值
        SCALE_DECREMENT_MOBILE: 0.06,   // 移动端缩放递减值
        MIN_SCALE: 0.6                  // 最小缩放值
    },

    // ==================== 手势配置 ====================
    SWIPE_MIN_DISTANCE: 50,         // 最小滑动距离（px）
    SWIPE_MAX_TIME: 1000,           // 最大滑动时间（ms）
    SWIPE_OPACITY_MIN: 0.5,         // 滑动时最小透明度

    // ==================== UI配置 ====================
    SCROLL_THRESHOLD: 300,          // 返回顶部按钮显示阈值（px）
    TOAST_DURATION: 3000,           // Toast提示显示时长（ms）
    SKELETON_MIN_WAIT: 3000,        // 骨架屏最小等待时间（ms）
    TIMELINE_RENDER_DELAY: 800,     // 时间轴渲染延迟（ms）
    INTERSECTION_THRESHOLD: 0.1,    // IntersectionObserver触发阈值

    // ==================== 性能配置 ====================
    PERFORMANCE_MONITOR: true,      // 是否开启性能监控
    DEBOUNCE_RESIZE_DELAY: 250,     // 窗口resize防抖延迟（ms）

    // ==================== 设备检测 ====================
    MOBILE_BREAKPOINT: 768,         // 移动端断点（px）
};

// 便捷访问别名
const GITHUB_REPO_URL = CONFIG.GITHUB_REPO_URL;