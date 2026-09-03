
import {json, err, handleAsync} from '../_auth.js';
/**
 * GET /api/matches — 公开赛事列表（按日期倒序）
 */
export const onRequest = handleAsync(async (context) => {
  const { request, env } = context;

  if (request.method !== 'GET') {
    return err('仅支持 GET', 405);
  }

  const matches = await env.DB.prepare(
    'SELECT * FROM matches ORDER BY match_date DESC'
  ).all();

  return json({ ok: true, matches: matches.results });
});
