/**
 * GET /api/cities · 城市统计（每城市场次数）· City stats (concerts per city)
 *
 * @returns 城市数组 [{ id, country:{zh,en}, name:{zh,en}, icon, concerts }]
 */
import { getTursoClient } from '../lib/turso';
import { fetchAllConcerts, computeCityConcertCounts } from '../lib/mappers';

export default defineEventHandler(async () => {
  const client = getTursoClient();
  const cities = (await client.execute(
    'SELECT id, country_zh, country_en, name_zh, name_en, icon FROM cities ORDER BY id ASC'
  )).rows;
  const concerts = await fetchAllConcerts(client);
  const counts = computeCityConcertCounts(concerts, cities);

  return cities.map(city => ({
    id: city.id,
    country: { zh: city.country_zh ?? '', en: city.country_en ?? '' },
    name: { zh: city.name_zh, en: city.name_en },
    icon: city.icon ?? null,
    concerts: counts[city.id] ?? 0
  }));
});