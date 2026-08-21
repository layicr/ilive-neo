/**
 * 遗留脚本客户端加载插件 · Legacy scripts client plugin
 *
 * @module legacy.client
 * @description 在浏览器端按依赖顺序注入迁移源中的经典（非模块）脚本，并启动原初始化逻辑。
 *              这样可完整复用原有 DOM 操作、事件监听与全局数据对象，保证视觉效果 100% 一致。
 *
 *              经典脚本通过「全局词法作用域」共享顶层 `let`/`const`/`function`，
 *              （如 `concertDataZH`、`currentLanguage`、`initPage` 等），因此必须以
 *              `type=module` 之外的方式按顺序 <script> 注入，且不能被打包 tree-shaking。
 *
 *              加载顺序（演唱会/城市/许愿数据由 api-loader 从数据库 API 加载，不再注入静态数据文件）：
 *              lib(4) → music → datas_zh → datas_en → api-loader → feature(4) → language → main → statis
 *
 *              Injection order (concert/city/wish data loaded by api-loader from the DB API;
 *              the static data files are no longer injected):
 *              libs → music → datas_zh → datas_en → api-loader → features → language → main → statis.
 */
export default defineNuxtPlugin(() => {
  // 公共资源根路径（须用 Nuxt 的 app.baseURL，而非 Vite 的 BASE_URL）
  // public asset base: MUST use Nuxt app.baseURL (Vite BASE_URL yields /_nuxt/ in dev)
  const config = useRuntimeConfig();
  const base = (config.app?.baseURL || '/').replace(/\/?$/, '/');

  /** 需要逐一注入的脚本路径（按依赖顺序）· scripts to inject, in dependency order */
  const scripts: string[] = [
    // 1. 基础库 · core libs
    'js/config.js',
    'js/utils.js',
    'js/error.js',
    'js/keyboardManager.js',
    'js/music.js',
    // 2. 中英文数据（仅含静态 UI 文案，演唱会/城市/许愿数据由 api-loader 从数据库 API 填充）
    //    bilingual data (static UI texts only; concert/city/wish data filled by api-loader from DB API)
    'db/datas_zh.js',
    'db/datas_en.js',
    // 2.5 API 数据加载器（从数据库 API 加载演唱会/城市/许愿数据，不做静态降级）
    //    API loader (loads concert/city/wish data from the DB API, no static fallback)
    'js/api-loader.js',
    // 3. 功能模块 · feature modules
    'js/gallery.js',
    'js/songlist.js',
    'js/navigation.js',
    'js/friendLink.js',
    'js/language.js',
    // 4. 主逻辑 · main (must come after all data & feature globals exist)
    'js/main.js',
    // 5. 统计 · analytics (independent)
    'js/statis.js'
  ];

  /**
   * 注入单个经典脚本并等待其加载· Inject one classic script and await its load
   * @param {string} src 脚本相对 URL · script relative url
   * @returns {Promise<void>}
   */
  function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = base + src;
      // 经典脚本（非模块）以共享全局作用域，绝不能用 type=module
      // classic script (non-module) to share the global lexical scope
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`[legacy] 加载失败 · load failed: ${src}`));
      document.body.appendChild(el);
    });
  }

  // 按顺序依次加载（依赖脚本必须在被依赖者之前执行）
  // load sequentially so dependencies are always present first
  const boot = async () => {
    try {
      for (const src of scripts) {
        await loadScript(src);
      }

      // 尝试从 /api 拉取数据覆盖静态对象；失败时自动降级到静态数据（不阻塞启动）。
      // Try to load data from /api to override the static objects; falls back on failure.
      const ensureApi = (window as any).ensureApiData;
      if (typeof ensureApi === 'function') {
        await ensureApi();
      }

      // 原 main.js 在 DOMContentLoaded 时调用 initPage；
      // 但 Nuxt 客户端插件运行时机已晚于 DOMContentLoaded，故显式调用一次启动。
      // Original main.js inits on DOMContentLoaded; in Nuxt it has already fired,
      // so call initPage() explicitly after all scripts are loaded.
      const init = (window as any).initPage;
      if (typeof init === 'function') {
        init();
      }
    } catch (err) {
      // 任一脚本加载失败时打印，但不阻塞页面渲染（保持骨架可见）
      // log any load failure without blocking page render
      console.error('[legacy] 初始化失败 · init failed:', err);
    }
  };

  // 延迟到当前帧后执行，确保 Vue 已完成首屏渲染挂载
  // defer to a tick so Vue finishes hydrating the initial DOM
  setTimeout(boot, 0);
});