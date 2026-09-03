/**
 * POST /api/auth/register
 * 注册新用户（需要邮箱验证码）
 * Body: { email, code, username, password }
 */
import { createPasswordHash } from './crypto.js';
import {checkRateLimit, json, err, handleAsync} from '../_auth.js';

export const onRequest = handleAsync(async (context) => {
  const { request, env } = context;


  if (request.method !== 'POST') {
    return err('方法不允许', 405);
  }

  // IP 频率限制：每分钟最多 5 次注册尝试
  const limit = await checkRateLimit(request, env, 'register', 5, 1);
  if (!limit.ok) {
    return err(limit.error, 429, { 'Retry-After': '60' });
  }

  try {
    const { email, code, username, password } = await request.json();

    // 校验
    if (!email || !code || !username || !password) {
      return err('请填写完整信息', 400);
    }
    if (password.length < 8) {
      return err('密码至少8位', 400);
    }
    if (username.length < 2 || username.length > 20) {
      return err('用户名2~20个字符', 400);
    }

    // 验证邮箱验证码
    const vcode = await env.DB.prepare(
      "SELECT id FROM verification_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1"
    ).bind(email, code).first();

    if (!vcode) {
      // 按邮箱限次：失败即消耗，10 分钟最多 5 次，换 IP 无法绕过
      await checkRateLimit(request, env, 'vcode-register', 5, 10, email);
      return err('验证码无效或已过期', 400);
    }

    // 标记验证码已使用
    await env.DB.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').bind(vcode.id).run();

    // 检查邮箱是否已注册
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) {
      return err('该邮箱已注册', 409);
    }

    // 创建用户（默认 Lv.1）
    const passwordHash = await createPasswordHash(password);
    await env.DB.prepare(
      'INSERT INTO users (email, username, password_hash, level) VALUES (?, ?, ?, 1)'
    ).bind(email, username, passwordHash).run();

    return json({ ok: true, message: '注册成功' }, 201);
  } catch (e) {
    console.error(e);
    return err('服务器错误', 500);
  }
});
