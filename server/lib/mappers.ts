/**
 * 数据库行 → 双语结构 映射工具· DB row → bilingual shape mappers
 *
 * @module mappers
 * @description 将归一化数据表的行映射回前端预期的 `{zh,en}` 原始结构，
 *              供接口返回与客户端重建数据对象使用。
 *              Map normalized DB rows back to the bilingual {zh,en} shape the frontend expects.
 */
import type { Client } from '@libsql/client';

/**
 * 拼接结构化地点为原始字符串· Join structured location fields back to the original string
 * @param row 演唱会行 · concerts row
 * @param lang 语言 key · language key (zh | en)
 * @returns {string} 拼接后的地点字符串（空段自动省略）· joined location string (empty parts skipped)
 * @description 将 country/province/city/venue 四个字段按 `国家 · 省 · 市 · 场馆` 格式重组，
 *              空段自动省略，保证城市统计（按 city 名匹配）不受影响。
 *              Re-joins to "country · province · city · venue"; empty parts skipped,
 *              keeping city-based stats unchanged.
 */
function joinLocation(row: any, lang: 'zh' | 'en'): string {
  const parts = [
    row[`country_${lang}`],
    row[`province_${lang}`],
    row[`city_${lang}`],
    row[`venue_${lang}`]
  ].filter((v: any) => v != null && String(v).trim() !== '');
  return parts.join(' · ');
}

/**
 * 构建结构化地点详情· Build structured location detail object
 * @param row 演唱会行 · concerts row
 * @returns {{country:{zh,en},province:{zh,en},city:{zh,en},venue:{zh,en}}}
 * @description 返回国家/省/市/体育场的双语结构，供需要分段地点的场景使用。
 *              Provides structured country/province/city/venue (zh+en) for segmented location needs.
 */
function mapLocationDetail(row: any) {
  return {
    country: { zh: row.country_zh ?? '', en: row.country_en ?? '' },
    province: { zh: row.province_zh ?? '', en: row.province_en ?? '' },
    city: { zh: row.city_zh ?? '', en: row.city_en ?? '' },
    venue: { zh: row.venue_zh ?? '', en: row.venue_en ?? '' }
  };
}

/**
 * 构建原始演唱会对象· Build raw concert object
 * @param row 演唱会行 · concerts row
 * @param tags 标签数组 · tags array [{zh,en}]
 * @param images 图片数组 · images array [{src,alt_zh,alt_en}]
 * @param songlist 歌单数组 · songlist array [{zh,en,link}]
 * @returns 双语演唱会对象（location 为拼接字符串，locationDetail 为分段结构）·
 *          bilingual concert object (location joined string, locationDetail segmented)
 */
export function mapConcert(row: any, tags: any[], images: any[], songlist: any[]) {
  const pair = (zh: any, en: any) => ({ zh: zh ?? '', en: en ?? '' });
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
 * @param client LibSQL 客户端 · client
 * @param id 演唱会ID · concert id
 * @returns 双语演唱会对象；不存在时返回 null · bilingual concert, or null if missing
 */
export async function fetchConcert(client: Client, id: number) {
  const main = await client.execute({ sql: 'SELECT * FROM concerts WHERE id = ?', args: [id] });
  if (main.rows.length === 0) return null;

  const tags = (await client.execute({ sql: 'SELECT zh, en FROM concert_tags WHERE concert_id = ?', args: [id] })).rows;
  const images = (await client.execute({ sql: 'SELECT src, alt_zh, alt_en FROM concert_images WHERE concert_id = ?', args: [id] })).rows;
  const songlist = (await client.execute({ sql: 'SELECT zh, en, link FROM concert_songlist WHERE concert_id = ? ORDER BY seq ASC', args: [id] })).rows;

  return mapConcert(main.rows[0], tags, images, songlist);
}

/**
 * 拉取全部演唱会· Fetch all concerts
 * @description 批量查询子表后组装完整双语结构（含 tags/images/songlist）。
 */
export async function fetchAllConcerts(client: Client) {
  const mains = (await client.execute('SELECT * FROM concerts ORDER BY id ASC')).rows;
  const tagsRows = (await client.execute('SELECT concert_id, zh, en FROM concert_tags')).rows;
  const imagesRows = (await client.execute('SELECT concert_id, src, alt_zh, alt_en FROM concert_images')).rows;
  const songRows = (await client.execute('SELECT concert_id, zh, en, link FROM concert_songlist ORDER BY seq ASC')).rows;

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
 */
function groupBy<T extends Record<string, any>>(arr: T[], key: string): Map<any, T[]> {
  const map = new Map<any, T[]>();
  for (const item of arr) {
    const k = item[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}

/**
 * 计算城市演唱会数量· Compute city concert counts
 * @description 与迁移源逻辑一致：位置字符串包含城市名则计数（每个演唱会只计首个命中城市）。
 */
export function computeCityConcertCounts(concerts: any[], cities: any[]) {
  const counts: Record<string, number> = {};
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