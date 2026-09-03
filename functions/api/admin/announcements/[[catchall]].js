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
import {createNotification, notifyAllUsers, json, err, handleAsync} from '../../_auth.js';

export const onRequest = handleAsync(async (context) => {
  const { request, env } = context;


  const staff = await isStaff(request, env);
  if (!staff) {
    return err('需要管理员权限', 403);
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

    return json({ ok: true, announcements: rows.results || [] });
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
      return err('公告不存在', 404);
    }
    return json({ ok: true, announcement: ann });
  }

  // POST /api/admin/announcements — 创建
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const title = (body.title || '').trim();
      if (!title) {
        return err('公告标题不能为空', 400);
      }

      // 校验 link 必须为空或以 https:// 或 / 开头
      const link = (body.link || '').trim();
      if (link && !link.startsWith('https://') && !link.startsWith('/')) {
        return err('链接必须以 https:// 开头或为站内路径', 400);
      }

      // 写入 announcements 表
      const result = await env.DB.prepare(
        "INSERT INTO announcements (title, body, link, created_by) VALUES (?, ?, ?, ?)"
      ).bind(title, body.content || '', link, staff.id).run();

      const newId = result.meta.last_row_id;

      // 通知所有用户
      await notifyAllUsers(env, 'system', title, body.content || '', link);

      return json({ ok: true, id: newId, message: '公告已发布' }, 201);
    } catch (e) {
      console.error(e);
      return err('请求数据无效', 400);
    }
  }

  // PUT /api/admin/announcements/:id — 编辑
  if (request.method === 'PUT' && annId) {
    try {
      const body = await request.json();
      const title = (body.title || '').trim();
      if (!title) {
        return err('公告标题不能为空', 400);
      }

      // 校验 link
      const link = (body.link || '').trim();
      if (link && !link.startsWith('https://') && !link.startsWith('/')) {
        return err('链接必须以 https:// 开头或为站内路径', 400);
      }

      // 检查公告存在（查询全部字段用于后续更新通知）
      const existing = await env.DB.prepare('SELECT id, title, body, link FROM announcements WHERE id = ?').bind(annId).first();
      if (!existing) {
        return err('公告不存在', 404);
      }

      // 更新 announcements 表
      await env.DB.prepare(
        "UPDATE announcements SET title = ?, body = ?, link = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(title, body.content || '', link, annId).run();

      // 更新所有已发送的通知（type=system，匹配原标题/内容）
      await env.DB.prepare(
        "UPDATE notifications SET title = ?, body = ?, link = ? WHERE type = 'system' AND title = ? AND body = ? AND link = ?"
      ).bind(title, body.content || '', link, existing.title || '', existing.body || '', existing.link || '').run();

      return json({ ok: true, message: '公告已更新' });
    } catch (e) {
      console.error(e);
      return err('请求数据无效', 400);
    }
  }

  // DELETE /api/admin/announcements/:id — 删除
  if (request.method === 'DELETE' && annId) {
    // 获取公告信息
    const ann = await env.DB.prepare('SELECT id, title, body, link FROM announcements WHERE id = ?').bind(annId).first();
    if (!ann) {
      return err('公告不存在', 404);
    }

    // 删除所有相关的用户通知
    await env.DB.prepare(
      "DELETE FROM notifications WHERE type = 'system' AND title = ? AND body = ? AND link = ?"
    ).bind(ann.title, ann.body || '', ann.link || '').run();

    // 删除公告记录
    await env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(annId).run();

    return json({ ok: true, message: '公告已删除' });
  }

  return err('方法不允许', 405);
});
