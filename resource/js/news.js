/**
 * YHG News — 新闻列表页逻辑
 * 搜索、分页、文章卡片渲染
 * 依赖：main.js（window.escapeHtml, window.__revealIO）
 */
(function() {
  'use strict';

  let newsQuery = '';
  let newsPage = 1;

  const grid = document.getElementById('newsGrid');
  if (!grid) return;

  (async function() {
    try {
      const meResp = await fetch('/api/auth/me');
      if (meResp.ok) {
        const action = document.getElementById('newsAction');
        if (action) action.innerHTML = '<a class="primary-btn" href="write.html" style="text-decoration:none;">\u270F \u5199\u6587\u7AE0</a>';
      }
    } catch(e) {}
    const up = new URLSearchParams(window.location.search);
    const q = up.get('q');
    const p = parseInt(up.get('page')) || 1;
    if (q) { document.getElementById('searchInput').value = q; newsQuery = q; }
    newsPage = p;
    load(newsPage);
  })();

  function updateUrl() {
    const params = new URLSearchParams();
    if (newsQuery) params.set('q', newsQuery);
    if (newsPage > 1) params.set('page', newsPage);
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
  }

  window.loadNews = function(page) {
    newsQuery = document.getElementById('searchInput').value.trim();
    newsPage = page;
    load(page);
  };

  // 清洗摘要内容：转 <br>/</p> 为换行后剥标签
  function cleanSummary(text) {
    return text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p\s*\/?>/gi, '')
      .replace(/<[^>]+>/g, '');
  }

  async function load(page) {
    const grid = document.getElementById('newsGrid');
    const pagi = document.getElementById('pagination');
    updateUrl();

    grid.innerHTML = '<div class="grid-card skeleton" style="min-height:200px;"></div>'.repeat(6);
    pagi.innerHTML = '';

    try {
      let url = '/api/news?page=' + page + '&limit=6';
      if (newsQuery) url += '&q=' + encodeURIComponent(newsQuery);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error();
      const data = await resp.json();

      if (data.articles && data.articles.length > 0) {
        let html = '';
        data.articles.forEach(function(a, i) {
          const date = a.created_at ? new Date(a.created_at + 'Z').toLocaleDateString('zh-CN') : '';
          const safeTitle = window.escapeHtml(a.title);
          const safeAuthor = window.escapeHtml(a.username);
          const raw = a.summary || a.content;
          const summary = window.escapeHtml(cleanSummary(raw).substring(0, 60)) + '...';
          const likes = a.like_count ? '\u2764 ' + a.like_count : '';
          const delay = Math.min(i + 3, 6);
          html += '<a class="grid-card reveal" data-delay="' + delay + '" href="article.html?slug=' + a.slug + '">'
            + '<div class="meta">' + date + ' \u00B7 ' + safeAuthor + (likes ? ' \u00B7 ' + likes : '') + '</div>'
            + '<h3>' + safeTitle + '</h3>'
            + '<p>' + summary + '</p>'
            + '</a>';
        });
        grid.innerHTML = html;
        if (window.__revealIO) {
          document.querySelectorAll('#newsGrid .reveal:not(.in)').forEach(function(el) {
            window.__revealIO.observe(el);
          });
        }
      } else {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">'
          + '<div class="empty-icon">' + (newsQuery ? '🔍' : '📝') + '</div>'
          + '<p>' + (newsQuery ? '没有找到匹配的文章，试试其他关键词' : '暂无文章，快来写下第一篇吧！') + '</p>'
          + '</div>';
      }

      if (data.totalPages > 1) {
        let phtml = '';
        if (newsPage > 1) {
          phtml += '<button class="page-btn" onclick="loadNews(' + (newsPage - 1) + ')">\u2190 \u4E0A\u4E00\u9875</button>';
        }
        for (let i = Math.max(1, newsPage - 2); i <= Math.min(data.totalPages, newsPage + 2); i++) {
          phtml += '<button class="page-btn' + (i === newsPage ? ' active' : '') + '" onclick="loadNews(' + i + ')">' + i + '</button>';
        }
        if (newsPage < data.totalPages) {
          phtml += '<button class="page-btn" onclick="loadNews(' + (newsPage + 1) + ')">\u4E0B\u4E00\u9875 \u2192</button>';
        }
        phtml += '<span class="page-info">' + data.total + ' \u7BC7</span>';
        pagi.innerHTML = phtml;
      }
    } catch(e) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">'
        + '<div class="empty-icon">⚠️</div>'
        + '<p>加载失败，请检查网络后重试</p>'
        + '</div>';
    }
  }
})();
