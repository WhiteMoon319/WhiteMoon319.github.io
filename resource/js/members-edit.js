/**
 * YHG Members Edit — 选手编辑页逻辑
 * 依赖：main.js（window.__revealIO）
 */
(function() {
  'use strict';

  const app = document.getElementById('editApp');
  if (!app) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');

  if (!slug) {
    app.innerHTML = '<p style="text-align:center;color:var(--dim);padding:40px 0;">缺少选手标识</p>';
    return;
  }

  (async function() {
    // 验证身份
    let currentUser = null;
    try {
      const meResp = await fetch('/api/auth/me');
      if (meResp.ok) {
        currentUser = (await meResp.json()).user;
      }
    } catch(e) {}

    // 获取选手资料
    let player = null;
    try {
      const resp = await fetch('/api/players/' + slug);
      if (!resp.ok) throw new Error('not found');
      player = (await resp.json()).player;
    } catch(e) {
      app.innerHTML = '<p style="text-align:center;color:var(--dim);padding:40px 0;">选手资料不存在</p>';
      return;
    }

    // 验证权限
    let canEdit = false;
    try {
      const adminResp = await fetch('/api/admin/check');
      if (adminResp.ok) canEdit = true;
    } catch(e) {}

    if (!canEdit && currentUser) {
      try {
        const meResp2 = await fetch('/api/auth/me');
        if (meResp2.ok) {
          const meData = await meResp2.json();
          const bound = meData.user.bound_players || [];
          canEdit = bound.indexOf(slug) !== -1;
        }
      } catch(e) {}
    }

    if (!currentUser) {
      app.innerHTML = '<div style="text-align:center;padding:40px 0;">' +
        '<p style="color:var(--dim);">请先登录</p>' +
        '<p style="margin-top:12px;"><a href="../login/" style="color:var(--fire);">去登录</a></p>' +
        '</div>';
      return;
    }

    if (!canEdit) {
      app.innerHTML = '<div style="text-align:center;padding:40px 0;">' +
        '<p style="color:var(--dim);">你没有编辑 ' + (player.id_name || '该选手') + ' 资料的权限</p>' +
        '<p style="margin-top:12px;"><a href="../members/" style="color:var(--fire);">返回阵容</a></p>' +
        '</div>';
      return;
    }

    // 解析 stats
    let stats = {};
    try { stats = JSON.parse(player.stats || '{}'); } catch(e) {}

    // 渲染编辑表单
    app.innerHTML =
      '<h1>编辑资料</h1>' +
      '<p class="sub">' + (player.id_name || '') + '（' + (player.name || '') + '）</p>' +
      '<div class="form-error" id="formError"></div>' +
      '<form id="editForm">' +
        '<div class="form-group"><label>真名</label><input type="text" id="name" value="' + (player.name || '') + '"></div>' +
        '<div class="form-group" style="max-width:120px;"><label>年龄</label><input type="number" id="age" value="' + (player.age || '') + '" min="0" max="99"></div>' +
        '<div class="form-group"><label>荣誉</label><input type="text" id="titles" value="' + (player.titles || '') + '" placeholder="例: 两冠三四强"></div>' +
        '<div class="form-group"><label>简介 / 一句话介绍</label><textarea id="bio">' + (player.bio || '') + '</textarea></div>' +
        '<div class="form-group"><label>经历</label><textarea id="experience" style="min-height:140px;">' + (player.experience || '') + '</textarea></div>' +
        '<div class="form-group"><label>性格</label><textarea id="personality">' + (player.personality || '') + '</textarea></div>' +
        '<div class="form-group"><label>锚点 / 个人特征</label><textarea id="anchor">' + (player.anchor || '') + '</textarea></div>' +
        '<div class="form-group"><label>属性面板</label><div class="stats-grid" id="statsGrid"></div><div class="hint">每个属性 1-20 之间的数值</div></div>' +
        '<div class="submit-row">' +
          '<button class="auth-btn" type="submit" id="submitBtn">保存修改</button>' +
          '<a href="../members/' + slug + '/" style="color:var(--dim);font-size:14px;">取消</a>' +
        '</div>' +
      '</form>';

    // 渲染属性格子
    const statKeys = ['智商', '情商', '实力', '颜值', '素质', '运气'];
    const statGrid = document.getElementById('statsGrid');
    if (statGrid) {
      statKeys.forEach(function(k) {
        const val = stats[k] || '';
        statGrid.innerHTML += '<div class="stat-item"><label style="font-family:var(--mono);font-size:11px;color:var(--dim);display:block;margin-bottom:4px;">' + k + '</label><input type="number" class="stat-input" data-key="' + k + '" value="' + val + '" min="1" max="20"></div>';
      });
    }

    // 提交
    const editForm = document.getElementById('editForm');
    if (editForm) {
      editForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const errorEl = document.getElementById('formError');
        const btn = document.getElementById('submitBtn');

        const newStats = {};
        document.querySelectorAll('.stat-input').forEach(function(inp) {
          const v = parseInt(inp.value);
          if (!isNaN(v)) newStats[inp.dataset.key] = v;
        });

        btn.disabled = true;
        btn.textContent = '保存中…';
        if (errorEl) errorEl.textContent = '';

        try {
          const resp = await fetch('/api/players/' + slug, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: (document.getElementById('name') || {}).value || '',
              age: parseInt((document.getElementById('age') || {}).value) || 0,
              titles: (document.getElementById('titles') || {}).value || '',
              bio: (document.getElementById('bio') || {}).value || '',
              experience: (document.getElementById('experience') || {}).value || '',
              personality: (document.getElementById('personality') || {}).value || '',
              anchor: (document.getElementById('anchor') || {}).value || '',
              stats: newStats
            })
          });
          const data = await resp.json();
          if (resp.ok) {
            if (errorEl) { errorEl.style.color = 'var(--spring)'; errorEl.textContent = '✅ 保存成功！'; }
            btn.textContent = '已保存';
            setTimeout(function() { window.location.href = 'profile.html?slug=' + slug; }, 1500);
          } else {
            if (errorEl) errorEl.textContent = data.error || '保存失败';
            btn.disabled = false;
            btn.textContent = '保存修改';
          }
        } catch(e) {
          if (errorEl) errorEl.textContent = '网络错误';
          btn.disabled = false;
          btn.textContent = '保存修改';
        }
      });
    }

    // 观察新渲染的 reveal 元素
    if (window.__revealIO) {
      document.querySelectorAll('#editApp .reveal:not(.in)').forEach(function(el) {
        window.__revealIO.observe(el);
      });
    }
  })();
})();
