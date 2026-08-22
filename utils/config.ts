/**
 * 全局配置常量 · Global configuration constants
 *
 * @module config
 * @description 从 public/js/config.js 迁移而来（TypeScript 版）。
 *              集中管理所有全局配置参数，供 composables 使用。
 */

export const CONFIG = {
  // ==================== GitHub配置 · GitHub config ====================
  GITHUB_REPO_URL: 'https://github.com/layicr/ilive_V2/',
  GITHUB_ISSUES_URL: 'https://github.com/layicr/ilive_V2/issues/new',

  // ==================== 音乐配置 · Music config ====================
  MUSIC_VOLUME: 0.5,
  MUSIC_AUTOPLAY: true,
  MUSIC_FADE_DURATION: 300,

  // ==================== 图片配置 · Image config ====================
  IMAGE_LOAD_DELAY: 300,
  LAZY_LOAD_THRESHOLD: 200,       // 懒加载提前加载距离（px）· Lazy-load preload distance
  IMAGE_RETRY_MAX: 3,             // 图片加载失败最大重试次数 · Max image retry count
  IMAGE_RETRY_DELAY: 500,         // 图片重试延迟基数（ms）· Base image retry delay

  // ==================== 动画配置 · Animation config ====================
  ANIMATION_DURATION: 300,
  DYNAMIC_TEXT_INTERVAL: 4000,    // 动态文本更新间隔（ms）· Dynamic text update interval
  CAROUSEL_INTERVAL: 4000,        // 专辑轮播间隔（ms）· Album carousel interval
  MODAL_FADE_DURATION: 200,       // 模态框淡入淡出时间（ms）· Modal fade duration
  HIGHLIGHT_ANIMATION_DELAY: 500, // 高亮动画延迟（ms）· Highlight animation delay
  GSAP_ALBUM_DURATION: 1.3,       // GSAP专辑动画时长（s）· GSAP album animation duration
  GSAP_ALBUM_DELAY: 0.5,          // GSAP专辑动画延迟（s）· GSAP album animation delay
  GSAP_PANEL_DELAY: 0.7,          // GSAP详情面板动画延迟（s）· GSAP detail panel animation delay

  // ==================== 专辑轮播配置 · Album carousel config ====================
  ALBUM_CAROUSEL: {
    DESKTOP_RADIUS: 320,
    MOBILE_RADIUS: 220,
    DESKTOP_SELECTED_X: 200,
    MOBILE_SELECTED_X: 100,
    DESKTOP_SELECTED_Y: 90,
    MOBILE_SELECTED_Y: 40,
    DESKTOP_SELECTED_SCALE: 1.4,
    MOBILE_SELECTED_SCALE: 1.3,
    DESKTOP_BASE_SCALE: 0.9,
    MOBILE_BASE_SCALE: 0.85,
    SCALE_DECREMENT_DESKTOP: 0.05,
    SCALE_DECREMENT_MOBILE: 0.06,
    MIN_SCALE: 0.6
  },

  // ==================== 手势配置 · Gesture config ====================
  SWIPE_MIN_DISTANCE: 50,
  SWIPE_MAX_TIME: 1000,
  SWIPE_OPACITY_MIN: 0.5,

  // ==================== UI配置 · UI config ====================
  SCROLL_THRESHOLD: 300,
  TOAST_DURATION: 3000,
  INTERSECTION_THRESHOLD: 0.1,

  // ==================== 性能配置 · Performance config ====================
  PERFORMANCE_MONITOR: process.env.NODE_ENV !== 'production', // 仅开发环境打印错误日志详情 · Log error details in dev only
  DEBOUNCE_RESIZE_DELAY: 250,

  // ==================== 设备检测 · Device detection ====================
  MOBILE_BREAKPOINT: 768
} as const;

/** 便捷访问别名 · Convenience alias */
export const GITHUB_REPO_URL = CONFIG.GITHUB_REPO_URL;
