/**
 * POST   /api/news/:slug/like  — 切换点赞（登录用户）
 * GET    /api/news/:slug/like  — 获取点赞数和状态
 */
import { getToken } from '../../_auth.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const slug = params.slug;

  // 先查文章 ID
  const article = await env.DB.prepare('SELECT id FROM articles WHERE slug = ?').bind(slug).first();
  if (!article) {
    return new Response(JSON.stringify({ error: '文章不存在' }), { status: 404, headers });
  }

  if (request.method === 'GET') {
    return handleGetLike(article.id, request, env, headers);
  }

  if (request.method === 'POST') {
    return handleToggleLike(article.id, request, env, headers);
  }

  return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
}

async function handleGetLike(articleId, request, env, headers) {
  const count = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM article_likes WHERE article_id = ?'
  ).bind(articleId).first();

  let likedByMe = false;
  const t = getToken(request);
  if (t) {
    const user = await env.DB.prepare(
      'SELECT u.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
    ).bind(t).first();
    if (user) {
      const liked = await env.DB.prepare(
        'SELECT 1 FROM article_likes WHERE article_id = ? AND user_id = ?'
      ).bind(articleId, user.id).first();
      likedByMe = !!liked;
    }
  }

  return new Response(JSON.stringify({ ok: true, like_count: count.cnt, liked_by_me: likedByMe }), { status: 200, headers });
}

async function handleToggleLike(articleId, request, env, headers) {
  // 登录检查
  const token = getToken(request);
  if (!token) {
    return new Response(JSON.stringify({ error: '请先登录' }), { status: 401, headers });
  }

  const user = await env.DB.prepare(
    'SELECT u.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
  ).bind(token).first();
  if (!user) {
    return new Response(JSON.stringify({ error: '会话已过期' }), { status: 401, headers });
  }

  // 检查是否已点赞
  const existing = await env.DB.prepare(
    'SELECT 1 FROM article_likes WHERE article_id = ? AND user_id = ?'
  ).bind(articleId, user.id).first();

  if (existing) {
    // 取消点赞
    await env.DB.prepare(
      'DELETE FROM article_likes WHERE article_id = ? AND user_id = ?'
    ).bind(articleId, user.id).run();
    const count = await env.DB.prepare('SELECT COUNT(*) as cnt FROM article_likes WHERE article_id = ?').bind(articleId).first();
    return new Response(JSON.stringify({ ok: true, liked: false, like_count: count.cnt }), { status: 200, headers });
  } else {
    // 点赞
    await env.DB.prepare(
      'INSERT INTO article_likes (article_id, user_id) VALUES (?, ?)'
    ).bind(articleId, user.id).run();
    const count = await env.DB.prepare('SELECT COUNT(*) as cnt FROM article_likes WHERE article_id = ?').bind(articleId).first();
    return new Response(JSON.stringify({ ok: true, liked: true, like_count: count.cnt }), { status: 200, headers });
  }
}
