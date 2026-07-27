/**
 * YHG Dashboard — 用户面板逻辑
 */

(function() {
  let currentUser = null;

  async function loadDashboard() {
    const el = document.getElementById('dashContent');
    try {
      const resp = await fetch('/api/auth/me');
      if (!resp.ok) { window.location.href = '../login/'; return; }
      const data = await resp.json();
      currentUser = data.user;
    } catch(e) {
      if (el) el.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>加载失败，请检查网络后重试</p></div>';
      return;
    }

    const u = currentUser;
    const created = u.created_at ? new Date(u.created_at + 'Z').toLocaleDateString('zh-CN') : '\u672A\u77E5';
    const avHtml = u.avatar ? '<img src="' + window.escapeHtml(u.avatar) + '">' : '\uD83D\uDC64';
    const bound = (u.bound_players && u.bound_players.length) ? u.bound_players.join(', ') : '\u672A\u7ED1\u5B9A';

    el.innerHTML = [
      '<h1>' + window.escapeHtml(u.username) + '</h1>',
      '<p class="dash-email">' + window.escapeHtml(u.email) + '</p>',
      '<div class="dash-section"><h2>\u4FEE\u6539\u5934\u50CF</h2><div class="avatar-area">',
      '<div class="avatar-preview" id="avPrev">' + avHtml + '</div>',
      '<div class="avatar-actions">',
      '<label>\u8F93\u5165\u56FE\u7247 URL</label>',
      '<input type="text" id="avUrl" placeholder="https://..." value="' + (u.avatar ? window.escapeHtml(u.avatar) : '') + '">',
      '<label>\u6216\u4E0A\u4F20\u56FE\u7247</label>',
      '<input type="file" id="avFile" accept="image/*">',
      '<button class="btn-save small" id="saveAvBtn">\u4FDD\u5B58\u5934\u50CF</button></div></div></div>',
      '<div class="dash-section"><h2>\u4FEE\u6539\u6635\u79F0</h2><div class="form-row">',
      '<label>\u65B0\u6635\u79F0</label>',
      '<input type="text" id="nickInput" value="' + window.escapeHtml(u.username) + '" maxlength="20">',
      '<span id="nickHint" class="hint"></span>',
      '<button class="btn-save small" id="saveNickBtn">\u4FDD\u5B58</button></div></div>',
      '<div class="dash-section"><h2>\u8D26\u6237\u4FE1\u606F</h2>',
      '<dl class="dash-info"><dt>\u6635\u79F0</dt><dd>' + window.escapeHtml(u.username) + '</dd>',
      '<dt>\u90AE\u7BB1</dt><dd>' + window.escapeHtml(u.email) + '</dd>',
      '<dt>\u89D2\u8272</dt><dd>' + (u.role === 'admin' ? '\u8D85\u7EA7\u7BA1\u7406\u5458' : u.role === 'sub_admin' ? '\u526F\u7BA1\u7406\u5458' : '\u666E\u901A\u7528\u6237') + '</dd>',
      '<dt>\u7B49\u7EA7</dt><dd>Lv.' + (u.level || 1) + '</dd>',
      '<dt>\u7ED1\u5B9A\u9009\u624B</dt><dd style="color:var(--dim);font-size:13px;">' + window.escapeHtml(bound) + '</dd>',
      '<dt>\u6CE8\u518C\u65F6\u95F4</dt><dd>' + created + '</dd></dl></div>',
      // 通知偏好
      '<div class="dash-section"><h2>\u901A\u77E5\u8BBE\u7F6E</h2><div id="notifPrefs"><p style="color:var(--dim);">\u52A0\u8F7D\u4E2D\u2026</p></div></div>',
      '<div class="dash-section"><h2>\u64CD\u4F5C</h2>',
      '<div style="display:flex;gap:14px;flex-wrap:wrap;">' +
      ((u.level >= 2 || u.role === 'admin' || u.role === 'sub_admin')
        ? '<a class="primary-btn" href="../news/write.html" style="text-decoration:none;">\u270D \u5199\u6587\u7AE0</a>'
        : '') +
      '<button class="ghost-btn" id="logoutBtn" style="border-color:var(--line-hot);color:var(--fire);">\u9000\u51FA\u767B\u5F55</button></div></div>'
    ].join('');

    // 头像预览
    document.getElementById('avUrl').addEventListener('input', function() {
      const v = document.getElementById('avUrl').value.trim();
      document.getElementById('avPrev').innerHTML = v ? '<img src="' + window.escapeHtml(v) + '" onerror="this.parentElement.innerHTML=\'\uD83D\uDC64\'">' : '\uD83D\uDC64';
    });
    document.getElementById('avFile').addEventListener('change', function() {
      const f = document.getElementById('avFile').files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = function(e) {
        document.getElementById('avPrev').innerHTML = '<img src="' + e.target.result + '">';
        document.getElementById('avUrl').value = e.target.result;
      };
      r.readAsDataURL(f);
    });
    document.getElementById('saveAvBtn').addEventListener('click', async function() {
      const url = document.getElementById('avUrl').value.trim();
      if (!url) { showToast('\u8BF7\u8F93\u5165\u5934\u50CF URL \u6216\u4E0A\u4F20\u56FE\u7247'); return; }
      const btn = document.getElementById('saveAvBtn'); btn.disabled = true;
      const r = await fetch('/api/auth/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar: url }) });
      const d = await r.json(); btn.disabled = false;
      d.ok ? (showToast('\u5934\u50CF\u5DF2\u66F4\u65B0'), currentUser.avatar = url) : showToast(d.error || '\u4FDD\u5B58\u5931\u8D25');
    });
    document.getElementById('saveNickBtn').addEventListener('click', async function() {
      const name = document.getElementById('nickInput').value.trim();
      if (!name || name.length < 1) { showToast('\u6635\u79F0\u4E0D\u80FD\u4E3A\u7A7A'); return; }
      if (name === currentUser.username) { showToast('\u6635\u79F0\u672A\u53D8\u5316'); return; }
      const btn = document.getElementById('saveNickBtn'); btn.disabled = true;
      const r = await fetch('/api/auth/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: name }) });
      const d = await r.json(); btn.disabled = false;
      if (d.ok) {
        showToast('\u6635\u79F0\u5DF2\u66F4\u65B0'); currentUser.username = name;
        const h1 = document.querySelector('#dashContent h1');
        if (h1) h1.textContent = name;
      } else {
        showToast(d.error || '\u4FDD\u5B58\u5931\u8D25');
        if (d.error && d.error.indexOf('\u5DF2\u88AB\u4F7F\u7528') !== -1) {
          const hint = document.getElementById('nickHint');
          if (hint) { hint.textContent = '\u274C ' + d.error; hint.className = 'hint-err'; }
        }
      }
    });
    document.getElementById('logoutBtn').addEventListener('click', async function() {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = 'index.html';
    });

    // 加载通知偏好
    loadNotifPrefs();
  }

  /** 加载通知偏好设置 */
  async function loadNotifPrefs() {
    const container = document.getElementById('notifPrefs');
    if (!container) return;
    try {
      const resp = await fetch('/api/notifications/preferences');
      const data = await resp.json();
      if (!data.ok) { container.innerHTML = '<p style="color:var(--dim);">加载失败</p>'; return; }
      const p = data.preferences;

      const fields = [
        { key: 'on_site', label: '站内通知' },
        { key: 'email', label: '邮件通知' },
        { key: 'on_comment', label: '评论通知' },
        { key: 'on_reply', label: '回复通知' },
        { key: 'on_like', label: '点赞通知' },
        { key: 'on_article_status', label: '文章审核通知' },
        { key: 'on_announcement', label: '系统公告' }
      ];

      let html = '<div style="display:grid;gap:10px;max-width:400px;">';
      fields.forEach(function(f) {
        const checked = p[f.key] ? 'checked' : '';
        html += '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;color:var(--text);">'
          + '<input type="checkbox" data-key="' + f.key + '" ' + checked + ' style="accent-color:var(--fire);width:16px;height:16px;">'
          + f.label
          + '</label>';
      });
      html += '<div style="margin-top:8px;"><button class="btn-save small" id="saveNotifPrefs">保存设置</button></div></div>';
      container.innerHTML = html;

      document.getElementById('saveNotifPrefs')?.addEventListener('click', async function() {
        const prefs = {};
        container.querySelectorAll('input[data-key]').forEach(function(cb) {
          prefs[cb.dataset.key] = cb.checked ? 1 : 0;
        });
        const btn = document.getElementById('saveNotifPrefs');
        btn.disabled = true;
        const r = await fetch('/api/notifications/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prefs)
        });
        const d = await r.json();
        btn.disabled = false;
        showToast(d.ok ? '设置已保存' : (d.error || '保存失败'));
      });
    } catch(e) {
      container.innerHTML = '<p style="color:var(--dim);">加载失败</p>';
    }
  }

  function showToast(m) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = m;
    t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 2500);
  }

  window.showToast = showToast;

  // 自动启动
  if (document.getElementById('dashContent')) {
    loadDashboard();
  }
})();
