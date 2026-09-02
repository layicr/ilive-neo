/**
 * GET /api/data · 全量双语数据（单端点一次拉取）· All bilingual data in one request
 *
 * @description 合并 concerts/cities/wishes/stats 为单端点，前端（含 SSR 预取）一次拉取即可。
 *              城市场次数复用同一份 concerts 计算，消除原多端点重复全量查询。
 * @returns { concerts, cities, wishes, stats }
 *
 * 缓存：生产环境用 Nitro SWR 缓存（defineCachedEventHandler）。
 *      数据基本静态（仅许愿墙会变），缓存可省去每次请求 4 次全表查询 + 93KB 序列化；
 *      dev 下不缓存，避免改数据不刷新。
 */
import { getTursoClient } from '../lib/turso';
import { fetchAllConcerts, computeCityConcertCounts, type CityRow } from '../lib/mappers';

/** 许愿行 · wish row */
interface WishRow {
  id: number;
  content_zh: string;
  content_en: string;
  time: string;
  likes: number | null;
  liked: number | null;
}

const buildData = defineEventHandler(async () => {
  const client = getTursoClient();
  const concerts = await fetchAllConcerts(client);

  // 统计信息 · Statistics
  const totalConcerts = concerts.length;
  const totalArtists = new Set(concerts.map(c => c.artist.zh)).size;

  const cityRows = (await client.execute(
    'SELECT id, country_zh, country_en, name_zh, name_en, icon FROM cities ORDER BY id ASC'
  )).rows as unknown as CityRow[];
  const counts = computeCityConcertCounts(concerts, cityRows);

  const wishRows = (await client.execute(
    'SELECT id, content_zh, content_en, time, likes, liked FROM wishes ORDER BY id ASC'
  )).rows as unknown as WishRow[];

  return {
    concerts,
    cities: cityRows.map(city => ({
      id: city.id,
      name: {
        zh: city.name_zh,
        en: city.name_en
      },
      icon: city.icon ?? null,
      concerts: counts[city.id] ?? 0
    })),
    wishes: wishRows.map(row => ({
      id: row.id,
      content: {
        zh: row.content_zh,
        en: row.content_en
      },
      time: row.time,
      likes: row.likes ?? 0,
      liked: row.liked ?? 0
    })),
    stats: {
      totalConcerts,
      totalArtists,
      totalCities: cityRows.length
    }
  };
});

export default import.meta.dev
  ? buildData
  : defineCachedEventHandler(buildData, {
      maxAge: 60 * 60,
      swr: true,
      name: 'api-data'
    });
