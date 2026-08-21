/**
 * 统计分析模块
 *
 * @module statis
 * @description 集成多个第三方统计分析服务，用于用户行为跟踪和数据统计
 * @requires 无依赖（独立加载）
 *
 * 主要功能：
 * - 百度统计：中国用户访问统计
 * - Google Analytics：国际用户访问统计
 * - 51.la：网站流量分析
 *
 * 加载策略：
 * - 百度统计：同步加载，优先级高
 * - Google Analytics：异步加载，避免阻塞页面渲染
 * - 51.la：异步加载，压缩代码
 *
 * 注意事项：
 * - var _hmt 必须保留var声明（百度统计标准写法）
 * - 所有统计代码均为第三方服务，不建议修改核心逻辑
 */

// ==================== 百度统计 ====================
/**
 * 百度统计初始化
 * @description 创建百度统计脚本并插入页面
 *              使用var声明全局变量_hmt，确保统计代码正确执行
 * @see https://tongji.baidu.com/
 */
var _hmt = _hmt || [];
(function () {
    const hm = document.createElement("script");
    hm.src = "https://hm.baidu.com/hm.js?314959f767a1bf837f2a6bc8ba6f5e2d";
    const s = document.getElementsByTagName("script")[0];
    s.parentNode.insertBefore(hm, s);
})();

// ==================== Google Analytics ====================
/**
 * Google Analytics初始化
 * @description 动态加载Google Analytics脚本并配置追踪
 *              使用异步加载避免阻塞页面渲染
 * @see https://analytics.google.com/
 */
(function() {
    // 1. 动态创建并加载 Google 的 gtag.js 主库
    const firstScript = document.createElement('script');
    firstScript.async = true;
    firstScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-Y7B6DLCXSE';

    // 2. 在主库加载成功后，执行配置代码
    firstScript.onload = function() {
        // 初始化 dataLayer 和 gtag 函数
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        // 进行基础配置
        gtag('config', 'G-Y7B6DLCXSE');
    };

    // 可选：添加错误处理
    firstScript.onerror = function() {
        console.error('无法加载 Google Analytics gtag.js 主库。');
    };

    // 3. 将脚本标签插入文档，开始加载
    document.head.appendChild(firstScript);
})();

// ==================== 51.la网站统计 ====================
/**
 * 51.la网站统计初始化
 * @description 第三方压缩统计代码，用于网站流量分析
 *              注意：此代码为压缩版本，不建议手动修改
 * @see https://www.51.la/
 */
!function (p) { "use strict"; !function (t) { var s = window, e = document, i = p, c = "".concat("https:" === e.location.protocol ? "https://" : "http://", "sdk.51.la/js-sdk-pro.min.js"), n = e.createElement("script"), r = e.getElementsByTagName("script")[0]; n.type = "text/javascript", n.setAttribute("charset", "UTF-8"), n.async = !0, n.src = c, n.id = "LA_COLLECT", i.d = n; var o = function () { s.LA.ids.push(i) }; s.LA ? s.LA.ids && o() : (s.LA = p, s.LA.ids = [], o()), r.parentNode.insertBefore(n, r) }() }({ id: "L8VlyZ1HkDS0E3VO", ck: "L8VlyZ1HkDS0E3VO" });