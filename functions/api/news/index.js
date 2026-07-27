/**
 * GET  /api/news          — 获取已审核文章列表（支持搜索 q= 和分页 page=&limit=）
 * POST /api/news          — 创建文章（需登录，普通用户为 pending，staff 为 approved）
 */
import { getToken } from '../_auth.js';
import { createPasswordHash } from '../auth/crypto.js';

export async function onRequest(context) {
  const { request, env } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const url = new URL(request.url);

  if (request.method === 'GET') {
    return handleList(url, env, headers);
  }

  if (request.method === 'POST') {
    return handleCreate(request, env, headers);
  }

  return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
}

// 列出已审核文章（搜索+分页）
async function handleList(url, env, headers) {
  const q = (url.searchParams.get('q') || '').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 10));
  const offset = (page - 1) * limit;

  let where = "a.status = 'approved'";
  let bindParams = [];

  if (q) {
    where += " AND (a.title LIKE ? OR a.summary LIKE ? OR a.content LIKE ?)";
    const pattern = '%' + q + '%';
    bindParams.push(pattern, pattern, pattern);
  }

  // 查总数
  const countSql = 'SELECT COUNT(*) as total FROM articles a WHERE ' + where;
  const countResult = await env.DB.prepare(countSql).bind(...bindParams).first();
  const total = countResult ? countResult.total : 0;
  const totalPages = Math.ceil(total / limit);

  // 查分页数据
  const dataSql = `
    SELECT a.id, a.title, a.summary, a.slug, a.created_at, a.status, u.username
    FROM articles a JOIN users u ON u.id = a.user_id
    WHERE ${where}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const rows = await env.DB.prepare(dataSql).bind(...bindParams, limit, offset).all();

  // 附加点赞数
  for (const a of rows.results) {
    const likes = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM article_likes WHERE article_id = ?'
    ).bind(a.id).first();
    a.like_count = likes ? likes.cnt : 0;
  }

  return new Response(JSON.stringify({
    ok: true,
    articles: rows.results,
    total,
    page,
    limit,
    totalPages
  }), { status: 200, headers });
}

// 创建文章
async function handleCreate(request, env, headers) {
  const token = getToken(request);
  if (!token) {
    return new Response(JSON.stringify({ error: '请先登录' }), { status: 401, headers });
  }

  const session = await env.DB.prepare('SELECT s.user_id, u.role, u.level FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').bind(token).first();
  if (!session) {
    return new Response(JSON.stringify({ error: '会话已过期' }), { status: 401, headers });
  }

  // 等级检查：level >= 2 或 staff 才能发文章
  const isStaff = session.role === 'admin' || session.role === 'sub_admin';
  if (!isStaff && (session.level || 0) < 2) {
    return new Response(JSON.stringify({ error: '需要 Lv.2 以上才能发文章，请联系管理员提升等级' }), { status: 403, headers });
  }

  try {
    const { title, summary, content } = await request.json();

    if (!title || !content) {
      return new Response(JSON.stringify({ error: '标题和内容不能为空' }), { status: 400, headers });
    }
    if (title.length > 120) {
      return new Response(JSON.stringify({ error: '标题最长120字' }), { status: 400, headers });
    }

    const slug = 'article-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

    // 管理员和副管理员自动审核通过，普通用户需审核
    const status = isStaff ? 'approved' : 'pending';

    await env.DB.prepare(
      'INSERT INTO articles (user_id, title, summary, content, slug, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(session.user_id, title, summary || '', content.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''), slug, status).run();

    return new Response(JSON.stringify({ ok: true, slug, status }), { status: 201, headers });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: '服务器错误' }), { status: 500, headers });
  }
}
