/**
 * GET    /api/admin/articles       — 所有文章（含 pending，带状态）
 * DELETE /api/admin/articles/:slug — 删除任意文章
 * PUT    /api/admin/articles/:slug/status — 审核文章
 */
import { isStaff } from '../check.js';

export async function onRequest(context) {
  const { request, env } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  const staff = await isStaff(request, env);
  if (!staff) {
    return new Response(JSON.stringify({ error: '需要管理员权限' }), { status: 403, headers });
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.replace(/\/$/, '').split('/');
  
  // 提取 slug 和 action
  // /api/admin/articles             → parts: [api, admin, articles]
  // /api/admin/articles/foo         → parts: [api, admin, articles, foo]
  // /api/admin/articles/foo/status  → parts: [api, admin, articles, foo, status]
  const articlesIdx = pathParts.indexOf('articles');
  const slug = (articlesIdx >= 0 && pathParts.length > articlesIdx + 1) ? pathParts[articlesIdx + 1] : null;
  const action = (articlesIdx >= 0 && pathParts.length > articlesIdx + 2) ? pathParts[articlesIdx + 2] : null;

  if (request.method === 'GET') {
    // 列表，包含所有状态
    const articles = await env.DB.prepare(
      "SELECT a.id, a.title, a.slug, a.status, a.created_at, u.username FROM articles a JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC"
    ).all();
    return new Response(JSON.stringify({ ok: true, articles: articles.results }), { status: 200, headers });
  }

  // PUT /api/admin/articles/:slug/status — 审核
  if (request.method === 'PUT' && action === 'status' && slug) {
    const articleSlug = pathParts[pathParts.length - 2];
    try {
      const body = await request.json();
      if (!['approved', 'rejected'].includes(body.status)) {
        return new Response(JSON.stringify({ error: '状态仅支持 approved 或 rejected' }), { status: 400, headers });
      }
      await env.DB.prepare(
        "UPDATE articles SET status = ?, updated_at = datetime('now') WHERE slug = ?"
      ).bind(body.status, articleSlug).run();
      return new Response(JSON.stringify({ ok: true, status: body.status }), { status: 200, headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: '请求数据无效' }), { status: 400, headers });
    }
  }

  // DELETE /api/admin/articles/:slug — 删除
  if (request.method === 'DELETE' && slug) {
    await env.DB.prepare('DELETE FROM articles WHERE slug = ?').bind(slug).run();
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
}
