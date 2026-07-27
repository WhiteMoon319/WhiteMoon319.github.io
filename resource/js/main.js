/**
 * YHG Main — 公共逻辑
 * 包含：escapeHtml、IntersectionObserver 滚动动画、首页 API 数据加载
 * 所有页面共用
 */

/* ===== 工具函数 ===== */

/** 转义 HTML 防止 XSS */
window.escapeHtml = function(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str)));
  return d.innerHTML;
};

/* ===== Toast 提示系统 ===== */
(function() {
  const TOAST_DURATION = 2500;

  // 注入 toast 容器
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.style.cssText = 'position:fixed;top:80px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
  document.body.appendChild(container);

  window.showToast = function(msg, type) {
    type = type || 'info';
    const el = document.createElement('div');
    // 图标
    const icon = type === 'ok' || type === 'success' ? '\u2714\uFE0F' : type === 'err' || type === 'error' ? '\u274C' : '\u2139\uFE0F';
    el.innerHTML = '<span style="flex-shrink:0;font-size:16px;">' + icon + '</span>'
      + '<span>' + window.escapeHtml(String(msg)) + '</span>';
    el.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 20px;'
      + 'background:var(--surface,#fff);border:1px solid var(--line-2,#ddd);'
      + 'border-radius:var(--r-lg,12px);box-shadow:0 8px 30px rgba(26,26,46,0.12);'
      + 'font-size:14px;color:var(--text,#1a1a2e);pointer-events:auto;'
      + 'animation:toastIn 0.3s ease;max-width:380px;'
      + 'border-left:4px solid ' + (type === 'ok' || type === 'success' ? 'var(--spring-2,#2ecc71)' : type === 'err' || type === 'error' ? 'var(--fire,#c23630)' : 'var(--dim,#5c5c74)');
    container.appendChild(el);

    // 移除
    setTimeout(function() {
      el.style.opacity = '0';
      el.style.transform = 'translateX(30px)';
      el.style.transition = 'opacity 0.3s, transform 0.3s';
      setTimeout(function() { el.remove(); }, 300);
    }, TOAST_DURATION);
  };

  // 注入动画
  const style = document.createElement('style');
  style.textContent = '@keyframes toastIn { from { opacity:0; transform:translateX(30px); } to { opacity:1; transform:translateX(0); } }';
  document.head.appendChild(style);
})();

/* ===== 滚动渐入动画 ===== */
(function() {
  if (!window.IntersectionObserver) return;
  const revealIO = new IntersectionObserver(function(entries) {
    entries.forEach(function(en) {
      if (en.isIntersecting) {
        en.target.classList.add('in');
        revealIO.unobserve(en.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal:not(.in)').forEach(function(el) {
    revealIO.observe(el);
  });
  window.__revealIO = revealIO;
})();

/* ===== 比赛列表页 ===== */
(function() {
  const list = document.getElementById('matchList');
  if (!list) return;
  (async function() {
    try {
      const resp = await fetch('/api/matches');
      const data = await resp.json();
      const matches = data.matches || [];
      if (matches.length === 0) {
        list.innerHTML = '<div class="match-placeholder"><p>\u6682\u65E0\u6BD4\u8D5B\u8BB0\u5F55</p></div>';
        return;
      }
      let html = '';
      matches.forEach(function(m, i) {
        const badge = m.result === 'win' ? '<span class="badge win">\u80DC</span>' : m.result === 'lose' ? '<span class="badge lose">\u8D1F</span>' : m.result === 'draw' ? '<span class="badge draw">\u5E73</span>' : '';
        const delay = Math.min(i + 3, 6);
        html += '<div class="match-card reveal" data-delay="' + delay + '">'
          + '<div class="date">' + m.match_date + '</div>'
          + '<div class="vs"><h3>' + window.escapeHtml(m.title) + '</h3><div class="opponent">vs ' + window.escapeHtml(m.opponent) + '</div></div>'
          + (m.score ? '<div class="score">' + window.escapeHtml(m.score) + '</div>' : '')
          + '<div class="result">' + badge + '</div>'
          + (m.description ? '<div class="desc">' + window.escapeHtml(m.description) + '</div>' : '')
          + '</div>';
      });
      list.innerHTML = html;
      if (window.__revealIO) {
        document.querySelectorAll('.match-card.reveal:not(.in)').forEach(function(el) {
          window.__revealIO.observe(el);
        });
      }
    } catch(e) {
      list.innerHTML = '<div class="match-placeholder"><p>\u52A0\u8F7D\u5931\u8D25</p></div>';
    }
  })();
})();
/* ===== 首页 API 数据加载 ===== */
(function() {
  if (!document.querySelector('.hero-content')) return;
  (async function() {
    try {
      const resp = await fetch('/api/home');
      const data = await resp.json();
      if (!data.ok) return;

      const sec = data.sections || {};

      if (sec.hero_title) {
        const h1 = document.querySelector('.hero-content h1');
        if (h1) h1.innerHTML = h1.innerHTML.replace(/^[^<]+/, window.escapeHtml(sec.hero_title));
      }
      if (sec.hero_subtitle) {
        const p = document.querySelector('.hero-content > p');
        if (p) p.textContent = sec.hero_subtitle;
      }

      if (data.featured_match) {
        const m = data.featured_match;
        const quickSection = document.querySelector('#about .section-title');
        if (quickSection) {
          const badge = m.result === 'win' ? '\uD83C\uDFC6' : m.result === 'lose' ? '\uD83D\uDC4E' : m.result === 'draw' ? '\uD83E\uDD1D' : '\uD83D\uDD25';
          const info = document.createElement('div');
          info.className = 'home-featured-match';
          info.style.cssText = 'margin-top:20px;padding:16px 22px;background:var(--surface);border:1px solid var(--line-2);border-radius:var(--r-lg);display:flex;align-items:center;gap:16px;flex-wrap:wrap;';
          info.innerHTML = '<span style="font-size:24px;">' + badge + '</span>' +
            '<div><div style="font-weight:700;color:var(--text);">' + window.escapeHtml(m.title) + '</div>' +
            '<div style="font-size:13px;color:var(--dim);">vs ' + window.escapeHtml(m.opponent) + ' \u00B7 ' + window.escapeHtml(m.match_date) + (m.score ? ' \u00B7 ' + window.escapeHtml(m.score) : '') + '</div></div>' +
            '<a href="matches/" style="margin-left:auto;font-size:12px;font-weight:700;color:var(--fire);text-decoration:none;">\u67E5\u770B\u8D5B\u4E8B \u2192</a>';
          quickSection.parentElement.insertBefore(info, quickSection.nextSibling);
        }
      }
    } catch(e) { /* 静默降级 */ }
  })();
})();
