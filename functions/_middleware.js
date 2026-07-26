/**
 * 全局中间件：阻止访问敏感文件
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
];

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;

  for (const prefix of BLOCKED_PATHS) {
    if (path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?')) {
      return new Response('Forbidden', { status: 403 });
    }
  }

  // 非敏感路径，正常处理
  return await context.next();
}
