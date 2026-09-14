/**
 * 工具函数模块 · Utility functions
 *
 * @module utils
 * @description 从 public/js/utils.js 迁移而来的纯函数（TypeScript 版，无全局变量依赖，SSR 两端一致）。
 *              包含：safeHtml / formatWishDate / formatWishTime / 多语言取词与本地化（pickLocale / localize*）。
 *              纯函数、无服务端依赖，客户端与服务端（API）均可安全引用。
 */

import type {
  Concert,
  City,
  Wish,
  LocalizedConcert,
  LocalizedCity,
  LocalizedWish,
  Locale,
  LocalizedText,
  LocalizedTags
} from '../types'
import { DEFAULT_LOCALE, LOCALES as CONFIG_LOCALES, LOCALE_DATE } from '../../server/lib/locales'

// ==================== HTML 安全 · HTML safety ====================

/**
 * 安全 HTML 处理（白名单标签、丢弃全部属性）· Safe HTML sanitizer
 * @description 纯正则实现，服务端/客户端输出完全一致（SSR 无 DOMParser，且避免 hydration 不一致）。
 *              仅允许白名单标签；属性一律丢弃，唯一例外是 <span> 的 style（过滤 javascript:）。
 *              非字符串输入原样返回（防御性：v-html 绑定值可能来自不可控的 DB 字段）。
 *              Pure-regex, byte-identical on server/client (no DOMParser in SSR; avoids hydration mismatch).
 *              Whitelisted tags only; all attributes dropped except <span style> (javascript: filtered).
 *              Non-string input is returned as-is (defensive: the v-html value may come from an untrusted DB field).
 */
export function safeHtml(html: string): string;
export function safeHtml(html: unknown): unknown;
export function safeHtml(html: unknown): unknown {
  if (typeof html !== 'string') return html;

  const allowedTags = new Set(['br', 'b', 'i', 'strong', 'em', 'span', 'p']);

  // 移除注释与危险块（script/style/iframe/object/embed/form）及其内容
  // strip comments and dangerous blocks (script/style/iframe/object/embed/form) together with their content
  let sanitized = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // 逐标签处理：白名单保留，非白名单丢弃标签本身仅保留内容
  // per-tag: keep whitelisted tags; drop non-whitelisted tags but keep their inner content
  sanitized = sanitized.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g,
    (match, rawTag: string, attrs: string) => {
      const tag = rawTag.toLowerCase();

      // 关闭标签：仅白名单内允许 · closing tag: allowed only if whitelisted
      if (match.startsWith('</')) {
        return allowedTags.has(tag) ? `</${tag}>` : '';
      }

      if (!allowedTags.has(tag)) {
        // 非白名单标签：丢弃标签本身（含属性），仅保留内容 · non-whitelisted tag: drop it (and attrs), keep content
        return '';
      }

      // 仅 <span> 允许保留 style；命中 javascript: / expression() / behavior: / url(javascript:) 一律剥除。
      // 关键：先对 style 做「数字实体解码」再检测，避免 `&#x6a;avascript:` 之类混淆绕过（历史缺口）。
      // only <span> may keep style; javascript: / expression() / behavior: / url(javascript:) are rejected.
      // Numeric entities are decoded before matching so obfuscated payloads are still caught.
      let attrStr = '';
      if (tag === 'span') {
        const styleMatch = attrs.match(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
        const styleValue = styleMatch ? (styleMatch[1] ?? styleMatch[2] ?? '') : '';
        const decoded = styleValue
          .replace(/&#x([0-9a-f]{1,6});?/gi, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
          .replace(/&#(\d{1,7});?/g, (_m, dec: string) => String.fromCharCode(Number(dec)))
          .toLowerCase();
        const unsafeStyle =
          /javascript:/.test(decoded) ||
          /expression\s*\(/.test(decoded) ||
          /behavior\s*:/.test(decoded) ||
          /url\s*\(\s*['"]?\s*javascript:/.test(decoded);
        if (styleValue && !unsafeStyle) {
          attrStr = ` style="${styleValue.replace(/"/g, '&quot;')}"`;
        }
      }

      // 统一输出不带斜杠形式，避免浏览器按开始标签误解析
      // always emit without a self-closing slash to avoid start-tag mis-parsing
      return `<${tag}${attrStr}>`;
    }
  );

  return sanitized;
}

// ==================== 时间格式化 · Time formatting ====================

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

/** 格式化许愿时间 · Format wish time（相对时间，水合后使用） */
export function formatWishTime(timeString: string, lang: Locale = 'zh-CN'): string {
  const date = new Date(timeString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const fallback = {
    'zh-CN': { justNow: '刚刚', minutesAgo: '分钟前', hoursAgo: '小时前', daysAgo: '天前' },
    en: { justNow: 'Just now', minutesAgo: ' min ago', hoursAgo: ' hours ago', daysAgo: ' days ago' },
    'zh-Hant': { justNow: '剛剛', minutesAgo: '分鐘前', hoursAgo: '小時前', daysAgo: '天前' }
  } as const;

  const texts = fallback[lang];

  if (diff < 60000) return texts.justNow;
  if (diff < 3600000) return Math.floor(diff / 60000) + texts.minutesAgo;
  if (diff < 86400000) return Math.floor(diff / 3600000) + texts.hoursAgo;
  if (diff < 604800000) return Math.floor(diff / 86400000) + texts.daysAgo;

  const bcp47 = LOCALE_DATE[lang];
  return date.toLocaleDateString(bcp47);
}

// ==================== 多语言取词与本地化 · Localization ====================

/** 语言顺序（回退链基准）· Locale order（源自 server/lib/locales 单一真源） */
export const LOCALES: readonly Locale[] = CONFIG_LOCALES;

/**
 * 多语言回退取词 · Pick localized text with fallback
 * @description 回退链：requested → zh → en → 任意首个非空值 → ''。
 *              保证未翻译语言（zh-Hant）优雅回退到基语言，不出现空白。
 */
export function pickLocale(text: LocalizedText | null | undefined, locale: Locale): string {
  if (!text) return '';
  for (const l of [locale, DEFAULT_LOCALE, ...LOCALES]) {
    const v = text[l]
    if (typeof v === 'string' && v.trim() !== '') return v
  }
  return '';
}

/** 按语言本地化标签数组（逐索引回退）· Localize tag arrays (per-index fallback) */
function localizeTags(tags: LocalizedTags | undefined, locale: Locale): string[] {
  if (!tags) return [];
  let len = 0;
  for (const l of LOCALES) len = Math.max(len, tags[l]?.length ?? 0);
  const out: string[] = [];
  for (let i = 0; i < len; i++) {
    let val = ''
    for (const l of [locale, DEFAULT_LOCALE, ...LOCALES]) {
      const x = tags[l]?.[i]
      if (typeof x === 'string' && x.trim() !== '') {
        val = x
        break
      }
    }
    out.push(val)
  }
  return out;
}

/** 演唱会本地化为单语言对象 · Localize a concert to a single-locale object */
export function localizeConcert(c: LocalizedConcert, locale: Locale): Concert {
  return {
    id: c.id,
    artist: pickLocale(c.artist, locale),
    concertName: pickLocale(c.concertName, locale),
    theme: pickLocale(c.theme, locale),
    location: pickLocale(c.location, locale),
    locationDetail: {
      country: pickLocale(c.locationDetail.country, locale),
      province: pickLocale(c.locationDetail.province, locale),
      city: pickLocale(c.locationDetail.city, locale),
      venue: pickLocale(c.locationDetail.venue, locale)
    },
    seat: c.seat ? pickLocale(c.seat, locale) : null,
    price: c.price ? pickLocale(c.price, locale) : null,
    date: c.date,
    time: c.time,
    poster: c.poster,
    tags: localizeTags(c.tags, locale),
    description: pickLocale(c.description, locale),
    images: c.images.map((img) => ({ src: img.src, alt: pickLocale(img.alt, locale) })),
    video: c.video ? pickLocale(c.video, locale) : null,
    videoUrl: c.videoUrl ? pickLocale(c.videoUrl, locale) : null,
    songlist: c.songlist.map((s) => ({ name: pickLocale(s.name, locale), link: s.link })),
    likes: c.likes ?? 0,
    liked: !!c.liked
  };
}

/**
 * 选出「点赞数排前三」的演唱会 id · Pick ids of the top-3 most liked concerts
 * @description 只统计点赞数 > 0 的演唱会；取点赞数最高的 3 个「不同数值」为阈值，
 *              凡点赞数 ≥ 阈值者全部入选（并列同显）；不足三档时有几档选几档。
 * @param items 含 id 与点赞数的列表（Concert / LocalizedConcert 均可）· items with id + likes
 */
export function pickHotConcertIds(items: readonly { id: number; likes?: number }[]): Set<number> {
  const liked = items.filter((c) => (c.likes ?? 0) > 0)
  if (!liked.length) return new Set<number>()
  const levels = [...new Set(liked.map((c) => c.likes as number))].sort((a, b) => b - a)
  const threshold = levels[Math.min(2, levels.length - 1)]
  return new Set(liked.filter((c) => (c.likes as number) >= threshold).map((c) => c.id))
}

/** 城市本地化为单语言对象（concertCount 由调用方填充）· Localize a city (concertCount filled by caller) */
export function localizeCity(c: LocalizedCity, locale: Locale): City {
  return {
    id: c.id,
    name: pickLocale(c.name, locale),
    seq: c.seq,
    icon: c.icon,
    concertCount: 0
  };
}

/** 许愿本地化为单语言对象 · Localize a wish */
export function localizeWish(w: LocalizedWish, locale: Locale): Wish {
  return {
    id: w.id,
    content: pickLocale(w.content, locale),
    likes: w.likes,
    liked: w.liked
  };
}

/**
 * 计算城市演唱会数（多语言匹配）· Count concerts per city (cross-locale match)
 * @description location 与 city.name 均为 LocalizedText；遍历所有语言，任一命中即计数。
 *              纯函数（无 DB 依赖），客户端与服务端（API）共用，避免把服务端代码打进客户端包。
 */
export function computeCityConcertCounts(
  concerts: { location?: LocalizedText }[],
  cities: { id: number; name: LocalizedText }[]
): Record<number, number> {
  const counts: Record<number, number> = {}
  for (const concert of concerts) {
    if (!concert.location) continue
    for (const city of cities) {
      let hit = false
      for (const l of LOCALES) {
        const cn = city.name[l]
        const loc = concert.location[l]
        if (cn && loc && loc.includes(cn)) {
          hit = true
          break
        }
      }
      if (hit) {
        counts[city.id] = (counts[city.id] ?? 0) + 1
        break
      }
    }
  }
  return counts
}
