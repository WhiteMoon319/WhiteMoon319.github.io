/**
 * GET /api/admin/home     — 获取所有首页区块（含 id）
 * PUT /api/admin/home     — 更新首页区块 { sections: [{ section_key, content }] }
 */
import { isStaff } from './check.js';

export async function onRequest(context) {
  const { request, env } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  const staff = await isStaff(request, env);
  if (!staff) {
    return new Response(JSON.stringify({ error: '需要管理员权限' }), { status: 403, headers });
  }

  if (request.method === 'GET') {
    const sections = await env.DB.prepare('SELECT * FROM home_sections ORDER BY id').all();
    return new Response(JSON.stringify({ ok: true, sections: sections.results }), { status: 200, headers });
  }

  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      if (!Array.isArray(body.sections)) {
        return new Response(JSON.stringify({ error: '需要 sections 数组' }), { status: 400, headers });
      }
      for (const s of body.sections) {
        if (s.section_key && s.content !== undefined) {
          await env.DB.prepare(
            'INSERT INTO home_sections (section_key, content) VALUES (?, ?) ON CONFLICT(section_key) DO UPDATE SET content = ?, updated_at = datetime(\'now\')'
          ).bind(s.section_key, s.content, s.content).run();
        }
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: '请求数据无效' }), { status: 400, headers });
    }
  }

  return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
}
