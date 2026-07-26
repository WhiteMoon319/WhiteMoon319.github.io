/**
 * GET /api/players — 所有选手列表
 */
export async function onRequest(context) {
  const { request, env } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' };

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
  }

  const players = await env.DB.prepare('SELECT slug, id_name, name, age, role, titles, bio, avatar FROM players ORDER BY slug').all();
  return new Response(JSON.stringify({ ok: true, players: players.results }), { status: 200, headers });
}
