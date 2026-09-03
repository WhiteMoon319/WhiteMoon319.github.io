
import {json, err, handleAsync} from '../_auth.js';
/**
 * POST /api/auth/logout
 * 登出，清除 session
 */
export const onRequest = handleAsync(async (context) => {
  const { request, env } = context;


  if (request.method !== 'POST') {
    return err('方法不允许', 405);
  }

  // 取 cookie
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/yhg_session=([^;]+)/);
  const token = match ? match[1] : null;

  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }

  // 清除 cookie
  const clearCookie = 'yhg_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';

  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie  });
});
