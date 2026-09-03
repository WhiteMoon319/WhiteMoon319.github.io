/**
 * GET /api/admin/home     — 获取所有首页区块（含 id）
 * PUT /api/admin/home     — 更新首页区块 { sections: [{ section_key, content }] }
 */
import { isStaff } from './check.js';
import {json, err, handleAsync} from '../_auth.js';

export const onRequest = handleAsync(async (context) => {
  const { request, env } = context;


  const staff = await isStaff(request, env);
  if (!staff) {
    return err('需要管理员权限', 403);
  }

  if (request.method === 'GET') {
    const sections = await env.DB.prepare('SELECT * FROM home_sections ORDER BY id').all();
    return json({ ok: true, sections: sections.results });
  }

  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      if (!Array.isArray(body.sections)) {
        return err('需要 sections 数组', 400);
      }
      for (const s of body.sections) {
        if (s.section_key && s.content !== undefined) {
          await env.DB.prepare(
            'INSERT INTO home_sections (section_key, content) VALUES (?, ?) ON CONFLICT(section_key) DO UPDATE SET content = ?, updated_at = datetime(\'now\')'
          ).bind(s.section_key, s.content, s.content).run();
        }
      }
      return json({ ok: true });
    } catch (e) {
      return err('请求数据无效', 400);
    }
  }

  return err('方法不允许', 405);
});
