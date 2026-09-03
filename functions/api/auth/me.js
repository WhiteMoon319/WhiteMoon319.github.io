/**
 * GET /api/auth/me
 * 获取当前登录用户信息（含多选手绑定列表）
 */
import {getToken, json, err, handleAsync} from '../_auth.js';

export const onRequest = handleAsync(async (context) => {
  const { request, env } = context;


  const token = getToken(request);
  if (!token) {
    return err('未登录', 401);
  }

  const row = await env.DB.prepare(`
    SELECT u.id, u.email, u.username, u.role, u.level, u.player_slug, u.avatar, u.created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))
  `).bind(token).first();

  if (!row) {
    return err('会话已过期', 401);
  }

  // 查多选手绑定
  const bindings = await env.DB.prepare(
    'SELECT player_slug FROM player_bindings WHERE user_id = ?'
  ).bind(row.id).all();
  row.bound_players = (bindings.results || []).map(b => b.player_slug);

  return json({ ok: true, user: row });
});
