/**
 * YHG Admin Announcements API — 公告管理 CRUD
 *
 * GET    /api/admin/announcements        — 公告列表
 * POST   /api/admin/announcements        — 创建公告（同时通知所有用户）
 * GET    /api/admin/announcements/:id    — 单条公告详情
 * PUT    /api/admin/announcements/:id    — 编辑公告（同时更新用户通知）
 * DELETE /api/admin/announcements/:id    — 删除公告（同时删除所有用户通知）
 */
import { isStaff } from '../check.js';
import { createNotification, notifyAllUsers } from '../../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  const staff = await isStaff(request, env);
  if (!staff) {
    return new Response(JSON.stringify({ error: '需要管理员权限' }), { status: 403, headers });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');
  const segments = path.split('/');
  const id = segments.length >= 2 ? segments[segments.length - 1] : null;
  const isId = id && id !== 'announcements' && !isNaN(parseInt(id));
  const annId = isId ? parseInt(id) : null;

  // GET /api/admin/announcements — 列表
  if (request.method === 'GET' && !annId) {
    const rows = await env.DB.prepare(`
      SELECT a.id, a.title, a.body, a.link, a.created_by, a.created_at, a.updated_at,
             u.username as creator_name
      FROM announcements a
      LEFT JOIN users u ON u.id = a.created_by
      ORDER BY a.created_at DESC
    `).all();

    return new Response(JSON.stringify({ ok: true, announcements: rows.results || [] }), { status: 200, headers });
  }

  // GET /api/admin/announcements/:id — 单条
  if (request.method === 'GET' && annId) {
    const ann = await env.DB.prepare(`
      SELECT a.*, u.username as creator_name
      FROM announcements a
      LEFT JOIN users u ON u.id = a.created_by
      WHERE a.id = ?
    `).bind(annId).first();

    if (!ann) {
      return new Response(JSON.stringify({ error: '公告不存在' }), { status: 404, headers });
    }
    return new Response(JSON.stringify({ ok: true, announcement: ann }), { status: 200, headers });
  }

  // POST /api/admin/announcements — 创建
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const title = (body.title || '').trim();
      if (!title) {
        return new Response(JSON.stringify({ error: '公告标题不能为空' }), { status: 400, headers });
      }

      // 写入 announcements 表
      const result = await env.DB.prepare(
        "INSERT INTO announcements (title, body, link, created_by) VALUES (?, ?, ?, ?)"
      ).bind(title, body.content || '', body.link || '', staff.id).run();

      const newId = result.meta.last_row_id;

      // 通知所有用户
      await notifyAllUsers(env, 'system', title, body.content || '', body.link || '');

      return new Response(JSON.stringify({ ok: true, id: newId, message: '公告已发布' }), { status: 201, headers });
    } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ error: '请求数据无效' }), { status: 400, headers });
    }
  }

  // PUT /api/admin/announcements/:id — 编辑
  if (request.method === 'PUT' && annId) {
    try {
      const body = await request.json();
      const title = (body.title || '').trim();
      if (!title) {
        return new Response(JSON.stringify({ error: '公告标题不能为空' }), { status: 400, headers });
      }

      // 检查公告存在
      const existing = await env.DB.prepare('SELECT id FROM announcements WHERE id = ?').bind(annId).first();
      if (!existing) {
        return new Response(JSON.stringify({ error: '公告不存在' }), { status: 404, headers });
      }

      // 更新 announcements 表
      await env.DB.prepare(
        "UPDATE announcements SET title = ?, body = ?, link = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(title, body.content || '', body.link || '', annId).run();

      // 更新所有已发送的通知（type=system，匹配原标题/内容）
      // 使用原公告信息来查找通知
      await env.DB.prepare(
        "UPDATE notifications SET title = ?, body = ?, link = ? WHERE type = 'system' AND title = ? AND body = ? AND link = ?"
      ).bind(title, body.content || '', body.link || '', existing.title || '', existing.body || '', existing.link || '').run();

      return new Response(JSON.stringify({ ok: true, message: '公告已更新' }), { status: 200, headers });
    } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ error: '请求数据无效' }), { status: 400, headers });
    }
  }

  // DELETE /api/admin/announcements/:id — 删除
  if (request.method === 'DELETE' && annId) {
    // 获取公告信息
    const ann = await env.DB.prepare('SELECT id, title, body, link FROM announcements WHERE id = ?').bind(annId).first();
    if (!ann) {
      return new Response(JSON.stringify({ error: '公告不存在' }), { status: 404, headers });
    }

    // 删除所有相关的用户通知
    await env.DB.prepare(
      "DELETE FROM notifications WHERE type = 'system' AND title = ? AND body = ? AND link = ?"
    ).bind(ann.title, ann.body || '', ann.link || '').run();

    // 删除公告记录
    await env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(annId).run();

    return new Response(JSON.stringify({ ok: true, message: '公告已删除' }), { status: 200, headers });
  }

  return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
}
