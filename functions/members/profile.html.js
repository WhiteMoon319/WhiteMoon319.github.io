/**
 * /members/profile.html — 服务端渲染（SSR）
 * 替代原静态空壳：从 D1 查选手数据，渲染完整正文，爬虫可直接索引
 * 前端 members-profile.js 降级为增强模式（补编辑按钮/交互）
 */
const SITE = 'https://yhg.whitemoon319.xyz';

/** HTML 转义（与服务端一致，防 XSS） */
function eh(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/** 选手详情页完整 HTML */
function renderProfileHtml(p, slug) {
  const stats = (() => { try { return JSON.parse(p.stats || '{}'); } catch(e) { return {}; } })();
  const statKeys = ['智商', '情商', '实力', '颜值', '素质', '运气'];
  const maxValues = { '实力': 20, '智商': 20, '情商': 20, '颜值': 20, '素质': 20, '运气': 20 };

  let statsHtml = '';
  statKeys.forEach(function(k) {
    const val = stats[k] || 0;
    const max = maxValues[k] || 20;
    const pct = Math.min(100, Math.round((val / max) * 100));
    statsHtml += '<div class="attribute"><span>' + eh(k) + ' <b>' + eh(String(val)) + '</b></span><i style="--value:' + pct + '%"></i></div>';
  });

  const picUrl = SITE + '/resource/img/' + slug + '/members_pic.webp';
  const updated = p.updated_at ? new Date(p.updated_at.replace(' ', 'T') + 'Z').toLocaleDateString('zh-CN') : '';

  const hero =
    '<section class="page-hero member-hero">' +
      '<div class="embers" aria-hidden="true">' + '<i></i>'.repeat(12) + '</div>' +
      '<div class="page-hero-content">' +
        '<div class="eyebrow reveal in" data-delay="1">' + eh(p.role ? p.role.toUpperCase() : '') + ' · ' + eh(p.titles || '选手') + '</div>' +
        '<h1 class="reveal in" data-delay="2">' + eh(p.id_name) + '</h1>' +
        '<p class="reveal in" data-delay="3" style="max-width:600px;">' + eh(p.bio || '暂无简介') + '</p>' +
        '<div style="margin-top:16px;"><a class="ghost-btn" href="' + eh(slug) + '/">查看详情</a></div>' +
      '</div>' +
    '</section>';

  const body =
    '<section class="section list-section">' +
      '<div class="member-layout">' +
        '<aside class="member-portrait reveal in" data-delay="2">' +
          '<div class="member-portrait-content">' +
            '<img class="member-portrait-pic" src="' + picUrl + '" alt="' + eh(p.name) + '" onerror="this.src=\'' + SITE + '/resource/img/default_members_pic.webp\'">' +
            '<div class="role">' + eh(p.id_name) + ' / ' + eh(p.role) + '</div>' +
            '<h2>' + eh(p.name) + '</h2>' +
            '<p>' + eh(p.bio || '') + '</p>' +
          '</div>' +
        '</aside>' +
        '<div class="member-info">' +
          '<article class="info-panel reveal in" data-delay="3">' +
            '<h3>基础资料</h3>' +
            '<div class="info-grid">' +
              '<div class="info-cell" data-field="姓名"><span>姓名</span><b>' + eh(p.name) + '</b></div>' +
              '<div class="info-cell" data-field="ID"><span>ID</span><b>' + eh(p.id_name) + '</b></div>' +
              '<div class="info-cell" data-field="年龄"><span>年龄</span><b>' + eh(p.age || '—') + '</b></div>' +
              '<div class="info-cell" data-field="分路"><span>分路</span><b>' + eh(p.role) + '</b></div>' +
              '<div class="info-cell" data-field="荣誉"><span>荣誉</span><b>' + eh(p.titles || '—') + '</b></div>' +
              '<div class="info-cell"><span>资料更新</span><b>' + updated + '</b></div>' +
            '</div>' +
          '</article>' +
          '<article class="info-panel reveal in" data-delay="4">' +
            '<h3>属性</h3>' +
            '<div class="attribute-grid">' + statsHtml + '</div>' +
          '</article>' +
          (p.personality ? '<article class="info-panel reveal in" data-delay="5"><h3>性格</h3><p>' + eh(p.personality) + '</p></article>' : '') +
          (p.experience ? '<article class="info-panel reveal in" data-delay="6"><h3>经历</h3><p>' + eh(p.experience) + '</p></article>' : '') +
          (p.anchor ? '<article class="info-panel reveal in" data-delay="7"><h3>锚点</h3><p>' + eh(p.anchor) + '</p></article>' : '') +
          '<a class="back-link" href="../members/">返回队员阵容</a>' +
        '</div>' +
      '</div>' +
    '</section>';

  const title = (p.id_name || '选手') + ' - YHG电子竞技战队';
  const desc = (p.bio || p.id_name + ' - YHG战队选手资料');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="icon" type="image/webp" href="../resource/img/logo.webp">
    <link rel="apple-touch-icon" href="../resource/img/logo.webp">
    <meta name="description" content="${eh(desc)}">
    <link rel="canonical" href="${SITE}/members/profile.html?slug=${encodeURIComponent(slug)}">
    <meta property="og:type" content="profile">
    <meta property="og:locale" content="zh_CN">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${eh(desc)}">
    <meta property="og:url" content="${SITE}/members/profile.html?slug=${encodeURIComponent(slug)}">
    <meta property="og:image" content="${picUrl}">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#ea580c">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Rajdhani:wght@500;600;700&family=Noto+Sans+SC:wght@400;500;700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../resource/css/style.css">
    <style>
        .page-hero.member-hero { min-height: 66vh; }
        .loading { text-align:center; padding:80px 0; color:var(--dim); }
        .member-layout { display:grid; grid-template-columns:minmax(260px,360px) 1fr; gap:28px; align-items:start; }
        .member-portrait { position:sticky; top:88px; overflow:hidden; min-height:520px; padding:34px; border:1px solid var(--line-hot); border-radius:var(--r-lg); background:linear-gradient(180deg,rgba(255,255,255,0.5),var(--surface)),radial-gradient(60% 40% at 50% 24%,var(--fire-soft),transparent 60%),linear-gradient(155deg,rgba(251,191,36,0.20),rgba(239,68,68,0.12)); box-shadow:var(--shadow),0 0 40px var(--fire-glow); }
        .member-portrait::before { content:""; position:absolute; inset:16px; border:1px solid var(--line); border-radius:calc(var(--r-lg) - 8px); pointer-events:none; }
        .member-portrait-pic { position:relative; z-index:2; width:100%; height:300px; object-fit:cover; object-position:center top; border:1px solid var(--line-2); border-radius:var(--r); box-shadow:var(--shadow); }
        .member-portrait-content { position:relative; z-index:1; min-height:452px; display:flex; flex-direction:column; justify-content:flex-end; }
        .member-portrait .role { color:var(--fire); font-family:var(--mono); font-size:12px; font-weight:700; letter-spacing:0.22em; text-transform:uppercase; }
        .member-portrait h2 { margin-top:12px; color:var(--text); font-family:var(--display); font-size:clamp(30px,3vw,40px); letter-spacing:-0.01em; }
        .member-portrait p { margin-top:10px; color:var(--dim); line-height:1.8; }
        .member-info { display:grid; gap:20px; }
        .info-panel { position:relative; overflow:hidden; padding:30px; border:1px solid var(--line-2); border-radius:var(--r-lg); background:var(--surface); box-shadow:var(--shadow-sm); }
        .info-panel::before { content:""; position:absolute; right:0; top:0; width:22px; height:22px; background:var(--flame-grad); clip-path:polygon(100% 0,100% 100%,0 0); opacity:0.9; }
        .info-panel h3 { position:relative; z-index:1; color:var(--fire); font-family:var(--display); font-size:19px; letter-spacing:0.06em; text-transform:uppercase; }
        .info-panel p { margin-top:14px; color:var(--dim); line-height:1.95; }
        .info-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
        .info-cell { padding:16px 18px; border:1px solid var(--line); border-top:2px solid var(--fire-2); border-radius:var(--r-sm); background:var(--surface-2); }
        .info-cell:nth-child(even) { border-top-color:var(--spring-2); }
        .info-cell span { display:block; color:var(--faint); font-family:var(--mono); font-size:11px; letter-spacing:0.12em; text-transform:uppercase; }
        .info-cell b { display:block; margin-top:8px; color:var(--text); font-size:17px; font-weight:700; line-height:1.35; }
        .attribute-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:20px; }
        .attribute { padding:16px 18px; border:1px solid var(--line); border-radius:var(--r-sm); background:var(--surface-2); }
        .attribute span { display:flex; justify-content:space-between; color:var(--dim); font-family:var(--mono); font-weight:700; font-size:13px; letter-spacing:0.04em; }
        .attribute span b { color:var(--fire); }
        .attribute i { display:block; height:7px; margin-top:12px; overflow:hidden; border-radius:4px; background:rgba(58,45,30,0.08); }
        .attribute i::before { content:""; display:block; width:var(--value,50%); height:100%; border-radius:4px; background:var(--flame-grad); box-shadow:0 0 8px var(--fire-glow); }
        .back-link { display:inline-flex; align-items:center; gap:10px; color:var(--fire); font-family:var(--mono); font-weight:700; letter-spacing:0.1em; text-transform:uppercase; text-decoration:none; transition:color 0.25s var(--ease),gap 0.25s var(--ease); }
        .back-link::before { content:"←"; transition:transform 0.25s; }
        .back-link:hover { gap:14px; }
        @media (max-width:860px) { .member-layout { grid-template-columns:1fr; } .member-portrait { position:relative; top:auto; min-height:380px; } .info-grid, .attribute-grid { grid-template-columns:1fr; } }
        @media (max-width:640px) { .member-portrait { padding:24px; } .info-panel { padding:24px; } }
    </style>
</head>
<body>
    <header class="site-header">
        <a class="brand" href="../" aria-label="返回首页"><img src="../resource/img/logo.webp" alt="YHG"><span>YHG</span></a>
        <nav class="nav" aria-label="主导航">
            <a href="../">HOME</a>
            <a href="../about/">ABOUT</a>
            <a class="active" href="../members/">ROSTER</a>
            <a href="../matches/">MATCHES</a>
            <a href="../news/">NEWS</a>
        </nav>
        <span id="authWidget" style="cursor:default;">选手</span>
    </header>

    <main id="mainContent" data-ssr="1">
        ${hero}
        ${body}
    </main>

    <footer><p>© 2026 YHG ESPORTS</p></footer>

    <script defer src="../resource/js/main.js"></script>
    <script defer src="../resource/js/auth.js"></script>
    <script defer src="../resource/js/members-profile.js"></script>
</body>
</html>`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');

  const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' };

  if (!slug) {
    return new Response(renderProfileHtml({ id_name: '缺少选手标识' }, ''), { status: 200, headers });
  }

  const player = await env.DB.prepare('SELECT * FROM players WHERE slug = ?').bind(slug).first();
  if (!player) {
    const notFound = renderProfileHtml({ id_name: '选手不存在', bio: '未找到该选手资料' }, slug);
    return new Response(notFound, { status: 404, headers });
  }

  return new Response(renderProfileHtml(player, slug), { status: 200, headers });
}
