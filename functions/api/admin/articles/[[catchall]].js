/**
 * YHG Admin Articles API — 管理文章 + 公告
 *
 * GET    /api/admin/articles                     — 所有文章列表
 * DELETE /api/admin/articles/:slug               — 删除文章
 * PUT    /api/admin/articles/:slug/status         — 审核文章（approved/rejected）
 * POST   /api/admin/articles/announcement         — 发布系统公告（发送给所有用户）
 */
import { isStaff } from '../check.js';
import { createNotification, notifyAllUsers } from '../../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  const staff = await isStaff(request, env);
  if (!staff) {
    return new Response(JSON.stringify({ error: '需要管理员权限' }), { status: 403, headers });
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.replace(/\/$/, '').split('/');

  const articlesIdx = pathParts.indexOf('articles');
  const slug = (articlesIdx >= 0 && pathParts.length > articlesIdx + 1) ? pathParts[articlesIdx + 1] : null;
  const action = (articlesIdx >= 0 && pathParts.length > articlesIdx + 2) ? pathParts[articlesIdx + 2] : null;

  // POST /api/admin/articles/announcement — 发布公告
  if (request.method === 'POST' && pathParts[pathParts.length - 1] === 'announcement') {
    return handleAnnouncement(request, env, headers, staff);
  }

  if (request.method === 'GET') {
    return handleList(env, headers);
  }

  // PUT /api/admin/articles/:slug/status — 审核
  if (request.method === 'PUT' && action === 'status' && slug) {
    return handleStatusUpdate(slug, request, env, headers);
  }

  // DELETE /api/admin/articles/:slug — 删除
  if (request.method === 'DELETE' && slug) {
    return handleDelete(slug, env, headers);
  }

  return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
}

async function handleList(env, headers) {
  const articles = await env.DB.prepare(
    "SELECT a.id, a.title, a.slug, a.status, a.created_at, u.username FROM articles a JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC"
  ).all();
  return new Response(JSON.stringify({ ok: true, articles: articles.results }), { status: 200, headers });
}

async function handleStatusUpdate(slug, request, env, headers) {
  try {
    const body = await request.json();
    if (!['approved', 'rejected'].includes(body.status)) {
      return new Response(JSON.stringify({ error: '状态仅支持 approved 或 rejected' }), { status: 400, headers });
    }

    // 获取文章信息（含作者）
    const article = await env.DB.prepare(
      'SELECT a.id, a.title, a.user_id, u.username FROM articles a JOIN users u ON u.id = a.user_id WHERE a.slug = ?'
    ).bind(slug).first();

    if (!article) {
      return new Response(JSON.stringify({ error: '文章不存在' }), { status: 404, headers });
    }

    await env.DB.prepare(
      "UPDATE articles SET status = ?, updated_at = datetime('now') WHERE slug = ?"
    ).bind(body.status, slug).run();

    // 发送通知
    const notifType = body.status === 'approved' ? 'article_approved' : 'article_rejected';
    const title = body.status === 'approved'
      ? '文章《' + article.title + '》已通过审核'
      : '文章《' + article.title + '》未通过审核';

    await createNotification(
      env, article.user_id, notifType,
      title,
      body.status === 'approved' ? '你的文章已发布' : '请修改后重新提交',
      '/news/article.html?slug=' + slug,
      article.id
    );

    return new Response(JSON.stringify({ ok: true, status: body.status }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求数据无效' }), { status: 400, headers });
  }
}

async function handleDelete(slug, env, headers) {
  await env.DB.prepare('DELETE FROM articles WHERE slug = ?').bind(slug).run();
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

async function handleAnnouncement(request, env, headers, staff) {
  try {
    const body = await request.json();
    const title = (body.title || '').trim();
    const content = (body.content || '').trim();

    if (!title) {
      return new Response(JSON.stringify({ error: '公告标题不能为空' }), { status: 400, headers });
    }

    // 校验 link 必须为空或以 https:// 或 / 开头
    const link = (body.link || '').trim();
    if (link && !link.startsWith('https://') && !link.startsWith('/')) {
      return new Response(JSON.stringify({ error: '链接必须以 https:// 开头或为站内路径' }), { status: 400, headers });
    }

    // 写入 announcements 表
    const result = await env.DB.prepare(
      "INSERT INTO announcements (title, body, link, created_by) VALUES (?, ?, ?, ?)"
    ).bind(title, content, link, staff.id).run();

    // 发送给所有用户
    await notifyAllUsers(env, 'system', title, content, link);

    return new Response(JSON.stringify({ ok: true, id: result.meta.last_row_id, message: '公告已发布' }), { status: 200, headers });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: '请求数据无效' }), { status: 400, headers });
  }
}
