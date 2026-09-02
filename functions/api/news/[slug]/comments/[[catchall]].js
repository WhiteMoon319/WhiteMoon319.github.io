/**
 * YHG Comments API — 支持回复 + 点赞
 *
 * GET    /api/news/:slug/comments           — 文章评论列表（含嵌套回复）
 * POST   /api/news/:slug/comments           — 发表评论（支持 parent_id 回复）
 * DELETE /api/news/:slug/comments/:id       — 删除评论
 * POST   /api/news/:slug/comments/:id/like  — 切换评论点赞
 */
import { getAuthUser, createNotification, checkRateLimit } from '../../../_auth.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  const url = new URL(request.url);
  const segments = url.pathname.replace(/\/$/, '').split('/');
  const slug = params.slug;

  // 找 comment id
  let commentId = null;
  let isLike = false;
  const last = segments[segments.length - 1];
  const secondLast = segments.length >= 2 ? segments[segments.length - 2] : '';

  if (last === 'like' && !isNaN(parseInt(secondLast))) {
    commentId = parseInt(secondLast);
    isLike = true;
  } else if (last && last !== 'comments' && !isNaN(parseInt(last))) {
    commentId = parseInt(last);
  }

  // 查文章
  const article = await env.DB.prepare('SELECT id, user_id, title, slug FROM articles WHERE slug = ?').bind(slug).first();
  if (!article) {
    return new Response(JSON.stringify({ error: '文章不存在' }), { status: 404, headers });
  }

  // POST /api/news/:slug/comments/:id/like — 评论点赞切换
  if (request.method === 'POST' && isLike && commentId) {
    return handleToggleCommentLike(article, commentId, request, env, headers);
  }

  if (request.method === 'GET' && !commentId) {
    return handleList(article.id, env, headers);
  }

  if (request.method === 'POST' && !commentId) {
    return handleCreate(article, request, env, headers);
  }

  if (request.method === 'DELETE' && commentId) {
    return handleDelete(article.id, commentId, request, env, headers);
  }

  return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
}

/** 获取评论列表（含回复嵌套 + 点赞数） */
async function handleList(articleId, env, headers) {
  const comments = await env.DB.prepare(`
    SELECT c.id, c.content, c.parent_id, c.created_at,
           u.id as user_id, u.username, u.avatar
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.article_id = ?
    ORDER BY c.created_at ASC
  `).bind(articleId).all();

  // 为每条评论附加点赞数
  const rows = comments.results || [];
  for (const c of rows) {
    const likes = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM comment_likes WHERE comment_id = ?'
    ).bind(c.id).first();
    c.like_count = likes ? likes.cnt : 0;
  }

  // 组织嵌套结构
  const byId = {};
  const topLevel = [];
  for (const c of rows) {
    byId[c.id] = c;
    c.replies = [];
  }
  for (const c of rows) {
    if (c.parent_id && byId[c.parent_id]) {
      byId[c.parent_id].replies.push(c);
    } else {
      topLevel.push(c);
    }
  }

  return new Response(JSON.stringify({ ok: true, comments: topLevel }), { status: 200, headers });
}

/** 发表评论（支持 parent_id 回复） */
async function handleCreate(article, request, env, headers) {
  const user = await getAuthUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: '请先登录' }), { status: 401, headers });
  }

  // 限流：每分钟最多 10 条评论
  const limit = await checkRateLimit(request, env, 'create-comment', 10, 1);
  if (!limit.ok) {
    return new Response(JSON.stringify({ error: limit.error }), { status: 429, headers });
  }

  try {
    const body = await request.json();
    const content = (body.content || '').trim();
    if (!content) {
      return new Response(JSON.stringify({ error: '评论内容不能为空' }), { status: 400, headers });
    }

    const parentId = body.parent_id ? parseInt(body.parent_id) : null;

    // 验证 parent_id 存在
    if (parentId) {
      const parent = await env.DB.prepare(
        'SELECT id, user_id FROM comments WHERE id = ? AND article_id = ?'
      ).bind(parentId, article.id).first();
      if (!parent) {
        return new Response(JSON.stringify({ error: '父评论不存在' }), { status: 404, headers });
      }
    }

    const result = await env.DB.prepare(
      'INSERT INTO comments (article_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)'
    ).bind(article.id, user.id, content, parentId).run();

    const newId = result.meta.last_row_id;

    // 通知：回复评论
    if (parentId) {
      const parent = await env.DB.prepare(
        'SELECT user_id FROM comments WHERE id = ?'
      ).bind(parentId).first();
      if (parent && parent.user_id !== user.id) {
        await createNotification(
          env, parent.user_id, 'reply',
          user.username + ' 回复了你的评论',
          content.slice(0, 80),
          '/news/article.html?slug=' + article.slug,
          article.id, newId
        );
      }
    } else {
      // 通知：评论文章
      if (article.user_id !== user.id) {
        await createNotification(
          env, article.user_id, 'comment',
          user.username + ' 评论了你的文章《' + article.title + '》',
          content.slice(0, 80),
          '/news/article.html?slug=' + article.slug,
          article.id, newId
        );
      }
    }

    return new Response(JSON.stringify({ ok: true, id: newId }), { status: 201, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求数据无效' }), { status: 400, headers });
  }
}

/** 删除评论 */
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

  const isStaffUser = user.role === 'admin' || user.role === 'sub_admin';
  if (comment.user_id !== user.id && !isStaffUser) {
    return new Response(JSON.stringify({ error: '无权删除' }), { status: 403, headers });
  }

  await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run();
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

/** 切换评论点赞 */
async function handleToggleCommentLike(article, commentId, request, env, headers) {
  const user = await getAuthUser(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: '请先登录' }), { status: 401, headers });
  }

  // 限流：每分钟最多 30 次评论点赞
  const limit = await checkRateLimit(request, env, 'like-comment', 30, 1);
  if (!limit.ok) {
    return new Response(JSON.stringify({ error: limit.error }), { status: 429, headers });
  }

  const comment = await env.DB.prepare(
    'SELECT id, user_id FROM comments WHERE id = ? AND article_id = ?'
  ).bind(commentId, article.id).first();

  if (!comment) {
    return new Response(JSON.stringify({ error: '评论不存在' }), { status: 404, headers });
  }

  // 检查是否已点赞
  const existing = await env.DB.prepare(
    'SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?'
  ).bind(commentId, user.id).first();

  if (existing) {
    // 取消点赞
    await env.DB.prepare(
      'DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?'
    ).bind(commentId, user.id).run();
  } else {
    // 点赞
    await env.DB.prepare(
      'INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)'
    ).bind(commentId, user.id).run();

    // 通知评论作者
    if (comment.user_id !== user.id) {
      await createNotification(
        env, comment.user_id, 'like_comment',
        user.username + ' 赞了你的评论',
        '',
        '/news/article.html?slug=' + article.slug,
        article.id, commentId
      );
    }
  }

  const count = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM comment_likes WHERE comment_id = ?'
  ).bind(commentId).first();

  return new Response(JSON.stringify({
    ok: true,
    liked: !existing,
    like_count: count ? count.cnt : 0
  }), { status: 200, headers });
}
