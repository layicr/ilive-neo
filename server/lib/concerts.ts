/**
 * 演唱会数据映射层 · Concert mapping (DB rows -> LocalizedConcert)
 *
 * @module server/lib/concerts
 * @description 将 concerts 表及其子表（tags / images / songlist）的行，
 *              组装为按 locale 分组的 `LocalizedConcert`。批量查询后在内存 groupBy，
 *              避免 N+1；可翻译字段经 `parseI18n` 解析。
 *              Assembles rows from the concerts table and its child tables (tags / images / songlist)
 *              into per-locale `LocalizedConcert` objects. Batched queries are grouped by id in memory
 *              to avoid N+1; translatable fields are parsed via `parseI18n`.
 */

import type { Client } from '@libsql/client';
import type { LocalizedText, LocalizedTags, LocalizedConcert } from '../../app/types';
import { LOCALES } from './locales';
import { parseI18n, parseTags, has } from './parse';

/* ---------- 行类型（DB 列，宽松断言）· Row types (DB columns, loose casts) ---------- */

export interface ConcertRow {
  id: number;
  artist_i18n: string;
  concert_name_i18n: string;
  theme_i18n: string | null;
  country_i18n: string | null;
  province_i18n: string | null;
  city_i18n: string | null;
  venue_i18n: string | null;
  seat_i18n: string | null;
  price_i18n: string | null;
  date: string;
  time: string | null;
  poster: string | null;
  description_i18n: string | null;
  video_i18n: string | null;
  video_url_i18n: string | null;
  /** 点赞总数冗余列（由 toggleConcertLike 维护；未迁移库 SELECT 时缺失）· denormalized like count (maintained by toggleConcertLike) */
  likes?: number;
}

export interface TagRow { concert_id: number; i18n: string }
export interface ImageRow { concert_id: number; url: string; alt_i18n: string | null }
export interface SongRow { concert_id: number; seq: number; i18n: string; link: string | null }
export interface CityRow { id: number; country_i18n: string | null; name_i18n: string; seq: number; icon: string | null }

/* ---------- 映射 · Mapping ---------- */

/** 拼接地点为按语言的多语言文本 · Join location parts into a per-locale LocalizedText */
function joinLocation(row: ConcertRow): LocalizedText {
  const out: LocalizedText = { 'zh-CN': '' };
  for (const l of LOCALES) {
    const parts = [row.country_i18n, row.province_i18n, row.city_i18n, row.venue_i18n]
      .map((j) => (parseI18n(j)[l] ?? '').trim())
      .filter(Boolean);
    out[l] = parts.join(' · ');
  }
  return out;
}

/** 拆分地点为按语言的明细（国/省/市/场馆）· Split location into per-locale detail fields */
function mapLocationDetail(row: ConcertRow) {
  return {
    country: parseI18n(row.country_i18n),
    province: parseI18n(row.province_i18n),
    city: parseI18n(row.city_i18n),
    venue: parseI18n(row.venue_i18n)
  };
}

/** 将单场演唱会行 + 关联数据映射为多语言领域模型 · Map one concert row (+relations) to LocalizedConcert */
export function mapConcert(
  row: ConcertRow,
  tags: TagRow[],
  images: ImageRow[],
  songlist: SongRow[]
): LocalizedConcert {
  // 合并多行标签（每行一个 i18n 数组 JSON）· merge tag rows into per-locale arrays
  const mergedTags: LocalizedTags = { 'zh-CN': [] };
  for (const l of LOCALES) mergedTags[l] = [];
  for (const t of tags) {
    const arr = parseTags(t.i18n);
    for (const l of LOCALES) mergedTags[l] = (mergedTags[l] ?? []).concat(arr[l] ?? []);
  }

  return {
    id: row.id,
    artist: parseI18n(row.artist_i18n),
    concertName: parseI18n(row.concert_name_i18n),
    theme: parseI18n(row.theme_i18n),
    location: joinLocation(row),
    locationDetail: mapLocationDetail(row),
    seat: has(row.seat_i18n) ? parseI18n(row.seat_i18n) : null,
    price: has(row.price_i18n) ? parseI18n(row.price_i18n) : null,
    date: row.date,
    time: row.time ?? null,
    poster: row.poster ?? null,
    tags: mergedTags,
    description: parseI18n(row.description_i18n),
    images: images.map((img) => ({ src: img.url, alt: parseI18n(img.alt_i18n) })),
    video: has(row.video_i18n) ? parseI18n(row.video_i18n) : null,
    videoUrl: has(row.video_url_i18n) ? parseI18n(row.video_url_i18n) : null,
    songlist: songlist.map((s) => ({ name: parseI18n(s.i18n), link: s.link ?? null })),
    // 点赞总数直接取 concerts.likes 冗余列；未迁移库缺列时回退 0（由迁移脚本 calibrate，接口层 fill）
    // Like total comes from the concerts.likes denormalized column; pre-migration (missing column) falls back to 0
    likes: Number(row.likes ?? 0),
    liked: false
  };
}

/* ---------- 查询 · Queries ---------- */

/**
 * 探测 concerts 表是否存在 likes 冗余列 · Detect whether the concerts table has the denormalized `likes` column
 * @description 仅探测一次（模块级缓存）。未迁移的旧库没有该列，探测失败则后续 SELECT 不带该列、
 *              读取回退 0，待执行 `server/db/migrate-likes.mjs` 迁移后自动生效。
 *              Probed once (module-level cache). Pre-migration DBs lack the column; on failure the SELECTs
 *              omit it and reads fall back to 0 until migrate-likes.mjs runs.
 */
let likesColumnProbed = false
let likesColumnSupported = false
async function supportsLikesColumn(client: Client): Promise<boolean> {
  if (likesColumnProbed) return likesColumnSupported
  try {
    await client.execute('SELECT likes FROM concerts LIMIT 1')
    likesColumnSupported = true
  } catch {
    likesColumnSupported = false
  }
  likesColumnProbed = true
  return likesColumnSupported
}

/** 演唱会 SELECT 列（已迁移则含 likes 冗余列）· concert SELECT columns (includes `likes` when migrated) */
async function concertColumns(client: Client): Promise<string> {
  const base = 'id, artist_i18n, concert_name_i18n, theme_i18n, country_i18n, province_i18n, city_i18n, venue_i18n, seat_i18n, price_i18n, date, time, poster, description_i18n, video_i18n, video_url_i18n'
  return (await supportsLikesColumn(client)) ? `${base}, likes` : base
}

/** 单场演唱会（含 tags/images/songlist）· Single concert with relations */
export async function fetchConcert(client: Client, id: number): Promise<LocalizedConcert | null> {
  const row = await client.execute({
    sql: `SELECT ${await concertColumns(client)}
          FROM concerts WHERE id = ?`,
    args: [id]
  });
  if (!row.rows.length) return null;
  const r = row.rows[0] as unknown as ConcertRow;
  const tags = (await client.execute({ sql: 'SELECT i18n FROM concert_tags WHERE concert_id = ? ORDER BY seq', args: [id] }))
    .rows.map((x) => x as unknown as TagRow);
  const images = (await client.execute({ sql: 'SELECT url, alt_i18n FROM concert_images WHERE concert_id = ? ORDER BY sort_order', args: [id] }))
    .rows.map((x) => x as unknown as ImageRow);
  const songlist = (await client.execute({ sql: 'SELECT seq, i18n, link FROM concert_songlist WHERE concert_id = ? ORDER BY seq', args: [id] }))
    .rows.map((x) => x as unknown as SongRow);
  return mapConcert(r, tags, images, songlist);
}

/** 全部演唱会（批量查询子表后 groupBy 组装，避免 N+1）· All concerts (batched) */
export async function fetchAllConcerts(client: Client): Promise<LocalizedConcert[]> {
  const rows = (
    await client.execute(
      `SELECT ${await concertColumns(client)}
       FROM concerts ORDER BY date DESC, seq ASC`
    )
  ).rows.map((x) => x as unknown as ConcertRow);

  if (!rows.length) return [];

  const tags = (await client.execute('SELECT concert_id, i18n FROM concert_tags')).rows.map((x) => x as unknown as TagRow);
  const images = (await client.execute('SELECT concert_id, url, alt_i18n FROM concert_images')).rows.map((x) => x as unknown as ImageRow);
  const songlist = (await client.execute('SELECT concert_id, seq, i18n, link FROM concert_songlist')).rows.map((x) => x as unknown as SongRow);

  const byId = <T extends { concert_id: number }>(arr: T[]): Record<number, T[]> => {
    const m: Record<number, T[]> = {};
    for (const r of arr) (m[r.concert_id] ??= []).push(r);
    return m;
  };
  const gTags = byId(tags);
  const gImages = byId(images);
  const gSongs = byId(songlist);

  return rows.map((r) => mapConcert(r, gTags[r.id] ?? [], gImages[r.id] ?? [], gSongs[r.id] ?? []));
}
