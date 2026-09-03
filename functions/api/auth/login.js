/**
 * POST /api/auth/login
 * 登录，设置 session cookie
 * Body: { email, password }
 */
import { verifyPassword } from './crypto.js';
import {checkRateLimit, json, err, handleAsync} from '../_auth.js';

export const onRequest = handleAsync(async (context) => {
  const { request, env } = context;


  if (request.method !== 'POST') {
    return err('方法不允许', 405);
  }

  // IP 频率限制：每分钟最多 10 次登录尝试
  const limit = await checkRateLimit(request, env, 'login', 10, 1);
  if (!limit.ok) {
    return err(limit.error, 429, { 'Retry-After': '60' });
  }

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return err('请输入邮箱和密码', 400);
    }

    // 查找用户
    const user = await env.DB.prepare('SELECT id, username, password_hash FROM users WHERE email = ?').bind(email).first();
    if (!user) {
      return err('邮箱或密码错误', 401);
    }

    // 验证密码
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return err('邮箱或密码错误', 401);
    }

    // 生成 session（7天有效期），支持多设备同时在线
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await env.DB.prepare(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(user.id, token, expiresAt).run();

    // URL 的 origin，用于 cookie domain
    const url = new URL(request.url);
    const isSecure = url.protocol === 'https:';

    const cookie = `yhg_session=${token}; Path=/; HttpOnly; SameSite=Strict${isSecure ? '; Secure' : ''}; Max-Age=604800`;

    return json({ ok: true, user: { id: user.id, username: user.username, email } }, 200, { 'Set-Cookie': cookie });
  } catch (e) {
    console.error(e);
    return err('服务器错误', 500);
  }
});
