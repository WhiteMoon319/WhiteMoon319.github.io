/**
 * YHG Notifications API
 *
 * GET  /api/notifications            — 通知列表（分页，未读在前）
 * GET  /api/notifications?unread=1   — 仅返回未读计数
 * PUT  /api/notifications/read       — 标记已读 { id: null } 全部标记，{ id: 123 } 单条
 * GET  /api/notifications/preferences     — 获取通知偏好
 * PUT  /api/notifications/preferences     — 更新通知偏好
 */
import { getAuthUser } from '../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const url = new URL(request.url);

  const user = await getAuthUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: '请先登录' }), { status: 401, headers });
  }

  const path = url.pathname.replace(/\/$/, '');

  // GET /api/notifications?unread=1 — 仅返回未读计数
  if (request.method === 'GET' && url.searchParams.get('unread') === '1') {
    const row = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).bind(user.id).first();
    return new Response(JSON.stringify({ ok: true, unread_count: row ? row.count : 0 }), { status: 200, headers });
  }

  // GET /api/notifications — 列表
  if (request.method === 'GET') {
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 20));
    const offset = (page - 1) * limit;

    // 未读总数
    const unreadRow = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).bind(user.id).first();

    // 列表：未读在前，按时间倒序
    const rows = await env.DB.prepare(`
      SELECT id, type, title, body, link, related_article_id, related_comment_id, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY is_read ASC, created_at DESC
      LIMIT ? OFFSET ?
    `).bind(user.id, limit, offset).all();

    return new Response(JSON.stringify({
      ok: true,
      notifications: rows.results,
      unread_count: unreadRow ? unreadRow.count : 0,
      page,
      limit
    }), { status: 200, headers });
  }

  // PUT /api/notifications/read — 标记已读
  if (request.method === 'PUT' && path.endsWith('/read')) {
    try {
      const body = await request.json();
      if (body && body.id) {
        // 单条标记
        await env.DB.prepare(
          'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
        ).bind(body.id, user.id).run();
      } else {
        // 全部标记已读
        await env.DB.prepare(
          'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'
        ).bind(user.id).run();
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: '请求数据无效' }), { status: 400, headers });
    }
  }

  // GET /api/notifications/preferences
  if (request.method === 'GET' && path.endsWith('/preferences')) {
    const pref = await env.DB.prepare(
      'SELECT * FROM notification_preferences WHERE user_id = ?'
    ).bind(user.id).first();

    const defaults = {
      on_site: 1, email: 0, on_comment: 1, on_reply: 1,
      on_like: 1, on_article_status: 1, on_announcement: 1
    };

    return new Response(JSON.stringify({
      ok: true,
      preferences: pref || defaults
    }), { status: 200, headers });
  }

  // PUT /api/notifications/preferences
  if (request.method === 'PUT' && path.endsWith('/preferences')) {
    try {
      const body = await request.json();
      const fields = ['on_site', 'email', 'on_comment', 'on_reply', 'on_like', 'on_article_status', 'on_announcement'];
      const vals = {};
      for (const f of fields) {
        vals[f] = body[f] !== undefined ? (body[f] ? 1 : 0) : undefined;
      }

      // UPSERT
      const existing = await env.DB.prepare(
        'SELECT user_id FROM notification_preferences WHERE user_id = ?'
      ).bind(user.id).first();

      if (existing) {
        const sets = fields.filter(f => vals[f] !== undefined).map(f => `${f} = ?`).join(', ');
        const params = fields.filter(f => vals[f] !== undefined).map(f => vals[f]);
        if (sets) {
          await env.DB.prepare(
            `UPDATE notification_preferences SET ${sets} WHERE user_id = ?`
          ).bind(...params, user.id).run();
        }
      } else {
        const cols = ['user_id', ...fields.filter(f => vals[f] !== undefined)];
        const qs = cols.map(() => '?');
        const params = [user.id, ...fields.filter(f => vals[f] !== undefined).map(f => vals[f])];
        await env.DB.prepare(
          `INSERT INTO notification_preferences (${cols.join(', ')}) VALUES (${qs.join(', ')})`
        ).bind(...params).run();
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ error: '请求数据无效' }), { status: 400, headers });
    }
  }

  return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
}
