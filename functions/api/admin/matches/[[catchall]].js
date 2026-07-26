/**
 * GET    /api/admin/matches       — 赛事列表
 * POST   /api/admin/matches       — 新增赛事
 * PUT    /api/admin/matches/:id   — 更新赛事
 * DELETE /api/admin/matches/:id   — 删除赛事
 */
import { isStaff } from '../check.js';

export async function onRequest(context) {
  const { request, env } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  const staff = await isStaff(request, env);
  if (!staff) {
    return new Response(JSON.stringify({ error: '需要管理员权限' }), { status: 403, headers });
  }

  const url = new URL(request.url);
  const segments = url.pathname.replace(/\/$/, '').split('/');
  const targetId = parseInt(segments[segments.length - 1]);
  const hasId = !isNaN(targetId);

  if (request.method === 'GET') {
    return handleList(env, headers);
  }
  if (request.method === 'POST' && !hasId) {
    return handleCreate(request, env, headers);
  }
  if (request.method === 'PUT' && hasId) {
    return handleUpdate(targetId, request, env, headers);
  }
  if (request.method === 'DELETE' && hasId) {
    return handleDelete(targetId, env, headers);
  }

  return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
}

async function handleList(env, headers) {
  const matches = await env.DB.prepare('SELECT * FROM matches ORDER BY match_date DESC').all();
  return new Response(JSON.stringify({ ok: true, matches: matches.results }), { status: 200, headers });
}

async function handleCreate(request, env, headers) {
  try {
    const body = await request.json();
    if (!body.title || !body.opponent || !body.match_date) {
      return new Response(JSON.stringify({ error: '缺少必填字段: title, opponent, match_date' }), { status: 400, headers });
    }
    const result = await env.DB.prepare(
      'INSERT INTO matches (title, opponent, match_date, result, score, description, featured) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      body.title, body.opponent, body.match_date,
      body.result || '', body.score || '', body.description || '',
      body.featured ? 1 : 0
    ).run();
    return new Response(JSON.stringify({ ok: true, id: result.meta.last_row_id }), { status: 201, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求数据无效' }), { status: 400, headers });
  }
}

async function handleUpdate(id, request, env, headers) {
  try {
    const body = await request.json();
    const fields = [];
    const values = [];

    for (const key of ['title', 'opponent', 'match_date', 'result', 'score', 'description', 'featured']) {
      if (body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(key === 'featured' ? (body[key] ? 1 : 0) : body[key]);
      }
    }

    if (fields.length === 0) {
      return new Response(JSON.stringify({ error: '没有要更新的字段' }), { status: 400, headers });
    }

    fields.push('updated_at = datetime(\'now\')');
    values.push(id);

    await env.DB.prepare(
      `UPDATE matches SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求数据无效' }), { status: 400, headers });
  }
}

async function handleDelete(id, env, headers) {
  await env.DB.prepare('DELETE FROM matches WHERE id = ?').bind(id).run();
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
