/**
 * GET /api/home — 公开首页数据（首页区块 + 精选比赛）
 */
export async function onRequest(context) {
  const { request, env } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' };

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: '仅支持 GET' }), { status: 405, headers });
  }

  // 读取所有首页区块
  const sections = await env.DB.prepare('SELECT section_key, content FROM home_sections').all();
  const data = {};
  for (const s of sections.results) {
    data[s.section_key] = s.content;
  }

  // 读取精选比赛
  const match = await env.DB.prepare(
    "SELECT * FROM matches WHERE featured = 1 ORDER BY match_date DESC LIMIT 1"
  ).first();

  return new Response(JSON.stringify({
    ok: true,
    sections: data,
    featured_match: match || null
  }), { status: 200, headers });
}
