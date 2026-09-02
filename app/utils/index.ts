/**
 * 工具函数模块 · Utility functions
 *
 * @module utils
 * @description 从 public/js/utils.js 迁移而来的纯函数（TypeScript 版，无全局变量依赖，SSR 两端一致）。
 *              仅保留当前被项目引用的导出：safeHtml / formatWishTime。
 *              Hand-picked utilities from the original static utils.js.
 */

// ==================== HTML 安全 ====================

/** 安全HTML处理（允许特定安全标签，过滤所有属性）· Safe HTML */
/**
 * @description 纯正则实现，服务端/客户端输出完全一致（SSR 无 DOMParser，且避免 hydration 不一致）。
 *              仅允许白名单标签；属性一律丢弃，唯一例外是 <span> 的 style（过滤 javascript:）。
 *              非字符串输入原样返回（防御性：v-html 绑定值可能来自不可控的 DB 字段）。
 *              Non-string input is returned as-is (defensive: the DB field may be null/unexpected).
 */
export function safeHtml(html: string): string;
export function safeHtml(html: unknown): unknown;
export function safeHtml(html: unknown): unknown {
  if (typeof html !== 'string') return html;

  const allowedTags = new Set(['br', 'b', 'i', 'strong', 'em', 'span', 'p']);

  // 移除注释与危险块（script/style/iframe/object/embed/form）及其内容
  let sanitized = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // 逐标签处理：白名单保留，非白名单丢弃标签本身仅保留内容
  sanitized = sanitized.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g,
    (match, rawTag: string, attrs: string) => {
      const tag = rawTag.toLowerCase();

      // 关闭标签：仅白名单内允许
      if (match.startsWith('</')) {
        return allowedTags.has(tag) ? `</${tag}>` : '';
      }

      if (!allowedTags.has(tag)) {
        // 非白名单标签：丢弃标签本身（含属性），仅保留内容
        return '';
      }

      // 仅 <span> 允许保留 style（过滤 javascript:），其余属性全部丢弃
      let attrStr = '';
      if (tag === 'span') {
        const styleMatch = attrs.match(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
        const styleValue = styleMatch ? (styleMatch[1] ?? styleMatch[2] ?? '') : '';
        if (styleValue && !/javascript:/i.test(styleValue)) {
          attrStr = ` style="${styleValue.replace(/"/g, '&quot;')}"`;
        }
      }

      // 统一输出不带斜杠形式，避免浏览器按开始标签误解析
      return `<${tag}${attrStr}>`;
    }
  );

  return sanitized;
}

// ==================== 时间格式化 ====================

/**
 * 格式化许愿时间为固定绝对日期 · Format wish time as a stable absolute date
 * @description 用于 SSR 首屏与水合阶段：输出 `YYYY.MM.DD`，不依赖 `Date.now()`，
 *              也不使用 `toLocaleDateString`（Node 与浏览器的 ICU 输出可能不同），
 *              从而保证服务端与客户端渲染结果完全一致，避免 hydration mismatch。
 *              水合完成后再由 `formatWishTime` 切换为相对时间（如「3 天前」）。
 *
 *              Stable absolute date for SSR + hydration; switches to relative time after mount.
 * @returns `YYYY.MM.DD`；无法解析时返回空串 · empty string when unparsable
 */
export function formatWishDate(timeString: string): string {
  const date = new Date(timeString)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`
}

/** 格式化许愿时间 · Format wish time */
export function formatWishTime(timeString: string, lang: 'zh' | 'en' = 'zh'): string {
  const date = new Date(timeString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const fallback = {
    zh: { justNow: '刚刚', minutesAgo: '分钟前', hoursAgo: '小时前', daysAgo: '天前' },
    en: { justNow: 'Just now', minutesAgo: ' min ago', hoursAgo: ' hours ago', daysAgo: ' days ago' }
  } as const;

  const texts = fallback[lang];

  if (diff < 60000) return texts.justNow;
  if (diff < 3600000) return Math.floor(diff / 60000) + texts.minutesAgo;
  if (diff < 86400000) return Math.floor(diff / 3600000) + texts.hoursAgo;
  if (diff < 604800000) return Math.floor(diff / 86400000) + texts.daysAgo;

  return date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US');
}