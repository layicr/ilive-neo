/**
 * 数据映射层（聚合导出）· Data mapping (barrel)
 *
 * @module server/lib/mappers
 * @description 将各子模块（parse / concerts / seo / friendLinks）统一再导出。
 *              历史 `import { ... } from './mappers'` 仍可用，调用方无需改动：
 *                · parse.ts        —— parseI18n / parseTags / has（i18n JSON 解析）
 *                · concerts.ts      —— ConcertRow 等行类型 + mapConcert / fetchConcert / fetchAllConcerts
 *                · seo.ts           —— SEO_I18N_KEYS / SEO_FALLBACK / fetchSiteSeo
 *                · friendLinks.ts   —— FriendLinkRow / mapFriendLink / fetchFriendLinks
 *                · concertLikes.ts  —— fetchLikeCounts / fetchLikeCount / fetchLikedConcertIds / toggleConcertLike
 *
 *              Barrel that re-exports the sub-modules; legacy `import { ... } from './mappers'` keeps
 *              working, so callers need no changes.
 */

export * from './parse';
export * from './concerts';
export * from './seo';
export * from './friendLinks';
export * from './concertLikes';

/** 语言顺序（兼容历史 `import { LOCALES } from './mappers'`）· Locale order re-export */
export { LOCALES } from './locales';
