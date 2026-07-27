/**
 * 全局中间件：安全响应头 + 阻止访问敏感文件
 * 静态文件优先级高于普通 Function，但 _middleware.js 在请求路由前执行
 */
const BLOCKED_PATHS = [
  '/_private',
  '/.wrangler',
  '/node_modules',
  '/wrangler.jsonc',
  '/wrangler.toml',
  '/package-lock.json',
  '/db_schema.sql',
  '/db_seed_articles.sql',
  '/db_seed_players.sql',
  '/README.md',
  '/CNAME',
  '/delete_news.py',
  '/generate_news.py',
  '/yhg_cookie.txt',
];

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'X-XSS-Protection': '0',
};

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;

  // 阻止敏感路径访问
  for (const prefix of BLOCKED_PATHS) {
    if (path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?')) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  // CSRF 防护：所有 /api/ 下 POST/PUT/DELETE 必须携带 X-Requested-By: YHG
  if (
    path.startsWith('/api/') &&
    (context.request.method === 'POST' || context.request.method === 'PUT' || context.request.method === 'DELETE')
  ) {
    const requestedBy = context.request.headers.get('X-Requested-By');
    if (requestedBy !== 'YHG') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 处理非敏感路径
  const response = await context.next();

  // 添加安全响应头（不覆盖已有的）
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!newHeaders.has(key)) {
      newHeaders.set(key, value);
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
