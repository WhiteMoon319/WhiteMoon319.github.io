
import {json, err, handleAsync} from '../_auth.js';
/**
 * GET /api/players — 所有选手列表
 */
export const onRequest = handleAsync(async (context) => {
  const { request, env } = context;

  if (request.method !== 'GET') {
    return err('方法不允许', 405);
  }

  const players = await env.DB.prepare('SELECT slug, id_name, name, age, role, titles, bio, avatar FROM players ORDER BY slug').all();
  return json({ ok: true, players: players.results });
});
