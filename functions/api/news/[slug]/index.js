/**
 * GET    /api/news/:slug  — 获取单篇文章（含点赞数，仅 approved 或作者/staff 可见）
 * PUT    /api/news/:slug  — 编辑文章（作者或 staff）
 * DELETE /api/news/:slug  — 删除文章（需登录 + 作者）
 */
import { getToken, getAuthUser } from '../../_auth.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const slug = params.slug;

  if (!slug) {
    return new Response(JSON.stringify({ error: '缺少 slug' }), { status: 400, headers });
  }

  if (request.method === 'GET') {
    return handleGet(slug, request, env, headers);
  }

  if (request.method === 'PUT') {
    return handlePut(slug, request, env, headers);
  }

  if (request.method === 'DELETE') {
    return handleDelete(slug, request, env, headers);
  }

  return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
}

async function handleGet(slug, request, env, headers) {
  const article = await env.DB.prepare(
    'SELECT a.*, u.username FROM articles a JOIN users u ON u.id = a.user_id WHERE a.slug = ?'
  ).bind(slug).first();

  if (!article) {
    return new Response(JSON.stringify({ error: '文章不存在' }), { status: 404, headers });
  }

  // 权限检查：仅 approved 或作者/staff 可查看
  if (article.status !== 'approved') {
    const user = await getAuthUser(request, env);
    const isStaff = user && (user.role === 'admin' || user.role === 'sub_admin');
    const isAuthor = user && user.id === article.user_id;
    if (!isAuthor && !isStaff) {
      return new Response(JSON.stringify({ error: '文章待审核' }), { status: 403, headers });
    }
  }

  // 点赞数
  const likeCount = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM article_likes WHERE article_id = ?'
  ).bind(article.id).first();
  article.like_count = likeCount ? likeCount.cnt : 0;

  // 当前用户是否已点赞
  article.liked_by_me = false;
  const user = await getAuthUser(request, env);
  if (user) {
    const liked = await env.DB.prepare(
      'SELECT 1 FROM article_likes WHERE article_id = ? AND user_id = ?'
    ).bind(article.id, user.id).first();
    article.liked_by_me = !!liked;
  }

  return new Response(JSON.stringify({ ok: true, article }), { status: 200, headers });
}

async function handlePut(slug, request, env, headers) {
  const user = await getAuthUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: '请先登录' }), { status: 401, headers });
  }

  const article = await env.DB.prepare('SELECT user_id FROM articles WHERE slug = ?').bind(slug).first();
  if (!article) {
    return new Response(JSON.stringify({ error: '文章不存在' }), { status: 404, headers });
  }

  const isStaff = user.role === 'admin' || user.role === 'sub_admin';
  if (article.user_id !== user.id && !isStaff) {
    return new Response(JSON.stringify({ error: '无权编辑此文章' }), { status: 403, headers });
  }

  try {
    const { title, summary, content } = await request.json();
    if (!title || !content) {
      return new Response(JSON.stringify({ error: '标题和内容不能为空' }), { status: 400, headers });
    }
    if (title.length > 120) {
      return new Response(JSON.stringify({ error: '标题最长120字' }), { status: 400, headers });
    }

    await env.DB.prepare(
      "UPDATE articles SET title = ?, summary = ?, content = ?, updated_at = datetime('now') WHERE slug = ?"
    ).bind(title, summary || '', content.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''), slug).run();

    return new Response(JSON.stringify({ ok: true, slug }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求数据无效' }), { status: 400, headers });
  }
}

async function handleDelete(slug, request, env, headers) {
  const user = await getAuthUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: '请先登录' }), { status: 401, headers });
  }

  const article = await env.DB.prepare('SELECT user_id FROM articles WHERE slug = ?').bind(slug).first();
  if (!article) {
    return new Response(JSON.stringify({ error: '文章不存在' }), { status: 404, headers });
  }

  const isStaff = user.role === 'admin' || user.role === 'sub_admin';
  if (article.user_id !== user.id && !isStaff) {
    return new Response(JSON.stringify({ error: '无权删除此文章' }), { status: 403, headers });
  }

  await env.DB.prepare('DELETE FROM articles WHERE slug = ?').bind(slug).run();
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
