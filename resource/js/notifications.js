/**
 * YHG Notifications Page — 通知列表页逻辑
 */
(function() {
  'use strict';

  let currentPage = 1;
  const limit = 20;

  async function loadPage(page) {
    currentPage = page;
    const list = document.getElementById('notifList');
    const ctrl = document.getElementById('notifPageControls');
    if (!list) return;

    list.innerHTML = '<div class="notif-empty">加载中…</div>';

    try {
      const resp = await fetch('/api/notifications?page=' + page + '&limit=' + limit);
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
        // 类型图标
        const typeIcon = n.type === 'system' ? '\uD83D\uDCE2' :
          n.type === 'comment' || n.type === 'reply' ? '\uD83D\uDCAC' :
          n.type === 'like_article' || n.type === 'like_comment' ? '\u2764\uFE0F' :
          n.type === 'article_approved' ? '\u2705' :
          n.type === 'article_rejected' ? '\u274C' : '\uD83D\uDD14';
        return '<a class="' + cls + '" href="' + (n.link || '#') + '" data-id="' + n.id + '">'
          + '<span class="notif-dot"></span>'
          + '<div class="notif-content">'
          + '<div class="notif-title">' + typeIcon + ' ' + window.escapeHtml(n.title) + '</div>'
          + (n.body ? '<div class="notif-body">' + window.escapeHtml(n.body) + '</div>' : '')
          + '<div class="notif-time">' + time + '</div>'
          + '</div></a>';
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

      // 点击标记已读
      list.querySelectorAll('.notif-item').forEach(function(item) {
        item.addEventListener('click', async function(e) {
          // 让链接正常跳转，后台标记已读
          const id = parseInt(this.dataset.id);
          if (id) {
            await fetch('/api/notifications/read', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: id })
            });
          }
        });
      });

    } catch(e) {
      list.innerHTML = '<div class="notif-empty">加载失败</div>';
    }
  }

  // 全部已读
  document.getElementById('markAllReadPage')?.addEventListener('click', async function() {
    await fetch('/api/notifications/read', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    // 重载当前页
    loadPage(currentPage);
  });

  // 自动启动
  loadPage(1);
})();
