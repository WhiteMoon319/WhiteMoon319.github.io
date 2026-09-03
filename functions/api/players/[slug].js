/**
 * GET    /api/players/:slug — 选手详情
 * PUT    /api/players/:slug — 更新选手资料（需绑定或admin）
 */
import {getToken, getUserFromToken, json, err, handleAsync} from '../_auth.js';

export const onRequest = handleAsync(async (context) => {
  const { request, env, params } = context;

  const slug = params.slug;

  if (!slug) {
    return err('缺少 slug', 400);
  }

  if (request.method === 'GET') {
    return handleGet(slug, env);
  }
  if (request.method === 'PUT') {
    return handlePut(slug, request, env);
  }

  return err('方法不允许', 405);
});

async function handleGet(slug, env) {
  const player = await env.DB.prepare('SELECT * FROM players WHERE slug = ?').bind(slug).first();
  if (!player) {
    return err('选手不存在', 404);
  }
  return json({ ok: true, player });
}

async function handlePut(slug, request, env) {
  const token = getToken(request);
  if (!token) {
    return err('请先登录', 401);
  }

  const user = await getUserFromToken(token, env);
  if (!user) {
    return err('会话已过期', 401);
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
    return err('没有编辑权限', 403);
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
      return err('没有可更新的字段', 400);
    }

    updates.push("updated_at = datetime('now')");
    values.push(slug);

    await env.DB.prepare(
      `UPDATE players SET ${updates.join(', ')} WHERE slug = ?`
    ).bind(...values).run();

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return err('服务器错误', 500);
  }
}
