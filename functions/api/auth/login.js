/**
 * POST /api/auth/login
 * 登录，设置 session cookie
 * Body: { email, password }
 */
import { verifyPassword } from './crypto.js';
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

  // IP 频率限制：每分钟最多 10 次登录尝试
  const limit = await checkRateLimit(request, env, 'login', 10, 1);
  if (!limit.ok) {
    return new Response(JSON.stringify({ error: limit.error }), {
      status: 429, headers: { ...headers, 'Retry-After': '60' }
    });
  }

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: '请输入邮箱和密码' }), { status: 400, headers });
    }

    // 查找用户
    const user = await env.DB.prepare('SELECT id, username, password_hash FROM users WHERE email = ?').bind(email).first();
    if (!user) {
      return new Response(JSON.stringify({ error: '邮箱或密码错误' }), { status: 401, headers });
    }

    // 验证密码
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return new Response(JSON.stringify({ error: '邮箱或密码错误' }), { status: 401, headers });
    }

    // 生成 session（7天有效期），先作废旧会话防会话固定
    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run();
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await env.DB.prepare(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(user.id, token, expiresAt).run();

    // URL 的 origin，用于 cookie domain
    const url = new URL(request.url);
    const isSecure = url.protocol === 'https:';

    const cookie = `yhg_session=${token}; Path=/; HttpOnly; SameSite=Strict${isSecure ? '; Secure' : ''}; Max-Age=604800`;

    return new Response(JSON.stringify({
      ok: true,
      user: { id: user.id, username: user.username, email }
    }), {
      status: 200,
      headers: {
        ...headers,
        'Set-Cookie': cookie
      }
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers });
  }
}
