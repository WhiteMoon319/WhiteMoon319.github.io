/**
 * POST   /api/news/:slug/like  — 切换点赞（登录用户）
 * GET    /api/news/:slug/like  — 获取点赞数和状态
 *
 * 点赞时向文章作者发送通知
 */
import { getToken, createNotification, checkRateLimit } from '../../_auth.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const slug = params.slug;

  // 先查文章 ID 和作者
  const article = await env.DB.prepare('SELECT id, user_id, title, slug FROM articles WHERE slug = ?').bind(slug).first();
  if (!article) {
    return new Response(JSON.stringify({ error: '文章不存在' }), { status: 404, headers });
  }

  if (request.method === 'GET') {
    return handleGetLike(article.id, request, env, headers);
  }

  if (request.method === 'POST') {
    return handleToggleLike(article, request, env, headers);
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
      'SELECT u.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > datetime(\'now\'))'
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

async function handleToggleLike(article, request, env, headers) {
  // 登录检查
  const token = getToken(request);
  if (!token) {
    return new Response(JSON.stringify({ error: '请先登录' }), { status: 401, headers });
  }

  const user = await env.DB.prepare(
    'SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > datetime(\'now\'))'
  ).bind(token).first();
  if (!user) {
    return new Response(JSON.stringify({ error: '会话已过期' }), { status: 401, headers });
  }

  // 限流：每分钟最多 30 次点赞
  const limit = await checkRateLimit(request, env, 'like-article', 30, 1);
  if (!limit.ok) {
    return new Response(JSON.stringify({ error: limit.error }), { status: 429, headers });
  }

  // 检查是否已点赞
  const existing = await env.DB.prepare(
    'SELECT 1 FROM article_likes WHERE article_id = ? AND user_id = ?'
  ).bind(article.id, user.id).first();

  if (existing) {
    // 取消点赞
    await env.DB.prepare(
      'DELETE FROM article_likes WHERE article_id = ? AND user_id = ?'
    ).bind(article.id, user.id).run();
    const count = await env.DB.prepare('SELECT COUNT(*) as cnt FROM article_likes WHERE article_id = ?').bind(article.id).first();
    return new Response(JSON.stringify({ ok: true, liked: false, like_count: count.cnt }), { status: 200, headers });
  } else {
    // 点赞
    await env.DB.prepare(
      'INSERT INTO article_likes (article_id, user_id) VALUES (?, ?)'
    ).bind(article.id, user.id).run();
    const count = await env.DB.prepare('SELECT COUNT(*) as cnt FROM article_likes WHERE article_id = ?').bind(article.id).first();

    // 通知文章作者
    if (article.user_id !== user.id) {
      await createNotification(
        env, article.user_id, 'like_article',
        user.username + ' 赞了你的文章《' + article.title + '》',
        '',
        '/news/article.html?slug=' + article.slug,
        article.id
      );
    }

    return new Response(JSON.stringify({ ok: true, liked: true, like_count: count.cnt }), { status: 200, headers });
  }
}
