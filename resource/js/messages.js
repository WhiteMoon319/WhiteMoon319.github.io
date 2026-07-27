/**
 * YHG Messages Page — 私信页面
 */
(function() {
  'use strict';

  let currentView = 'inbox';

  async function loadMessages(view) {
    currentView = view;
    const list = document.getElementById('msgList');
    if (!list) return;

    list.innerHTML = '<div class="msg-empty">加载中…</div>';

    try {
      const endpoint = view === 'sent' ? '/api/messages/sent' : '/api/messages';
      const resp = await fetch(endpoint);
      const data = await resp.json();

      if (!data.ok) {
        window.location.href = '/login/';
        return;
      }

      const items = data.messages || [];
      if (items.length === 0) {
        list.innerHTML = '<div class="msg-empty">' + (view === 'sent' ? '暂无已发送的私信' : '暂无私信') + '</div>';
        return;
      }

      list.innerHTML = items.map(function(m) {
        const cls = m.is_read ? 'msg-item' : 'msg-item unread';
        const time = m.created_at ? new Date(m.created_at + 'Z').toLocaleDateString('zh-CN', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        }) : '';

        let fromInfo;
        if (view === 'sent') {
          fromInfo = '发给 ' + window.escapeHtml(m.to_username || '用户#' + m.to_user_id);
        } else {
          fromInfo = window.escapeHtml(m.from_username || '用户#' + m.from_user_id);
        }
        const avatar = view === 'sent'
          ? (m.to_avatar || '')
          : (m.from_avatar || '');

        return '<div class="' + cls + '" data-id="' + m.id + '">'
          + (avatar ? '<img class="msg-avatar" src="' + window.escapeHtml(avatar) + '" alt="">' : '<div class="msg-avatar" style="display:flex;align-items:center;justify-content:center;font-size:16px;">👤</div>')
          + '<div class="msg-content">'
          + '<div class="msg-sender">' + fromInfo + '</div>'
          + '<div class="msg-preview">' + window.escapeHtml(m.title || '') + '</div>'
          + (m.body ? '<div class="msg-preview" style="color:var(--text);margin-top:4px;">' + window.escapeHtml(m.body) + '</div>' : '')
          + '<div class="msg-time">' + time + '</div>'
          + '</div>'
          + '<button class="msg-del-btn" data-id="' + m.id + '" title="删除">×</button>'
          + '</div>';
      }).join('');

      // 删除
      list.querySelectorAll('.msg-del-btn').forEach(function(btn) {
        btn.addEventListener('click', async function(e) {
          e.stopPropagation();
          const id = parseInt(this.dataset.id);
          if (!id) return;
          await fetch('/api/notifications/' + id, { method: 'DELETE' });
          this.closest('.msg-item').remove();
          if (list.querySelectorAll('.msg-item').length === 0) {
            list.innerHTML = '<div class="msg-empty">' + (currentView === 'sent' ? '暂无已发送的私信' : '暂无私信') + '</div>';
          }
        });
      });

      // 点击标记已读
      list.querySelectorAll('.msg-item').forEach(function(item) {
        item.addEventListener('click', async function(e) {
          if (e.target.closest('.msg-del-btn')) return;
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
      list.innerHTML = '<div class="msg-empty">加载失败</div>';
    }
  }

  // 发送私信
  document.getElementById('sendMsgBtn')?.addEventListener('click', async function() {
    const toUserId = document.getElementById('msgToUserId').value.trim();
    const content = document.getElementById('msgContent').value.trim();
    const resultEl = document.getElementById('sendMsgResult');

    if (!toUserId) { resultEl.textContent = '请输入用户 ID'; return; }
    if (!content) { resultEl.textContent = '请输入消息内容'; return; }

    const btn = document.getElementById('sendMsgBtn');
    btn.disabled = true;
    btn.textContent = '发送中…';

    try {
      const resp = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_user_id: parseInt(toUserId), content: content })
      });
      const data = await resp.json();
      if (data.ok) {
        resultEl.textContent = '✅ 私信已发送';
        document.getElementById('msgContent').value = '';
        // 刷新收件箱（如果当前是收件箱，切换一下就刷新）——实际上收件箱看不到自己发的，但通知已发送列表会显示
        if (currentView === 'sent') loadMessages('sent');
      } else {
        resultEl.textContent = '❌ ' + (data.error || '发送失败');
      }
    } catch(e) {
      resultEl.textContent = '❌ 网络错误';
    }

    btn.disabled = false;
    btn.textContent = '发送';
  });

  // Tabs
  document.getElementById('msgTabs')?.addEventListener('click', function(e) {
    const btn = e.target.closest('.msg-tab');
    if (!btn) return;
    const view = btn.dataset.view;
    this.querySelectorAll('.msg-tab').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    loadMessages(view);
  });

  // 初始化
  loadMessages('inbox');
})();
