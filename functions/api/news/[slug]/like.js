/**
 * POST   /api/news/:slug/like  — 切换点赞（登录用户）
 * GET    /api/news/:slug/like  — 获取点赞数和状态
 *
 * 点赞时向文章作者发送通知
 */
import {getToken, getUserFromToken, createNotification, checkRateLimit, json, err, handleAsync} from '../../_auth.js';

export const onRequest = handleAsync(async (context) => {
  const { request, env, params } = context;

  const slug = params.slug;

  // 先查文章 ID 和作者
  const article = await env.DB.prepare('SELECT id, user_id, title, slug FROM articles WHERE slug = ?').bind(slug).first();
  if (!article) {
    return err('文章不存在', 404);
  }

  if (request.method === 'GET') {
    return handleGetLike(article.id, request, env);
  }

  if (request.method === 'POST') {
    return handleToggleLike(article, request, env);
  }

  return err('方法不允许', 405);
});

async function handleGetLike(articleId, request, env) {
  const count = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM article_likes WHERE article_id = ?'
  ).bind(articleId).first();

  let likedByMe = false;
  const t = getToken(request);
  if (t) {
    const user = await getUserFromToken(t, env);
    if (user) {
      const liked = await env.DB.prepare(
        'SELECT 1 FROM article_likes WHERE article_id = ? AND user_id = ?'
      ).bind(articleId, user.id).first();
      likedByMe = !!liked;
    }
  }

  return json({ ok: true, like_count: count.cnt, liked_by_me: likedByMe });
}

async function handleToggleLike(article, request, env) {
  // 登录检查
  const token = getToken(request);
  if (!token) {
    return err('请先登录', 401);
  }

  const user = await getUserFromToken(token, env);
  if (!user) {
    return err('会话已过期', 401);
  }

  // 限流：每分钟最多 30 次点赞
  const limit = await checkRateLimit(request, env, 'like-article', 30, 1);
  if (!limit.ok) {
    return err(limit.error, 429);
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
    return json({ ok: true, liked: false, like_count: count.cnt });
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

    return json({ ok: true, liked: true, like_count: count.cnt });
  }
}
