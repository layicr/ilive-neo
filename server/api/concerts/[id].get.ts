/**
 * GET /api/concerts/:id · 单场演唱会详情（双语，含 tags/images/songlist）
 *
 * @param id 演唱会ID（必须为正整数）· Concert id (positive integer)
 * @returns 双语演唱会对象；非法 id 返回 400，未找到返回 404
 *
 * 说明：当前前端仅使用 /api/data 聚合端点，本端点作为公开的独立 API 保留。
 *      生产环境启用 Nitro SWR 缓存。
 */
import { getTursoClient } from '../../lib/turso';
import { fetchConcert } from '../../lib/mappers';

const buildOne = defineEventHandler(async (event) => {
  const idParam = getRouterParam(event, 'id');

  // 输入校验：必须为正整数 · Input validation: must be a positive integer
  if (!/^\d+$/.test(idParam ?? '')) {
    setResponseStatus(event, 400);
    return { error: 'invalid id: 需要正整数 · id must be a positive integer' };
  }

  const id = parseInt(idParam as string, 10);
  const client = getTursoClient();
  const concert = await fetchConcert(client, id);

  if (!concert) {
    setResponseStatus(event, 404);
    return { error: `not found: 演唱会 #${id} 不存在 · concert #${id} does not exist` };
  }

  return concert;
});

export default import.meta.dev
  ? buildOne
  : defineCachedEventHandler(buildOne, {
      maxAge: 60 * 60,
      swr: true,
      name: 'concert-by-id'
    });
