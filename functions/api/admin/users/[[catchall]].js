/**
 * GET    /api/admin/users[/:id] — 用户列表（含多选手绑定）
 * DELETE /api/admin/users/:id — 删除用户（仅 admin）
 * PUT    /api/admin/users/:id — 绑定选手 { player_slugs: ["slug1", "slug2"] }
 * 
 * admin 拥有全部权限，sub_admin 只能查看和绑定，不能删除用户
 */
import { isStaff, getAuthUser } from '../check.js';

export async function onRequest(context) {
  const { request, env } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  const staff = await isStaff(request, env);
  if (!staff) {
    return new Response(JSON.stringify({ error: '需要管理员权限' }), { status: 403, headers });
  }

  const method = request.method;
  const url = new URL(request.url);
  const segments = url.pathname.replace(/\/$/, '').split('/');
  const targetId = segments[segments.length - 1];

  if (method === 'GET') {
    return handleList(env, headers);
  }

  // 删除用户仅限 admin
  if (method === 'DELETE' && targetId && targetId !== 'users') {
    if (staff.role !== 'admin') {
      return new Response(JSON.stringify({ error: '仅超级管理员可删除用户' }), { status: 403, headers });
    }
    return handleDelete(targetId, staff, env, headers);
  }

  // 绑定选手允许 admin 和 sub_admin
  if (method === 'PUT' && targetId && targetId !== 'users') {
    // PUT /api/admin/users/:id/role — 修改角色（仅 admin）
    if (segments.length >= 2 && segments[segments.length - 1] === 'role') {
      if (staff.role !== 'admin') {
        return new Response(JSON.stringify({ error: '仅超级管理员可修改角色' }), { status: 403, headers });
      }
      return handleSetRole(segments[segments.length - 2], request, env, headers);
    }
    // PUT /api/admin/users/:id/level — 提升等级（admin/sub_admin 均可）
    if (segments.length >= 2 && segments[segments.length - 1] === 'level') {
      return handleSetLevel(segments[segments.length - 2], request, env, headers);
    }
    // PUT /api/admin/users/:id — 绑定选手
    return handleBind(targetId, request, env, headers);
  }

  return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
}

async function handleList(env, headers) {
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

  return new Response(JSON.stringify({ ok: true, users: users.results }), { status: 200, headers });
}

async function handleDelete(targetId, staff, env, headers) {
  const id = parseInt(targetId);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: '无效用户ID' }), { status: 400, headers });
  }
  if (id === staff.id) {
    return new Response(JSON.stringify({ error: '不能删除自己' }), { status: 400, headers });
  }

  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM player_bindings WHERE user_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

async function handleBind(targetId, request, env, headers) {
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

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求数据无效' }), { status: 400, headers });
  }
}

async function handleSetRole(rawId, request, env, headers) {
  try {
    const userId = parseInt(rawId);
    if (isNaN(userId)) {
      return new Response(JSON.stringify({ error: '无效用户ID' }), { status: 400, headers });
    }

    const body = await request.json();
    const newRole = body.role;

    if (!newRole || !['sub_admin', 'user'].includes(newRole)) {
      return new Response(JSON.stringify({ error: '无效角色，仅支持 sub_admin 或 user' }), { status: 400, headers });
    }

    await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(newRole, userId).run();
    return new Response(JSON.stringify({ ok: true, role: newRole }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求数据无效' }), { status: 400, headers });
  }
}

async function handleSetLevel(rawId, request, env, headers) {
  try {
    const userId = parseInt(rawId);
    if (isNaN(userId)) {
      return new Response(JSON.stringify({ error: '无效用户ID' }), { status: 400, headers });
    }
    const body = await request.json();
    const level = parseInt(body.level);
    if (![1, 2].includes(level)) {
      return new Response(JSON.stringify({ error: '无效等级，仅支持 1 或 2' }), { status: 400, headers });
    }
    await env.DB.prepare('UPDATE users SET level = ? WHERE id = ?').bind(level, userId).run();
    return new Response(JSON.stringify({ ok: true, level }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求数据无效' }), { status: 400, headers });
  }
}
