/**
 * PUT /api/auth/profile — 修改昵称/头像（需登录）
 *   body: { username?: string, avatar?: string }
 *   username 不可与已有用户重复
 *   avatar 可以是 https:// URL 或 data:image/(png|jpeg|webp) base64
 */
import { getToken } from '../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  if (request.method !== 'PUT') {
    return new Response(JSON.stringify({ error: '仅支持 PUT' }), { status: 405, headers });
  }

  const token = getToken(request);
  if (!token) {
    return new Response(JSON.stringify({ error: '请先登录' }), { status: 401, headers });
  }

  const user = await env.DB.prepare(
    'SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
  ).bind(token).first();
  if (!user) {
    return new Response(JSON.stringify({ error: '会话已过期' }), { status: 401, headers });
  }

  try {
    const body = await request.json();
    const updates = [];

    // 昵称修改
    if (body.username !== undefined) {
      const newName = (body.username || '').trim();
      if (!newName || newName.length < 1 || newName.length > 20) {
        return new Response(JSON.stringify({ error: '昵称长度需在1-20字符之间' }), { status: 400, headers });
      }

      // 检查唯一性（排除自己）
      const existing = await env.DB.prepare(
        'SELECT id FROM users WHERE username = ? AND id != ?'
      ).bind(newName, user.id).first();
      if (existing) {
        return new Response(JSON.stringify({ error: '该昵称已被使用' }), { status: 409, headers });
      }

      await env.DB.prepare('UPDATE users SET username = ? WHERE id = ?').bind(newName, user.id).run();
      updates.push('username');
    }

    // 头像修改
    if (body.avatar !== undefined) {
      const avatar = (body.avatar || '').trim();
      // 允许 https:// URL 或 data:image/(png|jpeg|webp) base64
      const isHttps = avatar.startsWith('https://');
      const isDataImage = /^data:image\/(png|jpeg|webp);base64,/.test(avatar);
      if (avatar && !isHttps && !isDataImage) {
        return new Response(JSON.stringify({ error: '头像必须是 https 链接或图片上传' }), { status: 400, headers });
      }
      // data:image base64 限制 512KB，https URL 限制 1024 字符
      if (isDataImage && avatar.length > 512 * 1024) {
        return new Response(JSON.stringify({ error: '图片过大（最大 512KB）' }), { status: 400, headers });
      }
      if (isHttps && avatar.length > 1024) {
        return new Response(JSON.stringify({ error: '头像地址过长' }), { status: 400, headers });
      }
      // https URL 不能包含危险字符
      if (isHttps && /["'<>\s]/.test(avatar)) {
        return new Response(JSON.stringify({ error: '头像地址包含非法字符' }), { status: 400, headers });
      }
      await env.DB.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(avatar, user.id).run();
      updates.push('avatar');
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: '没有要更新的字段' }), { status: 400, headers });
    }

    return new Response(JSON.stringify({ ok: true, updated: updates }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求数据无效' }), { status: 400, headers });
  }
}
