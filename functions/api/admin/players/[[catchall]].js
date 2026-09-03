/**
 * GET  /api/admin/players          — 选手列表
 * PUT  /api/admin/players/:slug    — 更新选手资料（头像等）
 */
;
import {isStaff, json, err, handleAsync} from '../../_auth.js';

export const onRequest = handleAsync(async (context) => {
  const { request, env, params } = context;


  const staff = await isStaff(request, env);
  if (!staff) {
    return err('需要管理员权限', 403);
  }

  const url = new URL(request.url);
  const segments = url.pathname.replace(/\/$/, '').split('/');
  const last = segments[segments.length - 1];

  if (request.method === 'GET') {
    return handleList(env);
  }

  if (request.method === 'PUT' && last && last !== 'players') {
    return handleUpdate(last, request, env);
  }

  return err('方法不允许', 405);
});

async function handleList(env) {
  const players = await env.DB.prepare('SELECT * FROM players ORDER BY slug').all();
  return json({ ok: true, players: players.results });
}

async function handleUpdate(slug, request, env) {
  try {
    const body = await request.json();
    // 允许更新的字段
    const fields = ['id_name', 'name', 'age', 'role', 'titles', 'bio', 'personality', 'anchor', 'experience', 'avatar', 'stats'];
    const updates = [];
    const values = [];
    for (const f of fields) {
      if (body[f] !== undefined) {
        updates.push(f + ' = ?');
        values.push(body[f]);
      }
    }
    if (updates.length === 0) {
      return err('没有可更新的字段', 400);
    }
    updates.push("updated_at = datetime('now')");
    values.push(slug);
    await env.DB.prepare(
      'UPDATE players SET ' + updates.join(', ') + ' WHERE slug = ?'
    ).bind(...values).run();
    return json({ ok: true });
  } catch (e) {
    return err('请求数据无效', 400);
  }
}
