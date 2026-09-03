/**
 * YHG Admin Articles API — 管理文章 + 公告
 *
 * GET    /api/admin/articles                     — 所有文章列表
 * DELETE /api/admin/articles/:slug               — 删除文章
 * PUT    /api/admin/articles/:slug/status         — 审核文章（approved/rejected）
 * POST   /api/admin/articles/announcement         — 发布系统公告（发送给所有用户）
 */
import { isStaff } from '../check.js';
import {createNotification, notifyAllUsers, json, err, handleAsync} from '../../_auth.js';

export const onRequest = handleAsync(async (context) => {
  const { request, env } = context;


  const staff = await isStaff(request, env);
  if (!staff) {
    return err('需要管理员权限', 403);
  }

  const url = new URL(request.url);
  const pathParts = url.pathname.replace(/\/$/, '').split('/');

  const articlesIdx = pathParts.indexOf('articles');
  const slug = (articlesIdx >= 0 && pathParts.length > articlesIdx + 1) ? pathParts[articlesIdx + 1] : null;
  const action = (articlesIdx >= 0 && pathParts.length > articlesIdx + 2) ? pathParts[articlesIdx + 2] : null;

  // POST /api/admin/articles/announcement — 发布公告
  if (request.method === 'POST' && pathParts[pathParts.length - 1] === 'announcement') {
    return handleAnnouncement(request, env, staff);
  }

  if (request.method === 'GET') {
    return handleList(env);
  }

  // PUT /api/admin/articles/:slug/status — 审核
  if (request.method === 'PUT' && action === 'status' && slug) {
    return handleStatusUpdate(slug, request, env);
  }

  // DELETE /api/admin/articles/:slug — 删除
  if (request.method === 'DELETE' && slug) {
    return handleDelete(slug, env);
  }

  return err('方法不允许', 405);
});

async function handleList(env) {
  const articles = await env.DB.prepare(
    "SELECT a.id, a.title, a.slug, a.status, a.created_at, u.username FROM articles a JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC"
  ).all();
  return json({ ok: true, articles: articles.results });
}

async function handleStatusUpdate(slug, request, env) {
  try {
    const body = await request.json();
    if (!['approved', 'rejected'].includes(body.status)) {
      return err('状态仅支持 approved 或 rejected', 400);
    }

    // 获取文章信息（含作者）
    const article = await env.DB.prepare(
      'SELECT a.id, a.title, a.user_id, u.username FROM articles a JOIN users u ON u.id = a.user_id WHERE a.slug = ?'
    ).bind(slug).first();

    if (!article) {
      return err('文章不存在', 404);
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

    return json({ ok: true, status: body.status });
  } catch (e) {
    return err('请求数据无效', 400);
  }
}

async function handleDelete(slug, env) {
  await env.DB.prepare('DELETE FROM articles WHERE slug = ?').bind(slug).run();
  return json({ ok: true });
}

async function handleAnnouncement(request, env, staff) {
  try {
    const body = await request.json();
    const title = (body.title || '').trim();
    const content = (body.content || '').trim();

    if (!title) {
      return err('公告标题不能为空', 400);
    }

    // 校验 link 必须为空或以 https:// 或 / 开头
    const link = (body.link || '').trim();
    if (link && !link.startsWith('https://') && !link.startsWith('/')) {
      return err('链接必须以 https:// 开头或为站内路径', 400);
    }

    // 写入 announcements 表
    const result = await env.DB.prepare(
      "INSERT INTO announcements (title, body, link, created_by) VALUES (?, ?, ?, ?)"
    ).bind(title, content, link, staff.id).run();

    // 发送给所有用户
    await notifyAllUsers(env, 'system', title, content, link);

    return json({ ok: true, id: result.meta.last_row_id, message: '公告已发布' });
  } catch (e) {
    console.error(e);
    return err('请求数据无效', 400);
  }
}
