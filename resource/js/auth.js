/**
 * YHG Auth — 全局导航栏认证状态 + 通知铃铛
 */

// ===== 通知铃铛样式（自动注入） =====
(function() {
  if (document.getElementById('nstyles')) return;
  const s = document.createElement('style');
  s.id = 'nstyles';
  s.textContent = `
    .notif-bell-wrap { position:relative; display:inline-flex; align-items:center; }
    .notif-bell { position:relative; display:inline-flex; align-items:center; justify-content:center;
      width:36px; height:36px; cursor:pointer; border-radius:50%;
      transition:background 0.2s; font-size:18px; line-height:1; }
    .notif-bell:hover { background:rgba(194,58,48,0.08); }
    .notif-badge { position:absolute; top:-2px; right:-2px; min-width:16px; height:16px;
      padding:0 4px; font-size:10px; font-weight:700; line-height:16px; text-align:center;
      color:#fff; background:var(--fire,#c23630); border-radius:99px;
      box-shadow:0 0 0 2px var(--bg,#faf6ef); display:none; }
    .notif-badge.show { display:block; }
    .notif-dropdown { position:absolute; top:calc(100% + 8px); right:-8px; width:340px;
      max-height:420px; overflow-y:auto; background:var(--surface,#fff);
      border:1px solid var(--line-2,#ddd); border-radius:var(--r-lg,12px);
      box-shadow:0 12px 40px rgba(26,26,46,0.15); z-index:999;
      display:none; }
    .notif-dropdown.open { display:block; }
    .notif-dropdown-header { display:flex; justify-content:space-between; align-items:center;
      padding:12px 16px; border-bottom:1px solid var(--line,#e0dbd2);
      font-size:13px; font-weight:700; color:var(--text,#1a1a2e); }
    .notif-mark-read { font-size:11px; font-weight:600; color:var(--fire,#c23630);
      cursor:pointer; background:none; border:none; padding:2px 6px;
      transition:opacity 0.2s; }
    .notif-mark-read:hover { opacity:0.7; }
    .notif-item { display:flex; gap:10px; padding:12px 16px; border-bottom:1px solid var(--line,#e0dbd2);
      cursor:pointer; transition:background 0.2s; text-decoration:none; color:inherit;
      align-items:flex-start; }
    .notif-item:hover { background:rgba(194,58,48,0.04); }
    .notif-item:last-child { border-bottom:none; }
    .notif-item.unread { background:rgba(194,58,48,0.03); }
    .notif-dot { width:8px; height:8px; border-radius:50%; background:var(--fire,#c23630);
      flex-shrink:0; margin-top:5px; }
    .notif-item.read .notif-dot { background:transparent; }
    .notif-content { flex:1; min-width:0; }
    .notif-title { font-size:13px; font-weight:600; color:var(--text,#1a1a2e);
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .notif-body { font-size:12px; color:var(--dim,#5c5c74); margin:2px 0 4px;
      line-height:1.4; word-break:break-word; }
    .notif-time { font-size:10px; color:var(--faint,#8c8ca1); font-family:var(--mono,monospace); }
    .notif-empty { padding:40px 20px; text-align:center; color:var(--dim,#5c5c74); font-size:13px; }
    .notif-footer { padding:10px 16px; border-top:1px solid var(--line,#e0dbd2);
      text-align:center; }
    .notif-footer a { font-size:12px; font-weight:700; color:var(--fire,#c23630);
      text-decoration:none; }
    .notif-footer a:hover { text-decoration:underline; }

    /* 通知页面样式 */
    .notif-page { max-width:680px; margin:0 auto; padding:120px 22px 80px; }
    .notif-page h1 { font-family:var(--display,serif); font-size:28px; color:var(--text,#1a1a2e);
      margin:0 0 24px; }
    .notif-page .notif-list { border:1px solid var(--line-2,#ddd);
      border-radius:var(--r-lg,12px); overflow:hidden;
      background:var(--surface,#fff); box-shadow:var(--shadow-sm); }
    .notif-page .notif-item { border-bottom:1px solid var(--line,#e0dbd2); }
    .notif-page .notif-item:last-child { border-bottom:none; }
    .notif-page-controls { display:flex; justify-content:center; gap:10px;
      margin-top:20px; flex-wrap:wrap; }
    .notif-page-btn { padding:8px 18px; font-family:var(--mono,monospace); font-size:12px;
      font-weight:700; border:1px solid var(--line-2,#ddd); border-radius:var(--r-sm,8px);
      background:var(--surface,#fff); color:var(--text,#1a1a2e); cursor:pointer;
      transition:all 0.2s; }
    .notif-page-btn:hover { border-color:var(--fire,#c23630); color:var(--fire,#c23630); }
    .notif-page-btn:disabled { opacity:0.4; cursor:default; }
    .notif-page-btn.active { background:var(--fire,#c23630); color:#fff; border-color:var(--fire,#c23630); }
    .notif-page-top { display:flex; justify-content:space-between; align-items:center;
      margin-bottom:16px; flex-wrap:wrap; gap:8px; }
    .notif-dropdown-body { max-height:360px; overflow-y:auto; }
    .notif-item:hover .notif-del-btn { opacity:1 !important; }
    .notif-del-btn { background:none; border:none; color:var(--faint); cursor:pointer;
      font-size:16px; padding:2px 6px; flex-shrink:0; opacity:0;
      transition:opacity 0.2s; border-radius:4px; line-height:1; }
    .notif-del-btn:hover { background:rgba(194,58,48,0.1); color:var(--fire); }
  `;
  document.head.appendChild(s);
})();

// ===== 通知铃铛组件 =====
let notifDropdownOpen = false;

async function renderNotifBell(container) {
  const wrap = document.createElement('div');
  wrap.className = 'notif-bell-wrap';

  // 铃铛
  const bell = document.createElement('div');
  bell.className = 'notif-bell';
  bell.innerHTML = '<span>\uD83D\uDD14</span>';
  bell.setAttribute('role', 'button');
  bell.setAttribute('aria-label', '\u901A\u77E5');
  bell.setAttribute('tabindex', '0');

  // 角标
  const badge = document.createElement('span');
  badge.className = 'notif-badge';
  bell.appendChild(badge);

  // 下拉
  const dd = document.createElement('div');
  dd.className = 'notif-dropdown';
  dd.innerHTML = '<div class="notif-dropdown-header"><span>\u901A\u77E5</span><button class="notif-mark-read" id="markAllRead">\u5168\u90E8\u5DF2\u8BFB</button></div>'
    + '<div class="notif-dropdown-body" id="notifDropdownBody"><div class="notif-empty">\u52A0\u8F7D\u4E2D\u2026</div></div>'
    + '<div class="notif-footer" id="notifDropdownFooter"><a href="/notifications/">\u67E5\u770B\u5168\u90E8</a> \u00B7 <a href="/messages/">\u79C1\u4FE1</a></div>';

  wrap.appendChild(bell);
  wrap.appendChild(dd);
  container.appendChild(wrap);

  const bodyContainer = dd.querySelector('#notifDropdownBody');
  const footerEl = dd.querySelector('#notifDropdownFooter');

  // 更新未读数
  async function updateBadge() {
    try {
      const r = await fetch('/api/notifications?unread=1');
      const d = await r.json();
      if (d.ok && d.unread_count > 0) {
        badge.textContent = d.unread_count > 99 ? '99+' : d.unread_count;
        badge.classList.add('show');
      } else {
        badge.classList.remove('show');
      }
    } catch(e) { /* silent */ }
  }

  // 渲染通知列表（只替换 bodyContainer 内容）
  async function loadDropdown() {
    if (!bodyContainer) return;
    bodyContainer.innerHTML = '<div class="notif-empty">\u52A0\u8F7D\u4E2D\u2026</div>';
    try {
      const r = await fetch('/api/notifications?limit=5');
      const d = await r.json();
      if (!d.ok || !d.notifications || d.notifications.length === 0) {
        bodyContainer.innerHTML = '<div class="notif-empty">\u6682\u65E0\u901A\u77E5</div>';
        if (footerEl) footerEl.innerHTML = '<a href="/notifications/">\u67E5\u770B\u5168\u90E8</a>';
        return;
      }
      const items = d.notifications.map(function(n) {
        const cls = n.is_read ? 'notif-item read' : 'notif-item unread';
        const time = n.created_at ? n.created_at.split('T')[0] : '';
        const typeIcon = n.type === 'system' ? '\uD83D\uDCE2' :
          n.type === 'comment' || n.type === 'reply' ? '\uD83D\uDCAC' :
          n.type === 'like_article' || n.type === 'like_comment' ? '\u2764\uFE0F' :
          n.type === 'private_message' ? '\uD83D\uDC8C' :
          n.type === 'article_approved' ? '\u2705' :
          n.type === 'article_rejected' ? '\u274C' : '\uD83D\uDD14';
        const linkHref = n.type === 'private_message' ? '/messages/' : (n.link || '/notifications/');
        const privateMsgHint = n.from_username && n.type === 'private_message'
          ? '<div style="font-size:11px;color:var(--faint);">来自 ' + window.escapeHtml(n.from_username) + '</div>'
          : '';
        return '<div class="' + cls + '" data-id="' + n.id + '" data-type="' + n.type + '" data-href="' + window.escapeHtml(linkHref) + '">'
          + '<span class="notif-dot"></span>'
          + '<div class="notif-content" style="cursor:pointer;">'
          + '<div class="notif-title">' + typeIcon + ' ' + window.escapeHtml(n.title) + '</div>'
          + (n.body ? '<div class="notif-body">' + window.escapeHtml(n.body) + '</div>' : '')
          + privateMsgHint
          + '<div class="notif-time">' + time + '</div>'
          + '</div>'
          + '<button class="notif-del-btn" data-id="' + n.id + '" title="\u5220\u9664" style="background:none;border:none;color:var(--faint);cursor:pointer;font-size:14px;padding:2px;flex-shrink:0;opacity:0;transition:opacity 0.2s;">\u00D7</button>'
          + '</div>';
      }).join('');
      bodyContainer.innerHTML = items;
      if (footerEl) footerEl.innerHTML = '<a href="/notifications/">\u67E5\u770B\u5168\u90E8 (' + d.unread_count + ' \u6761\u672A\u8BFB)</a>';

      // 删除按钮 hover 显示
      bodyContainer.querySelectorAll('.notif-item').forEach(function(item) {
        const del = item.querySelector('.notif-del-btn');
        if (del) {
          item.addEventListener('mouseenter', function() { del.style.opacity = '1'; });
          item.addEventListener('mouseleave', function() { del.style.opacity = '0'; });
          del.addEventListener('click', async function(e) {
            e.stopPropagation();
            const id = parseInt(this.dataset.id);
            if (!id) return;
            await fetch('/api/notifications/' + id, { method: 'DELETE' });
            item.remove();
            updateBadge();
            // 如果空了，显示空状态
            if (bodyContainer.querySelectorAll('.notif-item').length === 0) {
              bodyContainer.innerHTML = '<div class="notif-empty">\u6682\u65E0\u901A\u77E5</div>';
              if (footerEl) footerEl.innerHTML = '<a href="/notifications/">\u67E5\u770B\u5168\u90E8</a>';
            }
          });
        }
      });
    } catch(e) {
      if (bodyContainer) bodyContainer.innerHTML = '<div class="notif-empty">\u52A0\u8F7D\u5931\u8D25</div>';
    }
  }

  // 切换下拉
  function toggleDropdown(e) {
    e.stopPropagation();
    notifDropdownOpen = !notifDropdownOpen;
    dd.classList.toggle('open', notifDropdownOpen);
    if (notifDropdownOpen) {
      loadDropdown();
    }
  }

  bell.addEventListener('click', toggleDropdown);

  // 键盘 Enter/Space
  bell.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      bell.click();
    }
  });

  // 点击外部关闭
  document.addEventListener('click', function(e) {
    if (notifDropdownOpen && !wrap.contains(e.target)) {
      notifDropdownOpen = false;
      dd.classList.remove('open');
    }
  });

  // 事件委托：点击通知项跳转 + 标记已读
  bodyContainer.addEventListener('click', async function(e) {
    const item = e.target.closest('.notif-item');
    if (!item) return;
    const id = parseInt(item.dataset.id);
    const link = '/notifications/?highlight=' + id; // 跳转到通知页高亮
    if (id) {
      await fetch('/api/notifications/read', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id }) });
    }
    // 私信跳转到消息页
    if (item.dataset.type === 'private_message') {
      window.location.href = '/messages/';
    } else {
      window.location.href = link;
    }
  });

  // 全部已读（事件委托在 dd 上）
  dd.addEventListener('click', async function(e) {
    if (e.target.id === 'markAllRead') {
      e.stopPropagation();
      await fetch('/api/notifications/read', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      // 强制刷新 UI
      bodyContainer.querySelectorAll('.notif-item').forEach(function(item) {
        item.classList.remove('unread');
        item.classList.add('read');
      });
      badge.classList.remove('show');
      if (footerEl) {
        const count = bodyContainer.querySelectorAll('.notif-item').length;
        footerEl.innerHTML = '<a href="/notifications/">\u67E5\u770B\u5168\u90E8' + (count > 0 ? ' (' + count + ' \u6761)' : '') + '</a>';
      }
      // 重新获取未读数
      await updateBadge();
    }
  });

  // 初始加载
  updateBadge();
  // 每 30 秒轮询（标签页隐藏时暂停，节能）
  let notifTimer = setInterval(updateBadge, 30000);
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      clearInterval(notifTimer);
      notifTimer = null;
    } else if (!notifTimer) {
      updateBadge();
      notifTimer = setInterval(updateBadge, 30000);
    }
  });
}

// ===== 主流程 =====
(async function() {
  try {
    const resp = await fetch('/api/auth/me');
    const data = resp.ok ? await resp.json() : null;

    // 找 #authWidget 容器；dashboard/login 等页面用 authStateBtn 静态占位，复用避免桌面端重复显示
    let container = document.getElementById('authWidget');
    if (!container) {
      container = document.getElementById('authStateBtn');
      if (container) {
        container.id = 'authWidget'; // 复用占位元素，避免「用户」文本与真实 pill 并存
      } else {
        container = document.createElement('div');
        container.id = 'authWidget';
        // display 布局由 style.css 的 #authWidget 规则控制（桌面 flex / 移动端隐藏）
        const nav = document.querySelector('.site-header .nav');
        if (nav) nav.after(container);
        else document.querySelector('.site-header')?.appendChild(container);
      }
    }

    // 汉堡菜单内的 auth 区块（移动端显示，桌面端 CSS 隐藏）
    const navEl = document.querySelector('.site-header .nav');
    let navAuth = document.getElementById('navAuth');
    if (navEl && !navAuth) {
      navAuth = document.createElement('div');
      navAuth.id = 'navAuth';
      navAuth.className = 'nav-auth';
      navEl.appendChild(navAuth);
    }

    if (data && data.ok) {
      // 已登录：一体化 pill
      const u = data.user;
      container.innerHTML = `
        <div style="
          display:inline-flex;align-items:center;gap:0;
          border:1px solid var(--line);border-radius:999px;
          overflow:hidden;transition:border-color 0.25s;
        " onmouseenter="this.style.borderColor='var(--line-hot)'" onmouseleave="this.style.borderColor='var(--line)'">
          <a href="/dashboard/" style="
            display:inline-flex;align-items:center;gap:6px;
            padding:4px 14px 4px 12px;
            font-family:var(--mono);font-size:12px;font-weight:700;
            letter-spacing:0.06em;color:var(--text);text-decoration:none;
            transition:color 0.2s;
          " onmouseenter="this.style.color='var(--fire)'" onmouseleave="this.style.color='var(--text)'">
            <span style="
              width:6px;height:6px;border-radius:50%;
              background:var(--spring-2);box-shadow:0 0 5px var(--spring-glow);
            "></span>
            ${escapeHtml(u.username)}
          </a>
          <span style="width:1px;height:14px;background:var(--line);flex-shrink:0;"></span>
          <span class="auth-logout" style="
            padding:4px 10px;
            font-family:var(--mono);font-size:11px;font-weight:700;
            letter-spacing:0.04em;color:var(--faint);cursor:pointer;
            transition:color 0.2s;
          " onmouseenter="this.style.color='var(--flame)'" onmouseleave="this.style.color='var(--faint)'">退出</span>
        </div>
      `;
      container.querySelector('.auth-logout')?.addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.reload();
      });

      // 添加通知铃铛
      renderNotifBell(container);

      // 移动端菜单内：已登录状态
      if (navAuth) {
        const isStaff = u.role === 'admin' || u.role === 'sub_admin';
        navAuth.innerHTML = `
          <a href="/dashboard/" style="color:var(--text);font-weight:700;">${escapeHtml(u.username)}</a>
          ${isStaff ? '<a href="/admin/">管理后台</a>' : ''}
          <a href="/notifications/">通知</a>
          <span class="nav-auth-logout" data-slug="">退出</span>
        `;
        navAuth.querySelector('.nav-auth-logout')?.addEventListener('click', async () => {
          await fetch('/api/auth/logout', { method: 'POST' });
          window.location.reload();
        });
      }
    } else {
      // 未登录
      container.innerHTML = `
        <a href="/login/" style="
          padding:6px 14px;color:var(--dim);font-family:var(--mono);font-size:12px;font-weight:700;
          letter-spacing:0.1em;text-decoration:none;transition:color 0.25s;
        " onmouseover="this.style.color='var(--fire)'" onmouseout="this.style.color='var(--dim)'">登录</a>
        <a href="/register/" style="
          display:inline-flex;align-items:center;justify-content:center;
          min-width:92px;height:34px;padding:0 16px;
          color:#fff;font-family:var(--mono);font-size:11px;font-weight:700;
          letter-spacing:0.16em;text-transform:uppercase;
          background:var(--flame-grad);border:1px solid rgba(255,255,255,0.4);
          border-radius:var(--r-sm);text-decoration:none;
          box-shadow:0 6px 18px var(--fire-glow), inset 0 1px 0 rgba(255,255,255,0.4);
          transition:transform 0.25s var(--ease), box-shadow 0.25s var(--ease);
        " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 12px 26px var(--fire-glow-2)'" onmouseout="this.style.transform='';this.style.boxShadow=''">注册</a>
      `;
      // 移动端菜单内：未登录显示登录/注册
      if (navAuth) {
        navAuth.innerHTML = `
          <a href="/login/">登录</a>
          <a href="/register/">注册</a>
        `;
      }
    }
  } catch (e) {
    // 静默失败，不影响页面
  }
})();

// === 移动端导航菜单 ===
(function() {
  const nav = document.querySelector('.nav');
  const header = document.querySelector('.site-header');
  if (!nav || !header) return;

  const toggle = document.createElement('button');
  toggle.className = 'nav-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', '导航菜单');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span></span><span></span><span></span>';

  const brand = header.querySelector('.brand');
  if (brand) brand.after(toggle);
  else header.appendChild(toggle);

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('menu-open');
    toggle.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });

  nav.addEventListener('click', () => {
    nav.classList.remove('menu-open');
    toggle.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
  });

  document.addEventListener('click', (e) => {
    if (!header.contains(e.target)) {
      nav.classList.remove('menu-open');
      toggle.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('menu-open')) {
      nav.classList.remove('menu-open');
      toggle.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
})();
