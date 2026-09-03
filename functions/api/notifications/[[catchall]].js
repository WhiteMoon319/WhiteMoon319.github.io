/**
 * YHG Notifications API
 *
 * GET    /api/notifications                     — 通知列表（分页，未读在前）
 * GET    /api/notifications?unread=1            — 仅返回未读计数
 * GET    /api/notifications?type=system         — 按类型筛选
 * PUT    /api/notifications/read                — 标记已读 { id: null } 全部，{ id: 123 } 单条
 * GET    /api/notifications/preferences         — 获取通知偏好
 * PUT    /api/notifications/preferences         — 更新通知偏好
 * DELETE /api/notifications/:id                 — 删除单条通知
 */
import {getAuthUser, json, err, handleAsync, parsePagination} from '../_auth.js';

export const onRequest = handleAsync(async (context) => {
  const { request, env } = context;

  const url = new URL(request.url);

  const user = await getAuthUser(request, env);
  if (!user) {
    return err('请先登录', 401);
  }

  const path = url.pathname.replace(/\/$/, '');
  const segments = path.split('/');
  const last = segments[segments.length - 1];
  const secondLast = segments.length >= 2 ? segments[segments.length - 2] : '';

  // ===== 偏好 =====

  // GET /api/notifications/preferences
  if (request.method === 'GET' && last === 'preferences') {
    const pref = await env.DB.prepare(
      'SELECT * FROM notification_preferences WHERE user_id = ?'
    ).bind(user.id).first();

    const defaults = {
      on_site: 1, email: 0, on_comment: 1, on_reply: 1,
      on_like: 1, on_article_status: 1, on_announcement: 1
    };

    return json({
      ok: true,
      preferences: pref || defaults
    }, 200);
  }

  // PUT /api/notifications/preferences
  if (request.method === 'PUT' && last === 'preferences') {
    try {
      const body = await request.json();
      const fields = ['on_site', 'email', 'on_comment', 'on_reply', 'on_like', 'on_article_status', 'on_announcement'];
      const vals = {};
      for (const f of fields) {
        vals[f] = body[f] !== undefined ? (body[f] ? 1 : 0) : undefined;
      }

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

      return json({ ok: true });
    } catch (e) {
      console.error(e);
      return err('请求数据无效', 400);
    }
  }

  // ===== 标记已读 =====

  // PUT /api/notifications/read
  if (request.method === 'PUT' && last === 'read') {
    try {
      const body = await request.json();
      if (body && body.id) {
        await env.DB.prepare(
          'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
        ).bind(body.id, user.id).run();
      } else {
        await env.DB.prepare(
          'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'
        ).bind(user.id).run();
      }
      return json({ ok: true });
    } catch (e) {
      return err('请求数据无效', 400);
    }
  }

  // ===== 删除 =====

  // DELETE /api/notifications/:id
  if (request.method === 'DELETE' && last && last !== 'notifications' && !isNaN(parseInt(last))) {
    const id = parseInt(last);
    // 检查归属
    const notif = await env.DB.prepare(
      'SELECT id, user_id FROM notifications WHERE id = ?'
    ).bind(id).first();
    if (!notif) {
      return err('通知不存在', 404);
    }
    const isStaff = user.role === 'admin' || user.role === 'sub_admin';
    if (notif.user_id !== user.id && !isStaff) {
      return err('无权删除', 403);
    }
    await env.DB.prepare('DELETE FROM notifications WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  // ===== 未读计数 =====

  // GET /api/notifications?unread=1
  if (request.method === 'GET' && url.searchParams.get('unread') === '1') {
    const row = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).bind(user.id).first();
    return json({ ok: true, unread_count: row ? row.count : 0 });
  }

  // ===== 列表（支持 ?type= 筛选） =====

  // GET /api/notifications
  if (request.method === 'GET') {
    const { page, limit, offset } = parsePagination(url, 20, 50);
    const typeFilter = url.searchParams.get('type') || '';

    let whereClause = 'WHERE n.user_id = ?';
    const params = [user.id];

    // 类型筛选
    if (typeFilter === 'system') {
      whereClause += " AND n.type = 'system'";
    } else if (typeFilter === 'comment') {
      whereClause += " AND (n.type = 'comment' OR n.type = 'reply')";
    } else if (typeFilter === 'like') {
      whereClause += " AND (n.type = 'like_article' OR n.type = 'like_comment')";
    } else if (typeFilter === 'private_message') {
      whereClause += " AND n.type = 'private_message'";
    }

    const unreadRow = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM notifications n ${whereClause} AND n.is_read = 0`
    ).bind(...params).first();

    const rows = await env.DB.prepare(`
      SELECT n.id, n.type, n.title, n.body, n.link,
             n.related_article_id, n.related_comment_id,
             n.is_read, n.created_at, n.from_user_id,
             fu.username as from_username, fu.avatar as from_avatar
      FROM notifications n
      LEFT JOIN users fu ON fu.id = n.from_user_id
      ${whereClause}
      ORDER BY n.is_read ASC, n.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();

    return json({
      ok: true,
      notifications: rows.results,
      unread_count: unreadRow ? unreadRow.count : 0,
      page,
      limit
    }, 200);
  }

  return err('方法不允许', 405);
});
