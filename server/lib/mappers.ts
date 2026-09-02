/**
 * 数据库行 → 双语结构 映射工具· DB row → bilingual shape mappers
 *
 * @module mappers
 * @description 将归一化数据表的行映射回前端预期的 `{zh,en}` 原始结构，
 *              供接口返回与客户端重建数据对象使用。
 *              Map normalized DB rows back to the bilingual {zh,en} shape the frontend expects.
 *
 *              类型说明：libsql 查询返回的行是宽松的 `Row`（字段多为 unknown），
 *              这里在边界处用显式接口断言，内部逻辑全程强类型，避免 any 蔓延。
 */
import type { Client } from '@libsql/client';

/** 双语字段 · bilingual field */
export interface Bilingual {
  zh: string;
  en: string
}

/** 演唱会基础行（concerts 表）· concerts row */
export interface ConcertRow {
  id: number;
  artist_zh: string;
  artist_en: string;
  concert_name_zh: string;
  concert_name_en: string;
  theme_zh: string | null;
  theme_en: string | null;
  country_zh: string | null;
  country_en: string | null;
  province_zh: string | null;
  province_en: string | null;
  city_zh: string | null;
  city_en: string | null;
  venue_zh: string | null;
  venue_en: string | null;
  seat_zh: string | null;
  seat_en: string | null;
  price_zh: string | null;
  price_en: string | null;
  date: string;
  time: string | null;
  poster: string | null;
  description_zh: string | null;
  description_en: string | null;
  video_zh: string | null;
  video_en: string | null;
  video_url_zh: string | null;
  video_url_en: string | null;
}

/** 标签行 · tag row */
export interface TagRow {
  concert_id: number;
  zh: string;
  en: string
}

/** 图片行 · image row */
export interface ImageRow {
  concert_id: number;
  src: string;
  alt_zh: string | null;
  alt_en: string | null
}

/** 歌单行 · songlist row */
export interface SongRow {
  concert_id: number;
  seq: number;
  zh: string;
  en: string;
  link: string | null
}

/** 城市行 · city row */
export interface CityRow {
  id: number;
  country_zh: string | null;
  country_en: string | null;
  name_zh: string;
  name_en: string;
  icon: string | null;
}

/** 映射后的演唱会对象（内部强类型，供 API 返回）· mapped concert (strongly typed for API response) */
export interface MappedConcert {
  id: number;
  artist: Bilingual;
  concertName: Bilingual;
  theme: Bilingual;
  location: Bilingual;
  locationDetail: {
    country: Bilingual;
    province: Bilingual;
    city: Bilingual;
    venue: Bilingual;
  };
  seat: Bilingual | null;
  price: Bilingual | null;
  date: string;
  time: string | null;
  poster: string | null;
  tags: { zh: string[]; en: string[] };
  description: Bilingual;
  images: { src: string; alt: Bilingual }[];
  video: Bilingual | null;
  videoUrl: Bilingual | null;
  songlist: { zh: string; en: string; link: string | null }[];
}

/**
 * 拼接结构化地点为原始字符串· Join structured location fields back to the original string
 * @description 将 country/province/city/venue 四个字段按 `国家 · 省 · 市 · 场馆` 格式重组，
 *              空段自动省略，保证城市统计（按 city 名匹配）不受影响。
 */
function joinLocation(row: ConcertRow, lang: 'zh' | 'en'): string {
  const parts = [
    row[`country_${lang}`],
    row[`province_${lang}`],
    row[`city_${lang}`],
    row[`venue_${lang}`]
  ].filter(v => v != null && String(v).trim() !== '');
  return parts.join(' · ');
}

/**
 * 构建结构化地点详情· Build structured location detail object
 */
function mapLocationDetail(row: ConcertRow) {
  return {
    country: { zh: row.country_zh ?? '', en: row.country_en ?? '' },
    province: { zh: row.province_zh ?? '', en: row.province_en ?? '' },
    city: { zh: row.city_zh ?? '', en: row.city_en ?? '' },
    venue: { zh: row.venue_zh ?? '', en: row.venue_en ?? '' }
  };
}

/**
 * 构建原始演唱会对象· Build raw concert object
 */
export function mapConcert(row: ConcertRow, tags: TagRow[], images: ImageRow[], songlist: SongRow[]): MappedConcert {
  const pair = (zh: string | null, en: string | null): Bilingual => ({ zh: zh ?? '', en: en ?? '' });
  return {
    id: row.id,
    artist: pair(row.artist_zh, row.artist_en),
    concertName: pair(row.concert_name_zh, row.concert_name_en),
    theme: pair(row.theme_zh, row.theme_en),
    location: { zh: joinLocation(row, 'zh'), en: joinLocation(row, 'en') },
    locationDetail: mapLocationDetail(row),
    seat: (row.seat_zh != null || row.seat_en != null) ? pair(row.seat_zh, row.seat_en) : null,
    price: (row.price_zh != null || row.price_en != null) ? pair(row.price_zh, row.price_en) : null,
    date: row.date,
    time: row.time ?? null,
    poster: row.poster ?? null,
    tags: {
      zh: tags.map(t => t.zh),
      en: tags.map(t => t.en)
    },
    description: pair(row.description_zh, row.description_en),
    images: images.map(img => ({
      src: img.src,
      alt: pair(img.alt_zh, img.alt_en)
    })),
    video: (row.video_zh != null || row.video_en != null) ? pair(row.video_zh, row.video_en) : null,
    videoUrl: (row.video_url_zh != null || row.video_url_en != null) ? pair(row.video_url_zh, row.video_url_en) : null,
    songlist: songlist.map(s => ({
      zh: s.zh,
      en: s.en,
      link: s.link ?? null
    }))
  };
}

/**
 * 拉取单场演唱会并组装· Fetch & assemble one concert
 * @returns 双语演唱会对象；不存在时返回 null · bilingual concert, or null if missing
 */
export async function fetchConcert(client: Client, id: number): Promise<MappedConcert | null> {
  const main = await client.execute({ sql: 'SELECT * FROM concerts WHERE id = ?', args: [id] });
  if (main.rows.length === 0) return null;

  const tags = (await client.execute({ sql: 'SELECT zh, en FROM concert_tags WHERE concert_id = ?', args: [id] })).rows as unknown as TagRow[];
  const images = (await client.execute({ sql: 'SELECT src, alt_zh, alt_en FROM concert_images WHERE concert_id = ?', args: [id] })).rows as unknown as ImageRow[];
  const songlist = (await client.execute({ sql: 'SELECT zh, en, link FROM concert_songlist WHERE concert_id = ? ORDER BY seq ASC', args: [id] })).rows as unknown as SongRow[];

  return mapConcert(main.rows[0] as unknown as ConcertRow, tags, images, songlist);
}

/**
 * 拉取全部演唱会· Fetch all concerts
 * @description 批量查询子表后组装完整双语结构（含 tags/images/songlist）。
 */
export async function fetchAllConcerts(client: Client): Promise<MappedConcert[]> {
  const mains = (await client.execute('SELECT * FROM concerts ORDER BY id ASC')).rows as unknown as ConcertRow[];
  const tagsRows = (await client.execute('SELECT concert_id, zh, en FROM concert_tags')).rows as unknown as TagRow[];
  const imagesRows = (await client.execute('SELECT concert_id, src, alt_zh, alt_en FROM concert_images')).rows as unknown as ImageRow[];
  const songRows = (await client.execute('SELECT concert_id, zh, en, link FROM concert_songlist ORDER BY seq ASC')).rows as unknown as SongRow[];

  const tagsBy = groupBy(tagsRows, 'concert_id');
  const imagesBy = groupBy(imagesRows, 'concert_id');
  const songsBy = groupBy(songRows, 'concert_id');

  return mains.map(row => mapConcert(
    row,
    tagsBy.get(row.id) ?? [],
    imagesBy.get(row.id) ?? [],
    songsBy.get(row.id) ?? []
  ));
}

/**
 * 按 key 分组数组· group rows by key
 * @description key 默认为 concert_id（number），故返回 Map<number, T[]>。
 */
function groupBy<T extends Record<string, unknown>>(arr: T[], key: keyof T): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of arr) {
    const k = item[key] as number;
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}

/** 城市统计所需的演唱会形状（仅 location 字段）· minimal concert shape for city stats */
interface ConcertLocationShape {
  location?: { zh?: string; en?: string };
}

/**
 * 计算城市演唱会数量· Compute city concert counts
 * @description 与迁移源逻辑一致：位置字符串包含城市名则计数（每个演唱会只计首个命中城市）。
 */
export function computeCityConcertCounts(concerts: ConcertLocationShape[], cities: CityRow[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const concert of concerts) {
    for (const city of cities) {
      // 中英任一命中即可· match either zh or en
      if (
        (city.name_zh && concert.location?.zh?.includes(city.name_zh)) ||
        (city.name_en && concert.location?.en?.includes(city.name_en))
      ) {
        counts[city.id] = (counts[city.id] ?? 0) + 1;
        break;
      }
    }
  }
  return counts;
}
