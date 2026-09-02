/**
 * GET    /api/players/:slug — 选手详情
 * PUT    /api/players/:slug — 更新选手资料（需绑定或admin）
 */
import { getToken, getUserFromToken } from '../_auth.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const slug = params.slug;

  if (!slug) {
    return new Response(JSON.stringify({ error: '缺少 slug' }), { status: 400, headers });
  }

  if (request.method === 'GET') {
    return handleGet(slug, env, headers);
  }
  if (request.method === 'PUT') {
    return handlePut(slug, request, env, headers);
  }

  return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
}

async function handleGet(slug, env, headers) {
  const player = await env.DB.prepare('SELECT * FROM players WHERE slug = ?').bind(slug).first();
  if (!player) {
    return new Response(JSON.stringify({ error: '选手不存在' }), { status: 404, headers });
  }
  return new Response(JSON.stringify({ ok: true, player }), { status: 200, headers });
}

async function handlePut(slug, request, env, headers) {
  const token = getToken(request);
  if (!token) {
    return new Response(JSON.stringify({ error: '请先登录' }), { status: 401, headers });
  }

  const user = await getUserFromToken(token, env);
  if (!user) {
    return new Response(JSON.stringify({ error: '会话已过期' }), { status: 401, headers });
  }

  // 查多选手绑定
  const bindings = await env.DB.prepare(
    'SELECT player_slug FROM player_bindings WHERE user_id = ?'
  ).bind(user.id).all();
  const boundSlugs = (bindings.results || []).map(b => b.player_slug);

  // 权限：admin 或绑定了此选手
  const isAdmin = user.role === 'admin';
  const isBound = user.player_slug === slug || boundSlugs.includes(slug);

  if (!isAdmin && !isBound) {
    return new Response(JSON.stringify({ error: '没有编辑权限' }), { status: 403, headers });
  }

  try {
    const body = await request.json();
    const allowed = ['name', 'age', 'titles', 'bio', 'personality', 'anchor', 'experience', 'stats'];
    const updates = [];
    const values = [];

    allowed.forEach(field => {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(typeof body[field] === 'object' ? JSON.stringify(body[field]) : body[field]);
      }
    });

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: '没有可更新的字段' }), { status: 400, headers });
    }

    updates.push("updated_at = datetime('now')");
    values.push(slug);

    await env.DB.prepare(
      `UPDATE players SET ${updates.join(', ')} WHERE slug = ?`
    ).bind(...values).run();

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers });
  }
}
