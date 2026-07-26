/**
 * GET /api/matches — 公开赛事列表（按日期倒序）
 */
export async function onRequest(context) {
  const { request, env } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' };

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: '仅支持 GET' }), { status: 405, headers });
  }

  const matches = await env.DB.prepare(
    'SELECT * FROM matches ORDER BY match_date DESC'
  ).all();

  return new Response(JSON.stringify({ ok: true, matches: matches.results }), { status: 200, headers });
}
