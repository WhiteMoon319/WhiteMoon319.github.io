/**
 * POST /api/auth/reset-password
 * 验证码校验 + 重置密码
 * Body: { email, code, password }
 */
import { createPasswordHash } from './crypto.js';

export async function onRequest(context) {
  const { request, env } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
  }

  try {
    const { email, code, password } = await request.json();
    if (!email || !code || !password) {
      return new Response(JSON.stringify({ error: '请填写完整信息' }), { status: 400, headers });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: '密码至少6位' }), { status: 400, headers });
    }

    // 验证码校验
    const vcode = await env.DB.prepare(
      "SELECT id FROM verification_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1"
    ).bind(email, code).first();

    if (!vcode) {
      return new Response(JSON.stringify({ error: '验证码无效或已过期' }), { status: 400, headers });
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

    return new Response(JSON.stringify({ ok: true, message: '密码已重置' }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers });
  }
}
