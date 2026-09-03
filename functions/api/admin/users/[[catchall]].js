/**
 * GET    /api/admin/users[/:id] — 用户列表（含多选手绑定）
 * DELETE /api/admin/users/:id — 删除用户（仅 admin）
 * PUT    /api/admin/users/:id — 绑定选手 { player_slugs: ["slug1", "slug2"] }
 * 
 * admin 拥有全部权限，sub_admin 只能查看和绑定，不能删除用户
 */
;
import {isStaff, getAuthUser, json, err, handleAsync} from '../../_auth.js';

export const onRequest = handleAsync(async (context) => {
  const { request, env } = context;


  const staff = await isStaff(request, env);
  if (!staff) {
    return err('需要管理员权限', 403);
  }

  const method = request.method;
  const url = new URL(request.url);
  const segments = url.pathname.replace(/\/$/, '').split('/');
  const targetId = segments[segments.length - 1];

  if (method === 'GET') {
    return handleList(env);
  }

  // 删除用户仅限 admin
  if (method === 'DELETE' && targetId && targetId !== 'users') {
    if (staff.role !== 'admin') {
      return err('仅超级管理员可删除用户', 403);
    }
    return handleDelete(targetId, staff, env);
  }

  // 绑定选手允许 admin 和 sub_admin
  if (method === 'PUT' && targetId && targetId !== 'users') {
    // PUT /api/admin/users/:id/role — 修改角色（仅 admin）
    if (segments.length >= 2 && segments[segments.length - 1] === 'role') {
      if (staff.role !== 'admin') {
        return err('仅超级管理员可修改角色', 403);
      }
      return handleSetRole(segments[segments.length - 2], request, env);
    }
    // PUT /api/admin/users/:id/level — 提升等级（admin/sub_admin 均可）
    if (segments.length >= 2 && segments[segments.length - 1] === 'level') {
      return handleSetLevel(segments[segments.length - 2], request, env);
    }
    // PUT /api/admin/users/:id — 绑定选手
    return handleBind(targetId, request, env);
  }

  return err('方法不允许', 405);
});

async function handleList(env) {
  const users = await env.DB.prepare(
    'SELECT id, email, username, role, level, player_slug, created_at FROM users ORDER BY id'
  ).all();

  // 为每个用户查询多选手绑定
  for (const u of users.results) {
    const bindings = await env.DB.prepare(
      'SELECT player_slug FROM player_bindings WHERE user_id = ?'
    ).bind(u.id).all();
    u.bound_players = (bindings.results || []).map(b => b.player_slug);
  }

  return json({ ok: true, users: users.results });
}

async function handleDelete(targetId, staff, env) {
  const id = parseInt(targetId);
  if (isNaN(id)) {
    return err('无效用户ID', 400);
  }
  if (id === staff.id) {
    return err('不能删除自己', 400);
  }

  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM player_bindings WHERE user_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

async function handleBind(targetId, request, env) {
  try {
    const body = await request.json();
    const userId = parseInt(targetId);

    // 接收 player_slugs 数组，替换全部绑定
    const slugs = Array.isArray(body.player_slugs) ? body.player_slugs : [];

    // 先删旧绑定
    await env.DB.prepare('DELETE FROM player_bindings WHERE user_id = ?').bind(userId).run();

    // 插入新绑定
    for (const slug of slugs) {
      if (slug && typeof slug === 'string') {
        await env.DB.prepare(
          'INSERT OR IGNORE INTO player_bindings (user_id, player_slug) VALUES (?, ?)'
        ).bind(userId, slug).run();
      }
    }

    return json({ ok: true });
  } catch (e) {
    return err('请求数据无效', 400);
  }
}

async function handleSetRole(rawId, request, env) {
  try {
    const userId = parseInt(rawId);
    if (isNaN(userId)) {
      return err('无效用户ID', 400);
    }

    const body = await request.json();
    const newRole = body.role;

    if (!newRole || !['sub_admin', 'user'].includes(newRole)) {
      return err('无效角色，仅支持 sub_admin 或 user', 400);
    }

    await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(newRole, userId).run();
    return json({ ok: true, role: newRole });
  } catch (e) {
    return err('请求数据无效', 400);
  }
}

async function handleSetLevel(rawId, request, env) {
  try {
    const userId = parseInt(rawId);
    if (isNaN(userId)) {
      return err('无效用户ID', 400);
    }
    const body = await request.json();
    const level = parseInt(body.level);
    if (![1, 2].includes(level)) {
      return err('无效等级，仅支持 1 或 2', 400);
    }
    await env.DB.prepare('UPDATE users SET level = ? WHERE id = ?').bind(level, userId).run();
    return json({ ok: true, level });
  } catch (e) {
    return err('请求数据无效', 400);
  }
}
