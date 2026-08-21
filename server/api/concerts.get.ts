/**
 * GET /api/concerts · 演唱会列表（含统计）· Concernt list with stats
 *
 * @returns 完整双语演唱会数组与统计 { concerts, stats: { totalConcerts, totalArtists, totalCities } }
 */
import { getTursoClient } from '../lib/turso';
import { fetchAllConcerts } from '../lib/mappers';

export default defineEventHandler(async (event) => {
  const client = getTursoClient();
  const concerts = await fetchAllConcerts(client);

  // 统计信息 · stats (艺人数/城市数与传统统计一致)
  const totalConcerts = concerts.length;
  const artists = new Set(concerts.map(c => c.artist.zh)).size;
  const cities = await client.execute('SELECT id FROM cities');
  const totalCities = cities.rows.length;

  return {
    concerts,
    stats: {
      totalConcerts,
      totalArtists: artists,
      totalCities
    }
  };
});