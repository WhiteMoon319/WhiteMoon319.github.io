/**
 * POST /api/auth/register
 * 注册新用户（需要邮箱验证码）
 * Body: { email, code, username, password }
 */
import { createPasswordHash } from './crypto.js';
import { checkRateLimit } from '../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
  }

  // IP 频率限制：每分钟最多 5 次注册尝试
  const limit = await checkRateLimit(request, env, 'register', 5, 1);
  if (!limit.ok) {
    return new Response(JSON.stringify({ error: limit.error }), {
      status: 429, headers: { ...headers, 'Retry-After': '60' }
    });
  }

  try {
    const { email, code, username, password } = await request.json();

    // 校验
    if (!email || !code || !username || !password) {
      return new Response(JSON.stringify({ error: '请填写完整信息' }), { status: 400, headers });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: '密码至少6位' }), { status: 400, headers });
    }
    if (username.length < 2 || username.length > 20) {
      return new Response(JSON.stringify({ error: '用户名2~20个字符' }), { status: 400, headers });
    }

    // 验证邮箱验证码
    const vcode = await env.DB.prepare(
      "SELECT id FROM verification_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1"
    ).bind(email, code).first();

    if (!vcode) {
      return new Response(JSON.stringify({ error: '验证码无效或已过期' }), { status: 400, headers });
    }

    // 标记验证码已使用
    await env.DB.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').bind(vcode.id).run();

    // 检查邮箱是否已注册
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) {
      return new Response(JSON.stringify({ error: '该邮箱已注册' }), { status: 409, headers });
    }

    // 创建用户（默认 Lv.1）
    const passwordHash = await createPasswordHash(password);
    await env.DB.prepare(
      'INSERT INTO users (email, username, password_hash, level) VALUES (?, ?, ?, 1)'
    ).bind(email, username, passwordHash).run();

    return new Response(JSON.stringify({ ok: true, message: '注册成功' }), { status: 201, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers });
  }
}
