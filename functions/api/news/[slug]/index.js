/**
 * GET    /api/news/:slug  — 获取单篇文章（含点赞数，仅 approved 或作者/staff 可见）
 * PUT    /api/news/:slug  — 编辑文章（作者或 staff）
 * DELETE /api/news/:slug  — 删除文章（需登录 + 作者）
 */
import {getToken, getAuthUser, json, err, handleAsync} from '../../_auth.js';

export const onRequest = handleAsync(async (context) => {
  const { request, env, params } = context;

  const slug = params.slug;

  if (!slug) {
    return err('缺少 slug', 400);
  }

  if (request.method === 'GET') {
    return handleGet(slug, request, env);
  }

  if (request.method === 'PUT') {
    return handlePut(slug, request, env);
  }

  if (request.method === 'DELETE') {
    return handleDelete(slug, request, env);
  }

  return err('方法不允许', 405);
});

async function handleGet(slug, request, env) {
  const article = await env.DB.prepare(
    'SELECT a.*, u.username FROM articles a JOIN users u ON u.id = a.user_id WHERE a.slug = ?'
  ).bind(slug).first();

  if (!article) {
    return err('文章不存在', 404);
  }

  // 权限检查：仅 approved 或作者/staff 可查看
  if (article.status !== 'approved') {
    const user = await getAuthUser(request, env);
    const isStaff = user && (user.role === 'admin' || user.role === 'sub_admin');
    const isAuthor = user && user.id === article.user_id;
    if (!isAuthor && !isStaff) {
      return err('文章待审核', 403);
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

  return json({ ok: true, article });
}

async function handlePut(slug, request, env) {
  const user = await getAuthUser(request, env);
  if (!user) {
    return err('请先登录', 401);
  }

  const article = await env.DB.prepare('SELECT user_id FROM articles WHERE slug = ?').bind(slug).first();
  if (!article) {
    return err('文章不存在', 404);
  }

  const isStaff = user.role === 'admin' || user.role === 'sub_admin';
  if (article.user_id !== user.id && !isStaff) {
    return err('无权编辑此文章', 403);
  }

  try {
    const { title, summary, content } = await request.json();
    if (!title || !content) {
      return err('标题和内容不能为空', 400);
    }
    if (title.length > 120) {
      return err('标题最长120字', 400);
    }

    await env.DB.prepare(
      "UPDATE articles SET title = ?, summary = ?, content = ?, updated_at = datetime('now') WHERE slug = ?"
    ).bind(title, summary || '', content.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''), slug).run();

    return json({ ok: true, slug });
  } catch (e) {
    return err('请求数据无效', 400);
  }
}

async function handleDelete(slug, request, env) {
  const user = await getAuthUser(request, env);
  if (!user) {
    return err('请先登录', 401);
  }

  const article = await env.DB.prepare('SELECT user_id FROM articles WHERE slug = ?').bind(slug).first();
  if (!article) {
    return err('文章不存在', 404);
  }

  const isStaff = user.role === 'admin' || user.role === 'sub_admin';
  if (article.user_id !== user.id && !isStaff) {
    return err('无权删除此文章', 403);
  }

  await env.DB.prepare('DELETE FROM articles WHERE slug = ?').bind(slug).run();
  return json({ ok: true });
}
