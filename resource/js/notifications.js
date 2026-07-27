/**
 * YHG Notifications Page — 通知列表页
 * 支持分类 tabs + 删除 + 私信
 */
(function() {
  'use strict';

  let currentPage = 1;
  let currentType = '';
  const limit = 20;

  const TABS = [
    { type: '', label: '全部', icon: '\uD83D\uDD14' },
    { type: 'system', label: '系统公告', icon: '\uD83D\uDCE2' },
    { type: 'comment', label: '评论与回复', icon: '\uD83D\uDCAC' },
    { type: 'like', label: '赞', icon: '\u2764\uFE0F' },
    { type: 'private_message', label: '私信', icon: '\uD83D\uDC8C' }
  ];

  function getTypeIcon(type) {
    return type === 'system' ? '\uD83D\uDCE2' :
      type === 'comment' || type === 'reply' ? '\uD83D\uDCAC' :
      type === 'like_article' || type === 'like_comment' ? '\u2764\uFE0F' :
      type === 'private_message' ? '\uD83D\uDC8C' :
      type === 'article_approved' ? '\u2705' :
      type === 'article_rejected' ? '\u274C' : '\uD83D\uDD14';
  }

  async function loadPage(page) {
    currentPage = page;
    const list = document.getElementById('notifList');
    const ctrl = document.getElementById('notifPageControls');
    if (!list) return;

    list.innerHTML = '<div class="notif-empty">加载中…</div>';

    try {
      const typeParam = currentType ? '&type=' + encodeURIComponent(currentType) : '';
      const resp = await fetch('/api/notifications?page=' + page + '&limit=' + limit + typeParam);
      const data = await resp.json();

      if (!data.ok) {
        window.location.href = '/login/';
        return;
      }

      const notifs = data.notifications || [];
      if (notifs.length === 0) {
        list.innerHTML = '<div class="notif-empty">暂无通知</div>';
        if (ctrl) ctrl.innerHTML = '';
        return;
      }

      list.innerHTML = notifs.map(function(n) {
        const cls = n.is_read ? 'notif-item read' : 'notif-item unread';
        const time = n.created_at ? new Date(n.created_at + 'Z').toLocaleDateString('zh-CN', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        }) : '';
        const typeIcon = getTypeIcon(n.type);
        // 私信显示发送者
        let fromInfo = '';
        if (n.type === 'private_message' && n.from_username) {
          fromInfo = '<div style="font-size:11px;color:var(--faint);">来自 ' + window.escapeHtml(n.from_username) + '</div>';
        }
        const linkHref = n.type === 'private_message' ? '/messages/' : (n.link || '#');
        return '<div class="' + cls + '" data-id="' + n.id + '" data-href="' + window.escapeHtml(linkHref) + '">'
          + '<span class="notif-dot"></span>'
          + '<div class="notif-content">'
          + '<div class="notif-title">' + typeIcon + ' ' + window.escapeHtml(n.title) + '</div>'
          + (n.body ? '<div class="notif-body">' + window.escapeHtml(n.body) + '</div>' : '')
          + fromInfo
          + '<div class="notif-time">' + time + '</div>'
          + '</div>'
          + '<button class="notif-del-btn" data-id="' + n.id + '" title="删除">×</button>'
          + '</div>';
      }).join('');

      // 分页控件
      if (ctrl) {
        const totalPages = Math.ceil((data.unread_count + notifs.length) / limit);
        let btns = '';
        if (page > 1) {
          btns += '<button class="notif-page-btn" data-page="' + (page - 1) + '">上一页</button>';
        }
        btns += '<span style="padding:8px 12px;font-size:13px;color:var(--dim);">' + page + '</span>';
        btns += '<button class="notif-page-btn" data-page="' + (page + 1) + '"' + (notifs.length < limit ? ' disabled' : '') + '>下一页</button>';
        ctrl.innerHTML = btns;

        ctrl.querySelectorAll('[data-page]').forEach(function(btn) {
          btn.addEventListener('click', function() {
            const p = parseInt(this.dataset.page);
            if (!isNaN(p)) loadPage(p);
          });
        });
      }

      // 点击通知 — 跳转 + 标记已读
      list.querySelectorAll('.notif-item').forEach(function(item) {
        item.addEventListener('click', async function(e) {
          if (e.target.closest('.notif-del-btn')) return;
          const id = parseInt(this.dataset.id);
          const href = this.dataset.href;
          if (id) {
            await fetch('/api/notifications/read', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: id })
            });
          }
          if (href && href !== '#') {
            // 仅允许 http(s) 协议或站内相对路径，防止 javascript: 等协议注入
            if (/^(https?:)?\/\//i.test(href) || href.startsWith('/')) {
              window.location.href = href;
            }
          }
        });

        // hover 删除按钮
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
            // 如果空了
            if (list.querySelectorAll('.notif-item').length === 0) {
              list.innerHTML = '<div class="notif-empty">暂无通知</div>';
              if (ctrl) ctrl.innerHTML = '';
            }
            // 刷新铃铛 badge
            if (window.updateBadge) await window.updateBadge();
          });
        }
      });

    } catch(e) {
      list.innerHTML = '<div class="notif-empty">加载失败</div>';
    }
  }

  // 渲染分类 tabs
  function renderTabs() {
    const tabBar = document.getElementById('notifTabs');
    if (!tabBar) return;
    tabBar.innerHTML = TABS.map(function(t) {
      const active = t.type === currentType ? ' active' : '';
      return '<button class="notif-tab' + active + '" data-type="' + t.type + '">' + t.icon + ' ' + t.label + '</button>';
    }).join('');

    tabBar.addEventListener('click', function(e) {
      const btn = e.target.closest('.notif-tab');
      if (!btn) return;
      currentType = btn.dataset.type;
      // 更新 active
      tabBar.querySelectorAll('.notif-tab').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      // 重新加载第一页
      loadPage(1);
    });
  }

  // 全部已读
  document.getElementById('markAllReadPage')?.addEventListener('click', async function() {
    await fetch('/api/notifications/read', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    loadPage(currentPage);
    // 同步铃铛 badge
    try {
      const r = await fetch('/api/notifications?unread=1');
      const d = await r.json();
      const badge = document.querySelector('.notif-badge');
      if (badge) {
        if (d.ok && d.unread_count > 0) {
          badge.textContent = d.unread_count > 99 ? '99+' : d.unread_count;
          badge.classList.add('show');
        } else {
          badge.classList.remove('show');
        }
      }
    } catch(e) {}
  });

  // 初始化
  renderTabs();
  loadPage(1);
})();
