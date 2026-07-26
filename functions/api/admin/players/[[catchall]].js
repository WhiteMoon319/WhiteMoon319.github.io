/**
 * GET  /api/admin/players          — 选手列表
 * PUT  /api/admin/players/:slug    — 更新选手资料（头像等）
 */
import { isStaff } from '../check.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  const staff = await isStaff(request, env);
  if (!staff) {
    return new Response(JSON.stringify({ error: '需要管理员权限' }), { status: 403, headers });
  }

  const url = new URL(request.url);
  const segments = url.pathname.replace(/\/$/, '').split('/');
  const last = segments[segments.length - 1];

  if (request.method === 'GET') {
    return handleList(env, headers);
  }

  if (request.method === 'PUT' && last && last !== 'players') {
    return handleUpdate(last, request, env, headers);
  }

  return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
}

async function handleList(env, headers) {
  const players = await env.DB.prepare('SELECT * FROM players ORDER BY slug').all();
  return new Response(JSON.stringify({ ok: true, players: players.results }), { status: 200, headers });
}

async function handleUpdate(slug, request, env, headers) {
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
      return new Response(JSON.stringify({ error: '没有可更新的字段' }), { status: 400, headers });
    }
    updates.push("updated_at = datetime('now')");
    values.push(slug);
    await env.DB.prepare(
      'UPDATE players SET ' + updates.join(', ') + ' WHERE slug = ?'
    ).bind(...values).run();
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求数据无效' }), { status: 400, headers });
  }
}
