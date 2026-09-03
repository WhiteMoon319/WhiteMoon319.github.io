/**
 * PUT /api/auth/profile — 修改昵称/头像（需登录）
 *   body: { username?: string, avatar?: string }
 *   username 不可与已有用户重复
 *   avatar 可以是 https:// URL 或 data:image/(png|jpeg|webp) base64
 */
import {getToken, getUserFromToken, json, err, handleAsync} from '../_auth.js';

export const onRequest = handleAsync(async (context) => {
  const { request, env } = context;


  if (request.method !== 'PUT') {
    return err('仅支持 PUT', 405);
  }

  const token = getToken(request);
  if (!token) {
    return err('请先登录', 401);
  }

  const user = await getUserFromToken(token, env);
  if (!user) {
    return err('会话已过期', 401);
  }

  try {
    const body = await request.json();
    const updates = [];

    // 昵称修改
    if (body.username !== undefined) {
      const newName = (body.username || '').trim();
      if (!newName || newName.length < 1 || newName.length > 20) {
        return err('昵称长度需在1-20字符之间', 400);
      }

      // 检查唯一性（排除自己）
      const existing = await env.DB.prepare(
        'SELECT id FROM users WHERE username = ? AND id != ?'
      ).bind(newName, user.id).first();
      if (existing) {
        return err('该昵称已被使用', 409);
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
        return err('头像必须是 https 链接或图片上传', 400);
      }
      // data:image base64 限制 512KB，https URL 限制 1024 字符
      if (isDataImage && avatar.length > 512 * 1024) {
        return err('图片过大（最大 512KB）', 400);
      }
      if (isHttps && avatar.length > 1024) {
        return err('头像地址过长', 400);
      }
      // https URL 不能包含危险字符
      if (isHttps && /["'<>\s]/.test(avatar)) {
        return err('头像地址包含非法字符', 400);
      }
      await env.DB.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(avatar, user.id).run();
      updates.push('avatar');
    }

    if (updates.length === 0) {
      return err('没有要更新的字段', 400);
    }

    return json({ ok: true, updated: updates });
  } catch (e) {
    return err('请求数据无效', 400);
  }
});
