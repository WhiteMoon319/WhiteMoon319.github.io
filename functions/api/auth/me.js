/**
 * GET /api/auth/me
 * 获取当前登录用户信息（含多选手绑定列表）
 */
import { getToken } from '../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };

  const token = getToken(request);
  if (!token) {
    return new Response(JSON.stringify({ error: '未登录' }), { status: 401, headers });
  }

  const row = await env.DB.prepare(`
    SELECT u.id, u.email, u.username, u.role, u.level, u.player_slug, u.avatar, u.created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))
  `).bind(token).first();

  if (!row) {
    return new Response(JSON.stringify({ error: '会话已过期' }), { status: 401, headers });
  }

  // 查多选手绑定
  const bindings = await env.DB.prepare(
    'SELECT player_slug FROM player_bindings WHERE user_id = ?'
  ).bind(row.id).all();
  row.bound_players = (bindings.results || []).map(b => b.player_slug);

  return new Response(JSON.stringify({ ok: true, user: row }), { status: 200, headers });
}
