/**
 * GET    /api/admin/matches       — 赛事列表
 * POST   /api/admin/matches       — 新增赛事
 * PUT    /api/admin/matches/:id   — 更新赛事
 * DELETE /api/admin/matches/:id   — 删除赛事
 */
import { isStaff } from '../check.js';
import {json, err, handleAsync} from '../../_auth.js';

export const onRequest = handleAsync(async (context) => {
  const { request, env } = context;


  const staff = await isStaff(request, env);
  if (!staff) {
    return err('需要管理员权限', 403);
  }

  const url = new URL(request.url);
  const segments = url.pathname.replace(/\/$/, '').split('/');
  const targetId = parseInt(segments[segments.length - 1]);
  const hasId = !isNaN(targetId);

  if (request.method === 'GET') {
    return handleList(env);
  }
  if (request.method === 'POST' && !hasId) {
    return handleCreate(request, env);
  }
  if (request.method === 'PUT' && hasId) {
    return handleUpdate(targetId, request, env);
  }
  if (request.method === 'DELETE' && hasId) {
    return handleDelete(targetId, env);
  }

  return err('方法不允许', 405);
});

async function handleList(env) {
  const matches = await env.DB.prepare('SELECT * FROM matches ORDER BY match_date DESC').all();
  return json({ ok: true, matches: matches.results });
}

async function handleCreate(request, env) {
  try {
    const body = await request.json();
    if (!body.title || !body.opponent || !body.match_date) {
      return err('缺少必填字段: title, opponent, match_date', 400);
    }
    const result = await env.DB.prepare(
      'INSERT INTO matches (title, opponent, match_date, result, score, description, featured) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      body.title, body.opponent, body.match_date,
      body.result || '', body.score || '', body.description || '',
      body.featured ? 1 : 0
    ).run();
    return json({ ok: true, id: result.meta.last_row_id }, 201);
  } catch (e) {
    return err('请求数据无效', 400);
  }
}

async function handleUpdate(id, request, env) {
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
      return err('没有要更新的字段', 400);
    }

    fields.push('updated_at = datetime(\'now\')');
    values.push(id);

    await env.DB.prepare(
      `UPDATE matches SET ${fields.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    return json({ ok: true });
  } catch (e) {
    return err('请求数据无效', 400);
  }
}

async function handleDelete(id, env) {
  await env.DB.prepare('DELETE FROM matches WHERE id = ?').bind(id).run();
  return json({ ok: true });
}
