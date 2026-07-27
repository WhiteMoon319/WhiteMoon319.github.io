/**
 * YHG Admin — 管理面板 SPA 逻辑
 * 用户/文章/选手绑定/选手管理/赛事/首页管理
 */

let adminRole = null;

(function() {
  (async function() {
    try {
      const checkResp = await fetch('/api/admin/check');
      if (!checkResp.ok) {
        // 401 或 403 — 无权限
        let msg = '\u9700\u8981\u7BA1\u7406\u5458\u6743\u9650';
        if (checkResp.status === 401) msg = '\u8BF7\u5148\u767B\u5F55';
        document.getElementById('adminStatus').textContent = msg;
        document.getElementById('adminBody').innerHTML = '<div class="admin-placeholder"><p>' + msg + '</p><p style="margin-top:12px;"><a href="../login/" style="color:var(--fire);">\u53BB\u767B\u5F55</a></p></div>';
        return;
      }
      const checkData = await checkResp.json();
      if (!checkData.ok || !checkData.user) {
        document.getElementById('adminStatus').textContent = '\u9A8C\u8BC1\u5931\u8D25';
        document.getElementById('adminBody').innerHTML = '<div class="admin-placeholder"><p>\u8EAB\u4EFD\u9A8C\u8BC1\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u91CD\u8BD5</p></div>';
        return;
      }
      adminRole = checkData.user.role;

    const roleLabel = adminRole === 'admin' ? '\u8D85\u7EA7\u7BA1\u7406\u5458' : '\u526F\u7BA1\u7406\u5458';
    document.getElementById('adminStatus').innerHTML = '\u5DF2\u767B\u5F55 \u00B7 <span class="admin-badge ' + adminRole + '" style="background:var(--spring-soft, #e8f5e9);color:var(--spring, #2e7d32);">' + roleLabel + '</span>';
    document.getElementById('adminTabs').style.display = 'flex';
    loadTab('users');

    document.querySelectorAll('.admin-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        loadTab(tab.dataset.tab);
      });
    });
  } catch(e) {
    console.error('Admin init failed:', e);
    document.getElementById('adminStatus').textContent = '\u52A0\u8F7D\u5931\u8D25';
    document.getElementById('adminBody').innerHTML = '<div class="admin-placeholder"><p>\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u91CD\u8BD5</p><p style="font-size:12px;color:var(--faint);margin-top:8px;">' + window.escapeHtml(e.message || '') + '</p></div>';
  }
  })();

  window.showToast = function(msg, type) {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = 'admin-toast-item ' + (type || 'ok');
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(function() { if (el.parentNode) el.remove(); }, 3000);
  };

  window.loadTab = function(tab) {
    const body = document.getElementById('adminBody');
    if (tab === 'users') loadUsers(body);
    else if (tab === 'articles') loadArticles(body);
    else if (tab === 'bindings') loadBindings(body);
    else if (tab === 'players') loadPlayers(body);
    else if (tab === 'matches') loadMatches(body);
    else if (tab === 'home') loadHome(body);
    else if (tab === 'announcement') loadAnnouncement(body);
  };

  function roleBadgeHtml(role) {
    if (role === 'admin') return '<span class="admin-badge admin">\u8D85\u7EA7\u7BA1\u7406\u5458</span>';
    if (role === 'sub_admin') return '<span class="admin-badge sub_admin" style="background:var(--spring-soft,#e8f5e9);color:var(--spring,#2e7d32);">\u526F\u7BA1\u7406\u5458</span>';
    return '<span class="admin-badge user">\u7528\u6237</span>';
  }

  // 用户管理
  async function loadUsers(body) {
    body.innerHTML = '<div class="admin-loading">\u52A0\u8F7D\u7528\u6237\u2026</div>';
    try {
      const resp = await fetch('/api/admin/users');
      const data = await resp.json();
      if (!data.ok) { body.innerHTML = '<p>\u52A0\u8F7D\u5931\u8D25</p>'; return; }

      let html = '<table class="admin-table"><thead><tr><th>ID</th><th>\u90AE\u7BB1</th><th>\u7528\u6237\u540D</th><th>\u89D2\u8272</th><th>\u7B49\u7EA7</th><th>\u7ED1\u5B9A\u9009\u624B</th><th>\u6CE8\u518C\u65F6\u95F4</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';
      data.users.forEach(function(u) {
        const buttons = [];
        if (adminRole === 'admin' && u.role === 'user' && u.level < 2) {
          buttons.push('<button class="admin-btn" onclick="setLevel(' + u.id + ', 2)">\u5347 Lv.2</button>');
        }
        if (adminRole === 'admin' && u.role !== 'admin' && u.role !== 'sub_admin' && u.id !== 1) {
          buttons.push('<button class="admin-btn danger" onclick="deleteUser(' + u.id + ')">\u5220\u9664</button>');
        }
        if (adminRole === 'admin' && u.role === 'user') {
          buttons.push('<button class="admin-btn" onclick="promoteSubAdmin(' + u.id + ')">\u5347\u526F\u7BA1</button>');
        }
        html += '<tr>'
          + '<td>' + u.id + '</td>'
          + '<td>' + window.escapeHtml(u.email) + '</td>'
          + '<td>' + window.escapeHtml(u.username) + '</td>'
          + '<td>' + roleBadgeHtml(u.role) + '</td>'
          + '<td><span class="admin-badge" style="background:var(--spring-soft,#e8f5e9);color:var(--spring,#2e7d32);">Lv.' + (u.level || 1) + '</span></td>'
          + '<td style="font-size:12px;color:var(--dim);">' + ((u.bound_players || []).join(', ') || '\u2014') + '</td>'
          + '<td style="font-size:12px;color:var(--dim);">' + (u.created_at ? new Date(u.created_at + 'Z').toLocaleDateString('zh-CN') : '') + '</td>'
          + '<td>' + buttons.join(' ') + '</td>'
          + '</tr>';
      });
      html += '</tbody></table>';
      body.innerHTML = html;
    } catch(e) {
console.error('loadUsers error:', e);
      body.innerHTML = '<p style="color:var(--flame);">\u52A0\u8F7D\u5931\u8D25: ' + window.escapeHtml(e.message || '\u672A\u77E5\u9519\u8BEF') + '</p>';
    }
  }

  window.deleteUser = async function(id) {
    if (!confirm('\u786E\u5B9A\u5220\u9664\u8BE5\u7528\u6237\uFF1F\u6240\u6709\u5173\u8054\u4F1A\u8BDD\u548C\u7ED1\u5B9A\u4E5F\u4F1A\u88AB\u6E05\u7406\u3002')) return;
    const resp = await fetch('/api/admin/users/' + id, { method: 'DELETE' });
    const data = await resp.json();
    showToast(data.ok ? '\u5DF2\u5220\u9664' : (data.error || '\u5220\u9664\u5931\u8D25'), data.ok ? 'ok' : 'err');
    loadTab('users');
  };

  window.promoteSubAdmin = async function(id) {
    const username = prompt('\u8BBE\u7F6E\u8BE5\u7528\u6237\u4E3A\u526F\u7BA1\u7406\u5458\uFF1F\u8F93\u5165\u7528\u6237\u540D\u786E\u8BA4\uFF1A');
    if (!username) return;
    const resp = await fetch('/api/admin/users/' + id + '/role', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'sub_admin' })
    });
    const data = await resp.json();
    showToast(data.ok ? '\u5DF2\u63D0\u5347\u4E3A\u526F\u7BA1\u7406\u5458' : (data.error || '\u8BBE\u7F6E\u5931\u8D25'), data.ok ? 'ok' : 'err');
    loadTab('users');
  };

  window.setLevel = async function(id, level) {
    const label = level === 2 ? 'Lv.2\uFF08\u53EF\u53D1\u6587\uFF09' : 'Lv.1';
    if (!confirm('\u786E\u5B9A\u5C06\u8BE5\u7528\u6237\u63D0\u5347\u4E3A ' + label + '\uFF1F')) return;
    const resp = await fetch('/api/admin/users/' + id + '/level', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: level })
    });
    const data = await resp.json();
    showToast(data.ok ? '\u7B49\u7EA7\u5DF2\u66F4\u65B0\u4E3A ' + label : (data.error || '\u8BBE\u7F6E\u5931\u8D25'), data.ok ? 'ok' : 'err');
    loadTab('users');
  };

  // 文章管理
  async function loadArticles(body) {
    body.innerHTML = '<div class="admin-loading">\u52A0\u8F7D\u6587\u7AE0\u2026</div>';
    try {
      const resp = await fetch('/api/admin/articles');
      const data = await resp.json();
      if (!data.ok) { body.innerHTML = '<p>\u52A0\u8F7D\u5931\u8D25</p>'; return; }
      if (!data.articles || data.articles.length === 0) {
        body.innerHTML = '<div class="admin-placeholder"><p>\u6682\u65E0\u6587\u7AE0</p></div>';
        return;
      }
      let html = '<table class="admin-table"><thead><tr><th>\u6807\u9898</th><th>\u4F5C\u8005</th><th>\u72B6\u6001</th><th>\u65F6\u95F4</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';
      data.articles.forEach(function(a) {
        let statusBadge = '';
        if (a.status === 'approved') statusBadge = '<span class="admin-badge" style="background:#e8f5e9;color:#2e7d32;">\u5DF2\u901A\u8FC7</span>';
        else if (a.status === 'pending') statusBadge = '<span class="admin-badge" style="background:#fff8e1;color:#e65100;">\u5F85\u5BA1\u6838</span>';
        else if (a.status === 'rejected') statusBadge = '<span class="admin-badge" style="background:#fce4ec;color:#c62828;">\u5DF2\u9A73\u56DE</span>';
        else statusBadge = '<span class="admin-badge">' + a.status + '</span>';

        let actions = '<button class="admin-btn danger" onclick="deleteArticle(\'' + a.slug + '\')">\u5220\u9664</button>';
        if (a.status === 'pending') {
          actions = '<button class="admin-btn" onclick="approveArticle(\'' + a.slug + '\')" style="background:#e8f5e9;color:#2e7d32;border-color:#a5d6a7;">\u901A\u8FC7</button> '
            + '<button class="admin-btn" onclick="rejectArticle(\'' + a.slug + '\')" style="color:#c62828;border-color:#ef9a9a;">\u9A73\u56DE</button> '
            + actions;
        }
        html += '<tr>'
          + '<td><a href="../news/article.html?slug=' + a.slug + '" style="color:var(--text);text-decoration:none;">' + window.escapeHtml(a.title) + '</a></td>'
          + '<td style="color:var(--dim);">' + window.escapeHtml(a.username) + '</td>'
          + '<td>' + statusBadge + '</td>'
          + '<td style="font-size:12px;color:var(--dim);">' + (a.created_at ? new Date(a.created_at + 'Z').toLocaleDateString('zh-CN') : '') + '</td>'
          + '<td style="white-space:nowrap;">' + actions + '</td>'
          + '</tr>';
      });
      html += '</tbody></table>';
      body.innerHTML = html;
    } catch(e) {
console.error('loadUsers error:', e);
      body.innerHTML = '<p style="color:var(--flame);">\u52A0\u8F7D\u5931\u8D25: ' + window.escapeHtml(e.message || '\u672A\u77E5\u9519\u8BEF') + '</p>';
    }
  }

  window.approveArticle = async function(slug) {
    const resp = await fetch('/api/admin/articles/' + slug + '/status', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' })
    });
    const data = await resp.json();
    showToast(data.ok ? '\u5DF2\u901A\u8FC7\u5BA1\u6838' : (data.error || '\u64CD\u4F5C\u5931\u8D25'), data.ok ? 'ok' : 'err');
    if (data.ok) loadTab('articles');
  };

  window.rejectArticle = async function(slug) {
    const resp = await fetch('/api/admin/articles/' + slug + '/status', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' })
    });
    const data = await resp.json();
    showToast(data.ok ? '\u5DF2\u9A73\u56DE' : (data.error || '\u64CD\u4F5C\u5931\u8D25'), data.ok ? 'ok' : 'err');
    if (data.ok) loadTab('articles');
  };

  window.deleteArticle = async function(slug) {
    if (!confirm('\u786E\u5B9A\u5220\u9664\u8BE5\u6587\u7AE0\uFF1F')) return;
    const resp = await fetch('/api/admin/articles/' + slug, { method: 'DELETE' });
    const data = await resp.json();
    showToast(data.ok ? '\u5DF2\u5220\u9664' : (data.error || '\u5220\u9664\u5931\u8D25'), data.ok ? 'ok' : 'err');
    loadTab('articles');
  };

  // 选手绑定
  let bindDialogUser = null;

  async function loadBindings(body) {
    body.innerHTML = '<div class="admin-loading">\u52A0\u8F7D\u2026</div>';
    try {
      const resp = await Promise.all([
        fetch('/api/admin/users').then(function(r) { return r.json(); }),
        fetch('/api/players').then(function(r) { return r.json(); })
      ]);
      const users = resp[0].users || [];
      const players = resp[1].players || [];

      let html = '<table class="admin-table"><thead><tr><th>\u7528\u6237</th><th>\u7ED1\u5B9A\u9009\u624B</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';
      users.filter(function(u) { return u.role !== 'admin'; }).forEach(function(u) {
        const bound = u.bound_players || [];
        html += '<tr>'
          + '<td>' + window.escapeHtml(u.username) + ' (' + window.escapeHtml(u.email) + ')</td>'
          + '<td style="font-size:12px;color:var(--dim);">' + (bound.length ? bound.join(', ') : '\u672A\u7ED1\u5B9A') + '</td>'
          + '<td><button class="admin-btn" onclick="showBindDialog(' + u.id + ', \'' + window.escapeHtml(u.username) + '\')">\u7BA1\u7406\u7ED1\u5B9A</button></td>'
          + '</tr>';
      });
      html += '</tbody></table>';
      body.innerHTML = html;
    } catch(e) {
      body.innerHTML = '<p style="color:var(--flame);">\u52A0\u8F7D\u5931\u8D25</p>';
    }
  }

  window.showBindDialog = async function(userId, username) {
    bindDialogUser = userId;
    const resp = await Promise.all([
      fetch('/api/admin/users').then(function(r) { return r.json(); }),
      fetch('/api/players').then(function(r) { return r.json(); })
    ]);
    const users = resp[0].users || [];
    const players = resp[1].players || [];
    const user = users.find(function(u) { return u.id === userId; });
    const boundSlugs = (user && user.bound_players) ? user.bound_players.slice() : [];

    let checks = '';
    players.forEach(function(p) {
      const checked = boundSlugs.indexOf(p.slug) !== -1 ? 'checked' : '';
      checks += '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;">'
        + '<input type="checkbox" value="' + p.slug + '" ' + checked + ' style="accent-color:var(--fire);">'
        + window.escapeHtml(p.id_name) + ' (' + window.escapeHtml(p.name) + ')'
        + '</label>';
    });

    document.getElementById('adminBody').innerHTML = ''
      + '<div style="max-width:480px;">'
      + '<h3 style="margin:0 0 6px;font-size:18px;color:var(--text);">\u7ED1\u5B9A\u9009\u624B \u2014 ' + window.escapeHtml(username) + '</h3>'
      + '<p style="color:var(--dim);font-size:13px;margin:0 0 16px;">\u52FE\u9009\u8BE5\u7528\u6237\u53EF\u7F16\u8F91\u7684\u9009\u624B</p>'
      + '<div style="border:1px solid var(--line);border-radius:var(--r-sm);padding:12px 16px;max-height:320px;overflow-y:auto;" id="bindCheckboxes">' + checks + '</div>'
      + '<div style="margin-top:16px;display:flex;gap:10px;">'
      + '<button class="admin-btn primary" onclick="saveBindings()">\u4FDD\u5B58</button>'
      + '<button class="admin-btn" onclick="loadTab(\'bindings\')">\u53D6\u6D88</button>'
      + '</div></div>';
  };

  window.saveBindings = async function() {
    const checks = document.querySelectorAll('#bindCheckboxes input[type="checkbox"]');
    const selected = [];
    checks.forEach(function(cb) { if (cb.checked) selected.push(cb.value); });
    const resp = await fetch('/api/admin/users/' + bindDialogUser, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_slugs: selected })
    });
    const data = await resp.json();
    showToast(data.ok ? '\u7ED1\u5B9A\u6210\u529F' : (data.error || '\u7ED1\u5B9A\u5931\u8D25'), data.ok ? 'ok' : 'err');
    loadTab('bindings');
  };

  // 选手管理
  async function loadPlayers(body) {
    body.innerHTML = '<div class="admin-loading">\u52A0\u8F7D\u9009\u624B\u2026</div>';
    try {
      const resp = await fetch('/api/admin/players');
      const data = await resp.json();
      if (!data.ok) { body.innerHTML = '<p>\u52A0\u8F7D\u5931\u8D25</p>'; return; }
      const players = data.players || [];
      if (players.length === 0) { body.innerHTML = '<div class="admin-placeholder"><p>\u6682\u65E0\u9009\u624B</p></div>'; return; }

      let html = '<table class="admin-table"><thead><tr><th>ID</th><th>\u5934\u50CF</th><th>\u59D3\u540D</th><th>\u89D2\u8272</th><th>\u5934\u50CF URL</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';
      players.forEach(function(p) {
        const avatarDisplay = p.avatar
          ? '<img src="' + window.escapeHtml(p.avatar) + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">'
          : '<span style="color:var(--dim);font-size:11px;">\u65E0</span>';
        html += '<tr>'
          + '<td>' + window.escapeHtml(p.slug) + '</td>'
          + '<td>' + avatarDisplay + '</td>'
          + '<td><b>' + window.escapeHtml(p.name) + '</b><br><span style="font-size:11px;color:var(--dim);">' + window.escapeHtml(p.id_name) + '</span></td>'
          + '<td>' + window.escapeHtml(p.role) + '</td>'
          + '<td><input type="text" id="av-' + p.slug + '" value="' + (p.avatar ? window.escapeHtml(p.avatar) : '') + '" placeholder="\u5934\u50CF\u56FE\u7247URL" style="width:100%;padding:6px 8px;font-size:12px;border:1px solid var(--line-2);border-radius:4px;background:var(--bg);color:var(--text);box-sizing:border-box;"></td>'
          + '<td><button class="admin-btn" onclick="savePlayerAvatar(\'' + p.slug + '\')">\u4FDD\u5B58</button></td>'
          + '</tr>';
      });
      html += '</tbody></table>';
      body.innerHTML = html;
    } catch(e) {
      body.innerHTML = '<p style="color:var(--flame);">\u52A0\u8F7D\u5931\u8D25</p>';
    }
  }

  window.savePlayerAvatar = async function(slug) {
    const input = document.getElementById('av-' + slug);
    const avatar = input ? input.value.trim() : '';
    const resp = await fetch('/api/admin/players/' + slug, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar: avatar })
    });
    const data = await resp.json();
    if (data.ok) { showToast('\u5934\u50CF\u5DF2\u66F4\u65B0', 'ok'); document.querySelector('[data-tab="players"]').click(); }
    else { showToast(data.error || '\u4FDD\u5B58\u5931\u8D25', 'err'); }
  };

  // 赛事管理
  let editingMatchId = null;

  async function loadMatches(body) {
    body.innerHTML = '<div class="admin-loading">\u52A0\u8F7D\u8D5B\u4E8B\u2026</div>';
    try {
      const resp = await fetch('/api/admin/matches');
      const data = await resp.json();
      if (!data.ok) { body.innerHTML = '<p>\u52A0\u8F7D\u5931\u8D25</p>'; return; }
      let html = '<div style="margin-bottom:16px;"><button class="admin-btn primary" onclick="showMatchForm(null)">+ \u65B0\u589E\u8D5B\u4E8B</button></div>'
        + '<table class="admin-table"><thead><tr><th>\u8D5B\u4E8B</th><th>\u5BF9\u624B</th><th>\u65E5\u671F</th><th>\u7ED3\u679C</th><th>\u6BD4\u5206</th><th>\u9996\u9875\u5C55\u793A</th><th>\u64CD\u4F5C</th></tr></thead><tbody>';
      (data.matches || []).forEach(function(m) {
        const resultLabel = m.result === 'win' ? '\u80DC' : m.result === 'lose' ? '\u8D1F' : m.result === 'draw' ? '\u5E73' : '\u2014';
        html += '<tr>'
          + '<td>' + window.escapeHtml(m.title) + '</td>'
          + '<td>' + window.escapeHtml(m.opponent) + '</td>'
          + '<td style="font-size:12px;color:var(--dim);">' + window.escapeHtml(m.match_date) + '</td>'
          + '<td>' + resultLabel + '</td>'
          + '<td style="font-family:var(--mono);">' + (m.score || '\u2014') + '</td>'
          + '<td>' + (m.featured ? '\u2B50' : '\u2014') + '</td>'
          + '<td><button class="admin-btn" onclick="showMatchForm(' + m.id + ')">\u7F16\u8F91</button> '
          + '<button class="admin-btn danger" onclick="deleteMatch(' + m.id + ')">\u5220\u9664</button></td>'
          + '</tr>';
      });
      html += '</tbody></table>';
      body.innerHTML = html;
    } catch(e) {
      body.innerHTML = '<p style="color:var(--flame);">\u52A0\u8F7D\u5931\u8D25</p>';
    }
  }

  window.showMatchForm = function(id) {
    editingMatchId = id;
    let defaults = { title: '', opponent: '', match_date: '', result: '', score: '', description: '', featured: 0 };

    if (id) {
      (async function() {
        const resp = await fetch('/api/admin/matches');
        const data = await resp.json();
        const m = (data.matches || []).find(function(x) { return x.id === id; });
        if (m) defaults = m;
        renderMatchForm();
      })();
    } else {
      renderMatchForm();
    }

    function renderMatchForm() {
      const el = document.getElementById('adminBody');
      el.innerHTML = ''
        + '<div style="max-width:500px;">'
        + '<h3 style="margin:0 0 16px;font-size:18px;color:var(--text);">' + (id ? '\u7F16\u8F91\u8D5B\u4E8B' : '\u65B0\u589E\u8D5B\u4E8B') + '</h3>'
        + '<div style="display:grid;gap:12px;">'
        + '<label style="font-size:12px;color:var(--dim);">\u8D5B\u4E8B\u540D\u79F0</label>'
        + '<input id="f_title" value="' + window.escapeHtml(defaults.title) + '" style="padding:8px 12px;border:1px solid var(--line-2);border-radius:var(--r-sm);background:var(--bg);color:var(--text);">'
        + '<div style="display:flex;gap:12px;">'
        + '<div style="flex:1;"><label style="font-size:12px;color:var(--dim);">\u5BF9\u624B</label>'
        + '<input id="f_opponent" value="' + window.escapeHtml(defaults.opponent) + '" style="width:100%;padding:8px 12px;border:1px solid var(--line-2);border-radius:var(--r-sm);background:var(--bg);color:var(--text);"></div>'
        + '<div style="flex:1;"><label style="font-size:12px;color:var(--dim);">\u65E5\u671F</label>'
        + '<input id="f_date" type="date" value="' + defaults.match_date + '" style="width:100%;padding:8px 12px;border:1px solid var(--line-2);border-radius:var(--r-sm);background:var(--bg);color:var(--text);"></div></div>'
        + '<div style="display:flex;gap:12px;">'
        + '<div><label style="font-size:12px;color:var(--dim);">\u7ED3\u679C</label><select id="f_result" style="padding:8px 12px;border:1px solid var(--line-2);border-radius:var(--r-sm);background:var(--bg);color:var(--text);">'
        + '<option value="">\u2014</option>'
        + '<option value="win"' + (defaults.result === 'win' ? ' selected' : '') + '>\u80DC</option>'
        + '<option value="lose"' + (defaults.result === 'lose' ? ' selected' : '') + '>\u8D1F</option>'
        + '<option value="draw"' + (defaults.result === 'draw' ? ' selected' : '') + '>\u5E73</option></select></div>'
        + '<div><label style="font-size:12px;color:var(--dim);">\u6BD4\u5206</label>'
        + '<input id="f_score" value="' + (defaults.score || '') + '" placeholder="3:1" style="padding:8px 12px;border:1px solid var(--line-2);border-radius:var(--r-sm);background:var(--bg);color:var(--text);width:100px;"></div>'
        + '<div style="display:flex;align-items:flex-end;padding-bottom:8px;"><label><input type="checkbox" id="f_featured"' + (defaults.featured ? ' checked' : '') + ' style="accent-color:var(--fire);"> \u9996\u9875\u5C55\u793A</label></div></div>'
        + '<label style="font-size:12px;color:var(--dim);">\u5907\u6CE8</label>'
        + '<textarea id="f_desc" rows="3" style="padding:8px 12px;border:1px solid var(--line-2);border-radius:var(--r-sm);background:var(--bg);color:var(--text);font-size:13px;">' + window.escapeHtml(defaults.description || '') + '</textarea>'
        + '<div style="margin-top:8px;display:flex;gap:10px;"><button class="admin-btn primary" onclick="saveMatch()">\u4FDD\u5B58</button>'
        + '<button class="admin-btn" onclick="loadTab(\'matches\')">\u53D6\u6D88</button></div></div></div>';
    }
  };

  window.saveMatch = async function() {
    const data = {
      title: document.getElementById('f_title').value.trim(),
      opponent: document.getElementById('f_opponent').value.trim(),
      match_date: document.getElementById('f_date').value,
      result: document.getElementById('f_result').value,
      score: document.getElementById('f_score').value.trim(),
      description: document.getElementById('f_desc').value.trim(),
      featured: document.getElementById('f_featured').checked ? 1 : 0
    };
    if (!data.title || !data.opponent || !data.match_date) {
      showToast('\u8BF7\u586B\u5199\u8D5B\u4E8B\u540D\u79F0\u3001\u5BF9\u624B\u548C\u65E5\u671F', 'err');
      return;
    }
    const url = editingMatchId ? '/api/admin/matches/' + editingMatchId : '/api/admin/matches';
    const resp = await fetch(url, {
      method: editingMatchId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const r = await resp.json();
    showToast(r.ok ? (editingMatchId ? '\u5DF2\u66F4\u65B0' : '\u5DF2\u521B\u5EFA') : (r.error || '\u64CD\u4F5C\u5931\u8D25'), r.ok ? 'ok' : 'err');
    loadTab('matches');
  };

  window.deleteMatch = async function(id) {
    if (!confirm('\u786E\u5B9A\u5220\u9664\u8BE5\u8D5B\u4E8B\uFF1F')) return;
    const resp = await fetch('/api/admin/matches/' + id, { method: 'DELETE' });
    const data = await resp.json();
    showToast(data.ok ? '\u5DF2\u5220\u9664' : (data.error || '\u5220\u9664\u5931\u8D25'), data.ok ? 'ok' : 'err');
    loadTab('matches');
  };

  // 首页管理
  async function loadHome(body) {
    body.innerHTML = '<div class="admin-loading">\u52A0\u8F7D\u2026</div>';
    try {
      const resp = await fetch('/api/admin/home');
      const data = await resp.json();
      if (!data.ok) { body.innerHTML = '<p>\u52A0\u8F7D\u5931\u8D25</p>'; return; }
      const secs = data.sections || [];
      let html = '<h3 style="margin:0 0 16px;font-size:18px;color:var(--text);">\u9996\u9875\u533A\u5757\u7F16\u8F91</h3>'
        + '<div style="display:grid;gap:14px;max-width:600px;">';
      secs.forEach(function(s) {
        const label = s.section_key === 'hero_title' ? '\u4E3B\u6807\u9898' : s.section_key === 'hero_subtitle' ? '\u526F\u6807\u9898' : s.section_key === 'about_text' ? '\u5173\u4E8E\u6211\u4EEC' : s.section_key;
        html += '<label style="font-size:12px;color:var(--dim);">' + label + '</label>'
          + '<textarea id="sec_' + s.section_key + '" rows="' + (s.section_key === 'about_text' ? 4 : 2) + '" style="padding:8px 12px;border:1px solid var(--line-2);border-radius:var(--r-sm);background:var(--bg);color:var(--text);font-size:13px;">' + window.escapeHtml(s.content) + '</textarea>';
      });
      html += '<div style="margin-top:8px;"><button class="admin-btn primary" onclick="saveHomeSections()">\u4FDD\u5B58\u6240\u6709</button></div></div>';
      body.innerHTML = html;
    } catch(e) {
      body.innerHTML = '<p style="color:var(--flame);">\u52A0\u8F7D\u5931\u8D25</p>';
    }
  }

  window.saveHomeSections = async function() {
    const sections = [];
    document.querySelectorAll('[id^="sec_"]').forEach(function(el) {
      sections.push({ section_key: el.id.replace('sec_', ''), content: el.value });
    });
    const resp = await fetch('/api/admin/home', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sections: sections })
    });
    const data = await resp.json();
    showToast(data.ok ? '\u5DF2\u4FDD\u5B58' : (data.error || '\u4FDD\u5B58\u5931\u8D25'), data.ok ? 'ok' : 'err');
    loadTab('home');
  };

  // 发布公告
  async function loadAnnouncement(body) {
    body.innerHTML = ''
      + '<div style="max-width:600px;">'
      + '<h3 style="margin:0 0 6px;font-size:18px;color:var(--text);">\u53D1\u5E03\u7CFB\u7EDF\u516C\u544A</h3>'
      + '<p style="color:var(--dim);font-size:13px;margin:0 0 20px;">\u516C\u544A\u5C06\u53D1\u9001\u7ED9\u6240\u6709\u6CE8\u518C\u7528\u6237\u7684\u7AD9\u5185\u901A\u77E5\u3002</p>'
      + '<div style="display:grid;gap:14px;">'
      + '<label style="font-size:12px;color:var(--dim);">\u516C\u544A\u6807\u9898 <span style="color:var(--flame);">*</span></label>'
      + '<input id="annTitle" placeholder="\u8F93\u5165\u516C\u544A\u6807\u9898" maxlength="120" style="padding:10px 14px;border:1px solid var(--line-2);border-radius:var(--r-sm);background:var(--bg);color:var(--text);font-size:14px;">'
      + '<label style="font-size:12px;color:var(--dim);">\u516C\u544A\u5185\u5BB9</label>'
      + '<textarea id="annBody" rows="4" placeholder="\u516C\u544A\u5185\u5BB9\uFF08\u53EF\u9009\uFF09" style="padding:10px 14px;border:1px solid var(--line-2);border-radius:var(--r-sm);background:var(--bg);color:var(--text);font-size:13px;resize:vertical;"></textarea>'
      + '<label style="font-size:12px;color:var(--dim);">\u94FE\u63A5\u5730\u5740\uFF08\u53EF\u9009\uFF09</label>'
      + '<input id="annLink" placeholder="https://..." style="padding:10px 14px;border:1px solid var(--line-2);border-radius:var(--r-sm);background:var(--bg);color:var(--text);font-size:13px;">'
      + '<div style="margin-top:8px;"><button class="admin-btn primary" id="sendAnnouncement" style="padding:10px 28px;">\u53D1\u9001\u516C\u544A</button></div>'
      + '</div></div>';

    document.getElementById('sendAnnouncement')?.addEventListener('click', async function() {
      const title = document.getElementById('annTitle').value.trim();
      if (!title) { showToast('\u8BF7\u8F93\u5165\u516C\u544A\u6807\u9898', 'err'); return; }
      const btn = document.getElementById('sendAnnouncement');
      btn.disabled = true;
      btn.textContent = '\u53D1\u9001\u4E2D\u2026';
      try {
        const resp = await fetch('/api/admin/articles/announcement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title,
            content: document.getElementById('annBody').value.trim(),
            link: document.getElementById('annLink').value.trim()
          })
        });
        const data = await resp.json();
        if (data.ok) {
          showToast('\u516C\u544A\u5DF2\u53D1\u9001\u7ED9\u6240\u6709\u7528\u6237', 'ok');
          document.getElementById('annTitle').value = '';
          document.getElementById('annBody').value = '';
          document.getElementById('annLink').value = '';
        } else {
          showToast(data.error || '\u53D1\u9001\u5931\u8D25', 'err');
        }
      } catch(e) {
        showToast('\u7F51\u7EDC\u9519\u8BEF', 'err');
      }
      btn.disabled = false;
      btn.textContent = '\u53D1\u9001\u516C\u544A';
    });
  }
})();
