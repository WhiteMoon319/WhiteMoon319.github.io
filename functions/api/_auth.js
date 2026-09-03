/**
 * 共享认证工具函数
 * 
 * 避免多个文件中重复编写 cookie 解析和用户查询逻辑。
 * 命名以 _ 开头使其不作为 HTTP 路由端点。
 */

/**
 * 从请求 Cookie 中提取 session token
 */
export function getToken(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/yhg_session=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * 从 token 查询用户（不含密码）
 * 检查会话是否过期
 */
export async function getUserFromToken(token, env) {
  if (!token) return null;
  return await env.DB.prepare(
    "SELECT u.id, u.email, u.username, u.role, u.level, u.player_slug FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))"
  ).bind(token).first();
}

/**
 * 从请求中获取当前登录用户
 */
export async function getAuthUser(request, env) {
  return await getUserFromToken(getToken(request), env);
}

/**
 * 检查是否为 staff（admin 或 sub_admin）
 * 是则返回 user 对象，否则返回 null
 */
export async function isStaff(request, env) {
  const user = await getAuthUser(request, env);
  if (!user) return null;
  return (user.role === 'admin' || user.role === 'sub_admin') ? user : null;
}

/**
 * 获取客户端 IP
 */
function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') ||
         request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
         'unknown';
}

/**
 * 创建通知
 * 自动检查用户的通知偏好，仅当 on_site=1 时写入
 */
export async function createNotification(env, userId, type, title, body, link, articleId, commentId, fromUserId) {
  // 私信（private_message）不检查偏好，始终投递
  if (type !== 'private_message') {
    const pref = await env.DB.prepare('SELECT * FROM notification_preferences WHERE user_id = ?').bind(userId).first();
    if (pref && pref.on_site === 0) return null;

    if (pref) {
      if (type === 'comment' && pref.on_comment === 0) return null;
      if (type === 'reply' && pref.on_reply === 0) return null;
      if ((type === 'like_article' || type === 'like_comment') && pref.on_like === 0) return null;
      if ((type === 'article_approved' || type === 'article_rejected') && pref.on_article_status === 0) return null;
      if (type === 'system' && pref.on_announcement === 0) return null;
    }
  }

  const result = await env.DB.prepare(
    'INSERT INTO notifications (user_id, type, title, body, link, related_article_id, related_comment_id, from_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(userId, type, title, body || '', link || '', articleId || null, commentId || null, fromUserId || null).run();
  return result.meta.last_row_id;
}

/**
 * 批量通知所有用户（用于系统公告）
 */
export async function notifyAllUsers(env, type, title, body, link) {
  const users = await env.DB.prepare('SELECT id FROM users').all();
  for (const u of (users.results || [])) {
    await createNotification(env, u.id, type, title, body, link);
  }
}

/**
 * 检查频率限制（默认按 IP，可传 key 按其他维度如邮箱）
 * @param {Request} request
 * @param {object} env
 * @param {string} endpoint - 端点标识，如 'login', 'register'
 * @param {number} [maxAttempts=10] - 窗口内最大尝试次数
 * @param {number} [windowMinutes=1] - 时间窗口（分钟）
 * @param {string} [key] - 可选，自定义限次键（如 email），替代 IP
 * @returns {Promise<{ok:boolean, remaining:number, error?:string}>}
 */
export async function checkRateLimit(request, env, endpoint, maxAttempts = 10, windowMinutes = 1, key = '') {
  const ip = key || getClientIP(request);
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMinutes * 60000).toISOString().slice(0, 19).replace('T', ' ');

  // 清理过期记录
  await env.DB.prepare(
    "DELETE FROM rate_limits WHERE window_start < ?"
  ).bind(windowStart).run();

  // 查询当前窗口内的请求数
  const row = await env.DB.prepare(
    "SELECT count FROM rate_limits WHERE ip = ? AND endpoint = ? AND window_start >= ?"
  ).bind(ip, endpoint, windowStart).first();

  const currentCount = row ? row.count : 0;

  if (currentCount >= maxAttempts) {
    return { ok: false, remaining: 0, error: '请求过于频繁，请稍后再试' };
  }

  // 插入或递增计数
  if (currentCount === 0) {
    await env.DB.prepare(
      "INSERT INTO rate_limits (ip, endpoint, count, window_start) VALUES (?, ?, 1, ?)"
    ).bind(ip, endpoint, new Date().toISOString().slice(0, 19).replace('T', ' ')).run();
  } else {
    await env.DB.prepare(
      "UPDATE rate_limits SET count = count + 1 WHERE ip = ? AND endpoint = ? AND window_start >= ?"
    ).bind(ip, endpoint, windowStart).run();
  }

  return { ok: true, remaining: maxAttempts - currentCount - 1 };
}

/**
 * 统一 JSON 响应（自动携带标准头）
 * @param {*} data - 响应体（自动 JSON.stringify）
 * @param {number} [status=200]
 * @param {object} [extraHeaders]
 */
export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

/**
 * 统一错误响应
 * @param {string} message
 * @param {number} [status=400]
 * @param {object} [extraHeaders]
 */
export function err(message, status = 400, extraHeaders = {}) {
  return json({ error: message }, status, extraHeaders);
}

/**
 * 包装 async 处理器：捕获异常统一返回 500，消灭裸异常
 * @param {(ctx) => Promise<Response>} handler
 */
export function handleAsync(handler) {
  return async (context) => {
    try {
      return await handler(context);
    } catch (e) {
      console.error('[api error]', context?.request?.url || '', e);
      return json({ error: '服务器错误' }, 500);
    }
  };
}

/**
 * 解析分页参数（统一 page/limit/offset 解析）
 * @param {URL} url
 * @param {number} [defaultLimit=10]
 * @param {number} [maxLimit=50]
 * @returns {{page:number, limit:number, offset:number}}
 */
export function parsePagination(url, defaultLimit = 10, maxLimit = 50) {
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(url.searchParams.get('limit')) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
