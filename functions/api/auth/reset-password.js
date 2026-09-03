/**
 * POST /api/auth/reset-password
 * 验证码校验 + 重置密码
 * Body: { email, code, password }
 */
import { createPasswordHash } from './crypto.js';
import {checkRateLimit, json, err, handleAsync} from '../_auth.js';

export const onRequest = handleAsync(async (context) => {
  const { request, env } = context;


  if (request.method !== 'POST') {
    return err('方法不允许', 405);
  }

  // IP 频率限制：每分钟最多 5 次重置尝试
  const limit = await checkRateLimit(request, env, 'reset-password', 5, 1);
  if (!limit.ok) {
    return err(limit.error, 429, { 'Retry-After': '60' });
  }

  try {
    const { email, code, password } = await request.json();
    if (!email || !code || !password) {
      return err('请填写完整信息', 400);
    }
    if (password.length < 8) {
      return err('密码至少8位', 400);
    }

    // 验证码校验
    const vcode = await env.DB.prepare(
      "SELECT id FROM verification_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1"
    ).bind(email, code).first();

    if (!vcode) {
      // 按邮箱限次：失败即消耗，10 分钟最多 5 次，换 IP 无法绕过
      await checkRateLimit(request, env, 'vcode-reset', 5, 10, email);
      return err('验证码无效或已过期', 400);
    }

    // 标记已使用
    await env.DB.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').bind(vcode.id).run();

    // 更新密码
    const passwordHash = await createPasswordHash(password);
    await env.DB.prepare('UPDATE users SET password_hash = ? WHERE email = ?').bind(passwordHash, email).run();

    // 清除该用户的所有会话（强制重新登录）
    await env.DB.prepare(
      'DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = ?)'
    ).bind(email).run();

    return json({ ok: true, message: '密码已重置' });
  } catch (e) {
    console.error(e);
    return err('服务器错误', 500);
  }
});
