/**
 * YHG Main — 公共逻辑
 * 包含：escapeHtml、IntersectionObserver 滚动动画、首页 API 数据加载
 * 所有页面共用
 */

/* ===== 工具函数 ===== */

/** 转义 HTML 防止 XSS（包括引号，可安全用于属性上下文） */
window.escapeHtml = function(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
};

/* ===== CSRF 防护：所有 API 请求自动携带 X-Requested-By ===== */
(function() {
  const origFetch = window.fetch;
  window.fetch = function(input, init) {
    init = init || {};
    const reqUrl = typeof input === 'string' ? input : (input.url || '');
    // 只对同源 /api/ 请求添加
    if (
      reqUrl.startsWith('/api/') ||
      reqUrl.startsWith(window.location.origin + '/api/')
    ) {
      if (!init.method || init.method === 'GET' || init.method === 'HEAD') {
        return origFetch.call(window, input, init);
      }
      init.headers = init.headers || {};
      if (init.headers instanceof Headers) {
        init.headers.set('X-Requested-By', 'YHG');
      } else {
        init.headers['X-Requested-By'] = 'YHG';
      }
    }
    return origFetch.call(window, input, init);
  };
})();

/* ===== Service Worker 注册 ===== */
(function() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js').catch(function() {
        // 静默降级
      });
    });
  }
})();

/* ===== 页面加载进度条 ===== */
(function() {
  // Skip-to-content 无障碍链接
  var skip = document.createElement('a');
  skip.className = 'skip-link';
  skip.href = '#main-content';
  skip.textContent = '跳到主要内容';
  document.body.prepend(skip);
  var main = document.querySelector('main');
  if (main && !main.id) main.id = 'main-content';

  // Header 滚动阴影
  var header = document.querySelector('.site-header');
  if (header) {
    var hTicking = false;
    window.addEventListener('scroll', function() {
      if (!hTicking) {
        hTicking = true;
        requestAnimationFrame(function() {
          header.classList.toggle('scrolled', window.scrollY > 10);
          hTicking = false;
        });
      }
    }, { passive: true });
  }

  var bar = document.createElement('div');
  bar.id = 'page-progress';
  document.body.appendChild(bar);
  // 模拟进度
  bar.style.width = '30%';
  setTimeout(function() { bar.style.width = '70%'; }, 100);
  window.addEventListener('load', function() {
    bar.classList.add('done');
    setTimeout(function() { bar.remove(); }, 800);
  });
  // 如果页面已经加载完成
  if (document.readyState === 'complete') {
    bar.classList.add('done');
    setTimeout(function() { bar.remove(); }, 800);
  }
})();

/* ===== 回到顶部按钮 ===== */
(function() {
  var btn = document.createElement('button');
  btn.id = 'backToTop';
  btn.setAttribute('aria-label', '回到顶部');
  btn.innerHTML = '↑';
  document.body.appendChild(btn);

  var ticking = false;
  window.addEventListener('scroll', function() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(function() {
        if (window.scrollY > 500) {
          btn.classList.add('show');
        } else {
          btn.classList.remove('show');
        }
        ticking = false;
      });
    }
  }, { passive: true });

  btn.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

/* ===== 图片淡入加载 ===== */
(function() {
  function markLoaded(img) {
    if (img.complete && img.naturalWidth > 0) {
      img.classList.add('img-loaded');
    } else {
      img.addEventListener('load', function() { img.classList.add('img-loaded'); }, { once: true });
      img.addEventListener('error', function() { img.classList.add('img-loaded'); }, { once: true });
    }
  }
  // 处理已有图片
  document.querySelectorAll('img').forEach(markLoaded);
  // 监听动态插入的图片
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'IMG') markLoaded(node);
        node.querySelectorAll && node.querySelectorAll('img').forEach(markLoaded);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();

/* ===== Toast 提示系统 ===== */
(function() {
  const TOAST_DURATION = 2500;

  // 注入 toast 容器（样式在 CSS 中定义）
  const container = document.createElement('div');
  container.id = 'toast-container';
  document.body.appendChild(container);

  window.showToast = function(msg, type) {
    type = type || 'info';
    const el = document.createElement('div');
    el.className = 'toast-item toast-' + (type === 'ok' || type === 'success' ? 'success' : type === 'err' || type === 'error' ? 'error' : 'info');
    // 图标
    const icon = type === 'ok' || type === 'success' ? '\u2714\uFE0F' : type === 'err' || type === 'error' ? '\u274C' : '\u2139\uFE0F';
    el.innerHTML = '<span class="toast-icon">' + icon + '</span>'
      + '<span>' + window.escapeHtml(String(msg)) + '</span>';
    container.appendChild(el);

    // 移除
    setTimeout(function() {
      el.classList.add('toast-out');
      setTimeout(function() { el.remove(); }, 300);
    }, TOAST_DURATION);
  };
})();

/* ===== 确认对话框（原生 <dialog>） ===== */
(function() {
  window.showConfirm = function(msg) {
    return new Promise(function(resolve) {
      const dialog = document.createElement('dialog');
      dialog.className = 'confirm-dialog';
      dialog.innerHTML = '<form method="dialog">'
        + '<div class="confirm-msg">' + window.escapeHtml(String(msg)).replace(/\n/g, '<br>') + '</div>'
        + '<div class="confirm-actions">'
        + '<button value="cancel" class="confirm-cancel" autofocus>取消</button>'
        + '<button value="ok" class="confirm-ok">确定</button>'
        + '</div></form>';
      document.body.appendChild(dialog);
      dialog.showModal();
      dialog.addEventListener('close', function() {
        resolve(dialog.returnValue === 'ok');
        dialog.remove();
      });
    });
  };
})();

/* ===== View Transitions: 内部链接过渡 ===== */
(function() {
  if (!document.startViewTransition) return;
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a[href]');
    if (!link) return;
    if (e.metaKey || e.ctrlKey || e.button !== 0) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('//') || href.startsWith('javascript:') || link.hasAttribute('download') || link.hasAttribute('target')) return;
    e.preventDefault();
    document.startViewTransition(function() {
      window.location.href = href;
    });
  });
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
  // 骨架屏加载状态
  list.innerHTML = '<div class="grid-card skeleton" style="min-height:160px;"></div>'.repeat(4);
  (async function() {
    try {
      const resp = await fetch('/api/matches');
      const data = await resp.json();
      const matches = data.matches || [];
      if (matches.length === 0) {
        list.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">🏆</div><p>暂无比赛记录</p></div>';
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
      list.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">⚠️</div><p>加载失败，请检查网络后重试</p></div>';
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
