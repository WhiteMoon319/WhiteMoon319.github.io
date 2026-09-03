/**
 * GET /api/admin/check — 当前用户是否为 staff（admin 或 sub_admin）
 * 
 * 返回用户的信息和角色，前端根据 role 调整 UI
 */
import {getAuthUser, isStaff, json, err, handleAsync} from '../_auth.js';

export { getAuthUser, isStaff };

export const onRequest = handleAsync(async (context) => {
  const { request, env } = context;


  const user = await getAuthUser(request, env);
  if (!user) {
    return err('未登录', 401);
  }
  if (user.role !== 'admin' && user.role !== 'sub_admin') {
    return json({ error: '需要管理员权限', role: user.role }, 403);
  }

  return json({ ok: true, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
});
