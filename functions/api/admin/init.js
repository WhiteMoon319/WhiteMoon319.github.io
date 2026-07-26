/**
 * POST /api/admin/init — 初始化管理员账号（仅首次可用）
 * 从环境变量读取 ADMIN_EMAIL / ADMIN_PASSWORD，创建 admin 用户
 * 首次初始化后自动禁用本端点（通过 home_sections 标记），不可重放
 */
import { createPasswordHash } from '../auth/crypto.js';

export async function onRequest(context) {
  const { request, env } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
  }

  // 检查是否已初始化（即使 admin 用户被删也不可重放）
  const initFlag = await env.DB.prepare(
    "SELECT id FROM home_sections WHERE section_key = ?"
  ).bind('init_complete').first();
  if (initFlag) {
    return new Response(JSON.stringify({ error: '初始化已完成，本端点已永久禁用' }), { status: 410, headers });
  }

  // 检查是否已有 admin（双重防护）
  const existing = await env.DB.prepare('SELECT id FROM users WHERE role = ?').bind('admin').first();
  if (existing) {
    return new Response(JSON.stringify({ error: '管理员已存在' }), { status: 400, headers });
  }

  const adminEmail = env.ADMIN_EMAIL;
  const adminPassword = env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return new Response(JSON.stringify({ error: '请在 Cloudflare Pages 环境变量中设置 ADMIN_EMAIL 和 ADMIN_PASSWORD' }), { status: 500, headers });
  }

  const hash = await createPasswordHash(adminPassword);
  await env.DB.prepare(
    'INSERT INTO users (email, username, password_hash, role) VALUES (?, ?, ?, ?)'
  ).bind(adminEmail, 'Admin', hash, 'admin').run();

  // 写入初始化完成标记，永久禁用本端点
  await env.DB.prepare(
    'INSERT INTO home_sections (section_key, content) VALUES (?, ?)'
  ).bind('init_complete', '1').run();

  return new Response(JSON.stringify({ ok: true, message: '管理员账号已创建，初始化端点已自动永久禁用' }), { status: 201, headers });
}
