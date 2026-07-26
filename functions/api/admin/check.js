/**
 * GET /api/admin/check — 当前用户是否为 staff（admin 或 sub_admin）
 * 
 * 返回用户的信息和角色，前端根据 role 调整 UI
 */
import { getAuthUser, isStaff } from '../_auth.js';

export { getAuthUser, isStaff };

export async function onRequest(context) {
  const { request, env } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  const user = await getAuthUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: '未登录' }), { status: 401, headers });
  }
  if (user.role !== 'admin' && user.role !== 'sub_admin') {
    return new Response(JSON.stringify({ error: '需要管理员权限', role: user.role }), { status: 403, headers });
  }

  return new Response(JSON.stringify({ ok: true, user: { id: user.id, username: user.username, email: user.email, role: user.role } }), { status: 200, headers });
}
