/**
 * /news/article.html — 服务端渲染（SSR）
 * 替代原静态空壳：从 D1 查文章，渲染标题/正文/点赞数，爬虫可直接索引
 * 前端 article.js 检测到 SSR 标记后只加载评论与绑定事件
 */
const SITE = 'https://yhg.whitemoon319.xyz';

function eh(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/** 正文渲染：保留原文 HTML 结构（<p>/<br> 等），供排版 CSS 处理
 * 内容由管理员后台写入，为受控来源；此处不再剥标签避免段落结构丢失 */
function cleanContent(content) {
  return content || '';
}

function renderArticleHtml(a, slug) {
  const title = a.title || '文章';
  const desc = (a.content || '').replace(/<[^>]+>/g, '').slice(0, 80) || 'YHG 战队新闻文章';
  const date = a.created_at ? String(a.created_at).split('T')[0] : '';
  const contentHtml = cleanContent(a.content || '');
  const likeCount = a.like_count || 0;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${eh(title)} - YHG电子竞技战队</title>
    <link rel="icon" type="image/webp" href="../resource/img/logo.webp">
    <link rel="apple-touch-icon" href="../resource/img/logo.webp">
    <meta name="description" content="${eh(desc)}">
    <link rel="canonical" href="${SITE}/news/article.html?slug=${encodeURIComponent(slug)}">
    <meta property="og:type" content="article">
    <meta property="og:locale" content="zh_CN">
    <meta property="og:title" content="${eh(title)} - YHG电子竞技战队">
    <meta property="og:description" content="${eh(desc)}">
    <meta property="og:url" content="${SITE}/news/article.html?slug=${encodeURIComponent(slug)}">
    <meta property="og:image" content="${SITE}/resource/img/logo.webp">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#ea580c">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Rajdhani:wght@500;600;700&family=Noto+Sans+SC:wght@400;500;700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../resource/css/style.css">
    <style>
        .article-wrap { max-width: 960px; margin: 0 auto; padding: 120px 24px 80px; }
        .article-card { padding: 56px 56px; background: var(--surface); border: 1px solid var(--line-2); border-radius: var(--r-lg); box-shadow: var(--shadow-lg); position: relative; overflow: hidden; }
        .article-card::before { content:""; position:absolute; top:0; left:0; right:0; height:3px; background: var(--flame-grad); }
        .article-card h1 { font-family: var(--display); font-size: 34px; color: var(--text); margin: 0 0 8px; }
        .article-meta { display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px; color: var(--faint); margin-bottom: 32px; padding-bottom: 20px; border-bottom: 1px solid var(--line); }
        .article-meta span { display: flex; align-items: center; gap: 6px; }
        .article-body { font-size: 1.06rem; line-height: 2.1; color: var(--text); word-break: break-word; }
        .article-body > *:first-child { margin-top: 0; }
        .article-body h2, .article-body h3, .article-body h4 { font-family: var(--display); font-weight: 700; letter-spacing: 0.04em; color: var(--text); line-height: 1.45; }
        .article-body h2 { font-size: 1.55rem; margin: 2.2em 0 0.8em; padding-bottom: 0.3em; border-bottom: 1px solid var(--line-2); }
        .article-body h3 { font-size: 1.3rem; margin: 2em 0 0.7em; }
        .article-body h4 { font-size: 1.12rem; margin: 1.8em 0 0.6em; }
        .article-body p { margin: 0 0 1.4em; text-align: justify; }
        .article-body a { color: var(--fire); text-decoration: underline; text-underline-offset: 3px; }
        .article-body strong { color: var(--text); font-weight: 700; }
        .article-body ul, .article-body ol { margin: 0 0 1.4em; padding-left: 1.6em; }
        .article-body li { margin: 0.35em 0; line-height: 1.9; }
        .article-body img { max-width: 100%; height: auto; border-radius: 8px; margin: 1.2em 0; }
        .article-body table { margin: 1.6em 0; width: 100%; border-collapse: collapse; font-size: 0.95rem; line-height: 1.7; overflow-x: auto; display: block; }
        .article-body th, .article-body td { padding: 0.5em 0.9em; border: 1px solid var(--line-2); text-align: left; }
        .article-body th { background: var(--surface-2); font-weight: 700; color: var(--text); }
        .article-body br { display: block; content:""; margin: 0.6em 0; }
        .article-actions { margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--line); display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
        .like-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; font-size: 14px; font-weight: 600; border-radius: 99px; cursor: pointer; transition: all 0.25s var(--ease); border: 1px solid var(--line-2); background: transparent; color: var(--dim); }
        .like-btn:hover { border-color: var(--fire); color: var(--fire); }
        .like-btn.liked { background: var(--fire-soft, #fff0f0); border-color: var(--fire); color: var(--fire); }
        .comment-section { margin-top: 32px; }
        .comment-section h3 { font-family: var(--display); font-size: 18px; color: var(--text); margin: 0 0 16px; }
        .comment-form { display: flex; gap: 10px; margin-bottom: 24px; }
        .comment-form input { flex: 1; padding: 10px 14px; border: 1px solid var(--line-2); border-radius: var(--r-sm); background: var(--bg); color: var(--text); font-size: 14px; outline: none; transition: border 0.2s; }
        .comment-form input:focus { border-color: var(--fire); }
        .comment-form button { padding: 10px 22px; font-family: var(--mono); font-size: 12px; font-weight: 700; background: var(--flame-grad); color: #fff; border: none; border-radius: var(--r-sm); cursor: pointer; white-space: nowrap; }
        .comment-form button:disabled { opacity: 0.5; cursor: not-allowed; }
        .comment-placeholder { text-align: center; padding: 30px 0; color: var(--dim); font-size: 14px; }
        .comment-item { padding: 12px 0; border-bottom: 1px solid var(--line); display: flex; gap: 12px; align-items: flex-start; }
        .comment-item:last-child { border-bottom: none; }
        .comment-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--surface-2); flex-shrink: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--dim); }
        .comment-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .comment-body { flex: 1; min-width: 0; }
        .comment-author { font-size: 13px; font-weight: 700; color: var(--text); margin-right: 8px; }
        .comment-time { font-size: 11px; color: var(--faint); }
        .comment-text { font-size: 14px; color: var(--text); margin: 4px 0 0; line-height: 1.5; }
        .comment-del { font-size: 11px; color: var(--flame); cursor: pointer; background: none; border: none; padding: 2px 6px; float: right; }
        .comment-del:hover { text-decoration: underline; }
        .comment-actions { display: flex; gap: 8px; align-items: center; margin-top: 6px; flex-wrap: wrap; }
        .comment-like-btn { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; font-size: 12px; color: var(--faint); background: transparent; border: 1px solid var(--line); border-radius: 99px; cursor: pointer; transition: all 0.2s; }
        .comment-like-btn:hover { border-color: var(--fire); color: var(--fire); }
        .comment-like-btn.liked { background: var(--fire-soft, #fff0f0); border-color: var(--fire); color: var(--fire); }
        .comment-like-btn .heart { font-size: 11px; }
        .reply-btn { padding: 2px 8px; font-size: 12px; color: var(--dim); background: transparent; border: 1px solid var(--line); border-radius: 99px; cursor: pointer; transition: all 0.2s; }
        .reply-btn:hover { border-color: var(--spring-2); color: var(--spring-3); }
        .reply-form { margin-top: 8px; }
        .reply-form-inner { display: flex; gap: 8px; }
        .reply-form-inner input { flex: 1; padding: 8px 12px; border: 1px solid var(--line-2); border-radius: var(--r-sm); background: var(--bg); color: var(--text); font-size: 13px; outline: none; }
        .reply-form-inner input:focus { border-color: var(--spring-2); }
        .reply-form-inner button { padding: 8px 14px; font-family: var(--mono); font-size: 11px; font-weight: 700; border-radius: var(--r-sm); cursor: pointer; white-space: nowrap; }
        .reply-submit { background: var(--flame-grad); color: #fff; border: none; }
        .reply-submit:disabled { opacity: 0.5; }
        .reply-cancel { background: transparent; border: 1px solid var(--line-2); color: var(--dim); }
        .comment-replies-toggle { font-size: 12px; color: var(--spring-3); cursor: pointer; margin: 6px 0 0 44px; }
        .comment-replies-toggle:hover { text-decoration: underline; }
        .empty-state { text-align: center; padding: 60px 20px; color: var(--dim); }
        .empty-state .empty-icon { font-size: 40px; margin-bottom: 12px; }
        .empty-state a { color: var(--fire); }
        /* 移动端阅读适配：满宽占满两侧，收窄卡片内边距 */
        @media (max-width: 640px) {
            .article-section { padding-left: 0; padding-right: 0; }
            .article-wrap { max-width: none; padding: 88px 0 60px; }
            .article-card { padding: 30px 20px; border-radius: 0; border-left: none; border-right: none; }
            .article-card h1 { font-size: 26px; }
            .article-body { font-size: 1rem; line-height: 2; }
            .article-body p { margin: 0 0 1.2em; }
        }
    </style>
</head>
<body>
    <header class="site-header">
        <a class="brand" href="../" aria-label="返回首页"><img src="../resource/img/logo.webp" alt="YHG"><span>YHG</span></a>
        <nav class="nav" aria-label="主导航">
            <a href="../">HOME</a>
            <a href="../about/">ABOUT</a>
            <a href="../members/">ROSTER</a>
            <a href="../matches/">MATCHES</a>
            <a class="active" href="../news/">NEWS</a>
        </nav>
        <span id="authWidget" style="cursor:default;">新闻</span>
    </header>

    <main>
        <section class="page-hero">
            <div class="embers" aria-hidden="true">${'<i></i>'.repeat(12)}</div>
            <div class="page-hero-content">
                <div class="eyebrow reveal in" data-delay="1">TEAM NEWS</div>
                <h1 class="reveal in" data-delay="2">文章<strong>详情</strong></h1>
            </div>
        </section>

        <section class="section article-section">
            <div class="article-wrap" data-ssr="1" data-article-id="${a.id}">
                <div class="article-card reveal in" data-delay="1">
                    <h1>${eh(title)}</h1>
                    <div class="article-meta">
                        <span>发布者 ${eh(a.username || '匿名')} · ${date}</span>
                        <span>${a.view_count || 0} 次阅读</span>
                    </div>
                    <div class="article-body">${contentHtml}</div>
                    <div class="article-actions">
                        <button class="like-btn" id="likeBtn">
                            <span class="heart">♡</span>
                            <span id="likeCount">${likeCount}</span>
                        </button>
                    </div>
                    <div class="comment-section">
                        <h3>评论</h3>
                        <div class="comment-form">
                            <input type="text" id="commentInput" placeholder="输入评论…">
                            <button id="submitComment">发送</button>
                        </div>
                        <div id="commentList"><p class="comment-placeholder">加载中…</p></div>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <footer><p>© 2026 YHG ESPORTS</p></footer>

    <script defer src="../resource/js/main.js"></script>
    <script defer src="../resource/js/auth.js"></script>
    <script defer src="../resource/js/article.js"></script>
</body>
</html>`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' };

  if (!slug) {
    return new Response('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>缺少文章标识</title></head><body><p>缺少文章标识</p></body></html>', { status: 400, headers });
  }

  const article = await env.DB.prepare(
    'SELECT a.*, u.username FROM articles a JOIN users u ON u.id = a.user_id WHERE a.slug = ?'
  ).bind(slug).first();

  if (!article) {
    return new Response('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>文章不存在</title></head><body><p>文章不存在</p></body></html>', { status: 404, headers });
  }

  // 与 API 一致：非 approved 仅作者/staff 可见
  if (article.status !== 'approved') {
    const { getAuthUser } = await import('../api/_auth.js');
    const user = await getAuthUser(request, env);
    const isStaff = user && (user.role === 'admin' || user.role === 'sub_admin');
    const isAuthor = user && user.id === article.user_id;
    if (!isAuthor && !isStaff) {
      return new Response('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>文章待审核</title></head><body><p>文章待审核</p></body></html>', { status: 403, headers });
    }
  }

  const likeCount = await env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM article_likes WHERE article_id = ?'
  ).bind(article.id).first();
  article.like_count = likeCount ? likeCount.cnt : 0;

  return new Response(renderArticleHtml(article, slug), { status: 200, headers });
}
