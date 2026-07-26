/**
 * GET    /api/news/:slug/comments        — 文章评论列表
 * POST   /api/news/:slug/comments        — 发表评论（需登录）
 * DELETE /api/news/:slug/comments/:id    — 删除评论（作者或 admin/sub_admin）
 */
import { getAuthUser } from '../../../_auth.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  // 从 URL 提取 slug 和目标 comment id
  const url = new URL(request.url);
  const segments = url.pathname.replace(/\/$/, '').split('/');
  const slug = params.slug;

  // 找 comment id：/api/news/:slug/comments/123
  let commentId = null;
  const last = segments[segments.length - 1];
  if (last && last !== 'comments' && !isNaN(parseInt(last))) {
    commentId = parseInt(last);
  }

  // 查文章
  const article = await env.DB.prepare('SELECT id FROM articles WHERE slug = ?').bind(slug).first();
  if (!article) {
    return new Response(JSON.stringify({ error: '文章不存在' }), { status: 404, headers });
  }

  if (request.method === 'GET' && !commentId) {
    return handleList(article.id, env, headers);
  }

  if (request.method === 'POST' && !commentId) {
    return handleCreate(article.id, request, env, headers);
  }

  if (request.method === 'DELETE' && commentId) {
    return handleDelete(article.id, commentId, request, env, headers);
  }

  return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
}

async function handleList(articleId, env, headers) {
  const comments = await env.DB.prepare(`
    SELECT c.id, c.content, c.created_at, u.id as user_id, u.username, u.avatar
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.article_id = ?
    ORDER BY c.created_at ASC
  `).bind(articleId).all();

  return new Response(JSON.stringify({ ok: true, comments: comments.results }), { status: 200, headers });
}

async function handleCreate(articleId, request, env, headers) {
  const user = await getAuthUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: '请先登录' }), { status: 401, headers });
  }

  try {
    const body = await request.json();
    const content = (body.content || '').trim();
    if (!content) {
      return new Response(JSON.stringify({ error: '评论内容不能为空' }), { status: 400, headers });
    }

    const result = await env.DB.prepare(
      'INSERT INTO comments (article_id, user_id, content) VALUES (?, ?, ?)'
    ).bind(articleId, user.id, content).run();

    return new Response(JSON.stringify({ ok: true, id: result.meta.last_row_id }), { status: 201, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求数据无效' }), { status: 400, headers });
  }
}

async function handleDelete(articleId, commentId, request, env, headers) {
  const user = await getAuthUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: '请先登录' }), { status: 401, headers });
  }

  const comment = await env.DB.prepare(
    'SELECT id, user_id FROM comments WHERE id = ? AND article_id = ?'
  ).bind(commentId, articleId).first();

  if (!comment) {
    return new Response(JSON.stringify({ error: '评论不存在' }), { status: 404, headers });
  }

  // 仅作者或 admin/sub_admin 可删
  const isStaffUser = user.role === 'admin' || user.role === 'sub_admin';
  if (comment.user_id !== user.id && !isStaffUser) {
    return new Response(JSON.stringify({ error: '无权删除' }), { status: 403, headers });
  }

  await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run();
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
