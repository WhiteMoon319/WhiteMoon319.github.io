/**
 * /sitemap.xml — 动态生成
 * 实时从 D1 查询 approved 文章与全部选手，新增内容发布后自动收录
 */
const SITE = 'https://yhg.whitemoon319.xyz';

function xmlEscape(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function onRequest(context) {
  const { env } = context;
  const headers = { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' };

  // 静态目录页
  const statics = [
    { loc: '/', pri: '1.0' },
    { loc: '/about/', pri: '0.9' },
    { loc: '/members/', pri: '0.9' },
    { loc: '/matches/', pri: '0.9' },
    { loc: '/news/', pri: '0.8' },
  ];

  let urls = statics.map((s) =>
    `<url><loc>${SITE}${s.loc}</loc><priority>${s.pri}</priority></url>`
  );

  try {
    // 选手页（全部）
    const players = await env.DB.prepare('SELECT slug FROM players ORDER BY slug').all();
    for (const p of (players.results || [])) {
      urls.push(
        `<url><loc>${SITE}/members/profile.html?slug=${xmlEscape(p.slug)}</loc><priority>0.7</priority></url>`
      );
    }

    // 文章页（仅 approved）
    const articles = await env.DB.prepare(
      "SELECT slug, created_at FROM articles WHERE status = 'approved' ORDER BY created_at DESC"
    ).all();
    for (const a of (articles.results || [])) {
      const lastmod = a.created_at ? xmlEscape(String(a.created_at).split(' ')[0]) : '';
      urls.push(
        `<url><loc>${SITE}/news/article.html?slug=${xmlEscape(a.slug)}</loc><lastmod>${lastmod}</lastmod><priority>0.6</priority></url>`
      );
    }
  } catch (e) {
    // 数据库异常时退化为仅静态目录页，不让 sitemap 500
    console.error('sitemap error:', e);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new Response(xml, { status: 200, headers });
}
