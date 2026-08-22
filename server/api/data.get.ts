/**
 * GET /api/data · 全量双语数据（单端点一次拉取）· All bilingual data in one request
 *
 * @description 合并 concerts/cities/wishes/stats 为单端点，前端（含 SSR 预取）一次拉取即可。
 *              城市场次数复用同一份 concerts 计算，消除原多端点重复全量查询。
 * @returns { concerts, cities, wishes, stats }
 */
import { getTursoClient } from '../lib/turso';
import { fetchAllConcerts, computeCityConcertCounts } from '../lib/mappers';

export default defineEventHandler(async () => {
  const client = getTursoClient();
  const concerts = await fetchAllConcerts(client);

  // 统计信息 · Statistics
  const totalConcerts = concerts.length;
  const totalArtists = new Set(concerts.map(c => c.artist.zh)).size;

  const cityRows = (await client.execute(
    'SELECT id, country_zh, country_en, name_zh, name_en, icon FROM cities ORDER BY id ASC'
  )).rows;
  const counts = computeCityConcertCounts(concerts, cityRows);

  const wishRows = (await client.execute(
    'SELECT id, content_zh, content_en, time, likes, liked FROM wishes ORDER BY id ASC'
  )).rows;

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
      likes: row.likes,
      liked: row.liked
    })),
    stats: {
      totalConcerts,
      totalArtists,
      totalCities: cityRows.length
    }
  };
});
