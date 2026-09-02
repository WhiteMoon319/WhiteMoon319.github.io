/**
 * YHG Private Messages API
 *
 * POST /api/messages/send   — 发送私信 { to_user_id, content }
 * GET  /api/messages        — 收到的私信列表
 * GET  /api/messages/sent   — 发出的私信列表
 */
import { getAuthUser, createNotification, checkRateLimit } from '../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');
  const last = path.split('/').pop();

  const user = await getAuthUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: '请先登录' }), { status: 401, headers });
  }

  // POST /api/messages/send
  if (request.method === 'POST' && last === 'send') {
    try {
      // 限流：每分钟最多 20 条私信
      const limit = await checkRateLimit(request, env, 'send-message', 20, 1);
      if (!limit.ok) {
        return new Response(JSON.stringify({ error: limit.error }), { status: 429, headers });
      }

      const body = await request.json();
      const toUserId = parseInt(body.to_user_id);
      const content = (body.content || '').trim();

      if (!toUserId || isNaN(toUserId)) {
        return new Response(JSON.stringify({ error: '接收用户 ID 无效' }), { status: 400, headers });
      }
      if (!content) {
        return new Response(JSON.stringify({ error: '消息内容不能为空' }), { status: 400, headers });
      }
      if (toUserId === user.id) {
        return new Response(JSON.stringify({ error: '不能给自己发私信' }), { status: 400, headers });
      }

      // 检查目标用户存在
      const target = await env.DB.prepare('SELECT id, username FROM users WHERE id = ?').bind(toUserId).first();
      if (!target) {
        return new Response(JSON.stringify({ error: '用户不存在' }), { status: 404, headers });
      }

      // 创建通知（type = private_message）
      await createNotification(
        env, toUserId, 'private_message',
        user.username + ' 给你发来私信',
        content.slice(0, 500),
        '/messages/',
        null, null, user.id
      );

      return new Response(JSON.stringify({ ok: true, message: '私信已发送' }), { status: 201, headers });
    } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ error: '请求数据无效' }), { status: 400, headers });
    }
  }

  // GET /api/messages/sent — 已发私信
  if (request.method === 'GET' && last === 'sent') {
    const rows = await env.DB.prepare(`
      SELECT n.id, n.title, n.body, n.created_at, n.is_read,
             tu.id as to_user_id, tu.username as to_username, tu.avatar as to_avatar
      FROM notifications n
      JOIN users tu ON tu.id = n.user_id
      WHERE n.from_user_id = ? AND n.type = 'private_message'
      ORDER BY n.created_at DESC
      LIMIT 50
    `).bind(user.id).all();

    return new Response(JSON.stringify({ ok: true, messages: rows.results }), { status: 200, headers });
  }

  // GET /api/messages — 收到的私信
  if (request.method === 'GET') {
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 20));
    const offset = (page - 1) * limit;

    const unreadRow = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND type = 'private_message' AND is_read = 0"
    ).bind(user.id).first();

    const rows = await env.DB.prepare(`
      SELECT n.id, n.title, n.body, n.created_at, n.is_read,
             fu.id as from_user_id, fu.username as from_username, fu.avatar as from_avatar
      FROM notifications n
      LEFT JOIN users fu ON fu.id = n.from_user_id
      WHERE n.user_id = ? AND n.type = 'private_message'
      ORDER BY n.is_read ASC, n.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(user.id, limit, offset).all();

    return new Response(JSON.stringify({
      ok: true,
      messages: rows.results,
      unread_count: unreadRow ? unreadRow.count : 0,
      page, limit
    }), { status: 200, headers });
  }

  return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
}
