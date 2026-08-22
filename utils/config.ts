/**
 * 全局配置常量 · Global configuration constants
 *
 * @module config
 * @description 从 public/js/config.js 迁移而来（TypeScript 版）。
 *              集中管理所有全局配置参数，供 composables 使用。
 */

export const CONFIG = {
  // ==================== GitHub配置 · GitHub config ====================
  GITHUB_REPO_URL: 'https://github.com/layicr/ilive_neo/',   // 仓库地址 · repo URL
  GITHUB_ISSUES_URL: 'https://github.com/layicr/ilive_neo/issues/new', // 反馈问题跳转地址 · new issue URL

  // ==================== 音乐配置 · Music config ====================
  MUSIC_VOLUME: 0.5,              // 背景音乐音量（0~1）· BGM volume
  MUSIC_AUTOPLAY: true,           // 是否尝试自动播放 · whether to try autoplay
  MUSIC_FADE_DURATION: 300,       // 音乐淡入淡出时长（ms）· fade duration

  // ==================== 图片配置 · Image config ====================
  IMAGE_LOAD_DELAY: 300,          // 图片加载启动延迟（ms）· initial image load delay
  LAZY_LOAD_THRESHOLD: 200,       // 懒加载提前加载距离（px）· Lazy-load preload distance
  IMAGE_RETRY_MAX: 3,             // 图片加载失败最大重试次数 · Max image retry count
  IMAGE_RETRY_DELAY: 500,         // 图片重试延迟基数（ms）· Base image retry delay

  // ==================== 动画配置 · Animation config ====================
  ANIMATION_DURATION: 300,        // 通用动画时长（ms）· generic animation duration
  DYNAMIC_TEXT_INTERVAL: 4000,    // 动态文本更新间隔（ms）· Dynamic text update interval
  CAROUSEL_INTERVAL: 4000,        // 专辑轮播间隔（ms）· Album carousel interval
  MODAL_FADE_DURATION: 200,       // 模态框淡入淡出时间（ms）· Modal fade duration
  HIGHLIGHT_ANIMATION_DELAY: 500, // 高亮动画延迟（ms）· Highlight animation delay
  GSAP_ALBUM_DURATION: 1.3,       // GSAP专辑动画时长（s）· GSAP album animation duration
  GSAP_ALBUM_DELAY: 0.5,          // GSAP专辑动画延迟（s）· GSAP album animation delay
  GSAP_PANEL_DELAY: 0.7,          // GSAP详情面板动画延迟（s）· GSAP detail panel animation delay

  // ==================== 专辑轮播配置 · Album carousel config ====================
  ALBUM_CAROUSEL: {
    DESKTOP_RADIUS: 320,          // 桌面端轮播半径（px）· desktop carousel radius
    MOBILE_RADIUS: 220,           // 移动端轮播半径（px）· mobile carousel radius
    DESKTOP_SELECTED_X: 200,      // 桌面端选中专辑水平偏移（px）· desktop selected X
    MOBILE_SELECTED_X: 100,       // 移动端选中专辑水平偏移（px）· mobile selected X
    DESKTOP_SELECTED_Y: 90,       // 桌面端选中专辑垂直偏移（px）· desktop selected Y
    MOBILE_SELECTED_Y: 40,        // 移动端选中专辑垂直偏移（px）· mobile selected Y
    DESKTOP_SELECTED_SCALE: 1.4,  // 桌面端选中专辑缩放 · desktop selected scale
    MOBILE_SELECTED_SCALE: 1.3,   // 移动端选中专辑缩放 · mobile selected scale
    DESKTOP_BASE_SCALE: 0.9,      // 桌面端基础缩放（两侧专辑）· desktop base scale
    MOBILE_BASE_SCALE: 0.85,      // 移动端基础缩放 · mobile base scale
    SCALE_DECREMENT_DESKTOP: 0.05,// 桌面端逐层缩放递减量 · desktop scale decrement
    SCALE_DECREMENT_MOBILE: 0.06, // 移动端逐层缩放递减量 · mobile scale decrement
    MIN_SCALE: 0.6                // 最小缩放（最深层专辑）· minimum scale
  },

  // ==================== 手势配置 · Gesture config ====================
  SWIPE_MIN_DISTANCE: 50,         // 判定为滑动手势的最小距离（px）· min swipe distance
  SWIPE_MAX_TIME: 1000,           // 手势最大持续时间（ms）· max swipe time
  SWIPE_OPACITY_MIN: 0.5,         // 手势跟随最小透明度 · min opacity during swipe

  // ==================== UI配置 · UI config ====================
  SCROLL_THRESHOLD: 300,          // 滚动多少距离后显示"返回顶部"（px）· scroll threshold for back-to-top
  TOAST_DURATION: 3000,           // Toast 展示时长（ms）· toast display duration
  INTERSECTION_THRESHOLD: 0.1,    // 交叉观察器阈值（0~1）· IntersectionObserver threshold

  // ==================== 性能配置 · Performance config ====================
  PERFORMANCE_MONITOR: process.env.NODE_ENV !== 'production', // 仅开发环境打印错误日志详情 · Log error details in dev only
  DEBOUNCE_RESIZE_DELAY: 250,     // 窗口 resize 防抖延迟（ms）· resize debounce delay

  // ==================== 设备检测 · Device detection ====================
  MOBILE_BREAKPOINT: 768          // 移动端断点宽度（px）· mobile breakpoint width
} as const;

/** 便捷访问别名 · Convenience alias */
export const GITHUB_REPO_URL = CONFIG.GITHUB_REPO_URL;
