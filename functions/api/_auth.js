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
 */
export async function getUserFromToken(token, env) {
  if (!token) return null;
  return await env.DB.prepare(
    'SELECT u.id, u.email, u.username, u.role, u.level FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
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
 * 检查 IP 频率限制
 * @param {Request} request
 * @param {object} env
 * @param {string} endpoint - 端点标识，如 'login', 'register'
 * @param {number} [maxAttempts=10] - 窗口内最大尝试次数
 * @param {number} [windowMinutes=1] - 时间窗口（分钟）
 * @returns {Promise<{ok:boolean, remaining:number, error?:string}>}
 */
export async function checkRateLimit(request, env, endpoint, maxAttempts = 10, windowMinutes = 1) {
  const ip = getClientIP(request);
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
