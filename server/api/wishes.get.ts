/**
 * GET /api/wishes · 许愿墙列表· Wish wall list
 *
 * @returns 许愿数组 [{ id, content:{zh,en}, time, likes, liked }]
 */
import { getTursoClient } from '../lib/turso';

export default defineEventHandler(async () => {
  const client = getTursoClient();
  const rows = (await client.execute('SELECT id, content_zh, content_en, time, likes, liked FROM wishes ORDER BY id ASC')).rows;

  return rows.map(row => ({
    id: row.id,
    content: { zh: row.content_zh, en: row.content_en },
    time: row.time,
    likes: row.likes,
    liked: row.liked
  }));
});