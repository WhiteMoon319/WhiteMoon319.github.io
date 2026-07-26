/**
 * POST /api/auth/logout
 * 登出，清除 session
 */
export async function onRequest(context) {
  const { request, env } = context;
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
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

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...headers, 'Set-Cookie': clearCookie }
  });
}
