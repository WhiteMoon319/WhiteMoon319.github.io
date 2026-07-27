/**
 * YHG Members Profile — 选手详情页逻辑
 * 依赖：main.js（window.escapeHtml, window.__revealIO）
 */
(function() {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  const main = document.getElementById('mainContent');

  if (!slug) {
    if (main) main.innerHTML = '<section class="section"><div class="empty-state"><div class="empty-icon">🔍</div><p>缺少选手标识</p></div></section>';
    return;
  }

  (async function() {
    try {
      const resp = await fetch('/api/players/' + slug);
      if (!resp.ok) throw new Error('404');
      const data = await resp.json();
      const p = data.player;
      if (!p) throw new Error('no player');

      let stats = {};
      try { stats = JSON.parse(p.stats || '{}'); } catch(e) {}

      const statKeys = ['智商', '情商', '实力', '颜值', '素质', '运气'];
      const maxValues = { '实力': 20, '智商': 20, '情商': 20, '颜值': 20, '素质': 20, '运气': 20 };

      let statsHtml = '';
      statKeys.forEach(function(k) {
        const val = stats[k] || 0;
        const max = maxValues[k] || 20;
        const pct = Math.min(100, Math.round((val / max) * 100));
        statsHtml += '<div class="attribute"><span>' + eh(k) + ' <b>' + eh(String(val)) + '</b></span><i style="--value:' + pct + '%"></i></div>';
      });

      // 判断是否是 admin / 绑定的用户
      let canEdit = false;
      try {
        const meResp = await fetch('/api/auth/me');
        if (meResp.ok) {
          const meData = await meResp.json();
          const adminResp = await fetch('/api/admin/check');
          canEdit = adminResp.ok || (meData.user && meData.user.player_slug === slug);
        }
      } catch(e) {}

      const picPath = 'members_pic.webp';
      const picUrl = '../resource/img/' + slug + '/' + picPath;
      const updated = p.updated_at ? new Date(p.updated_at + 'Z').toLocaleDateString('zh-CN') : '';

      const eh = window.escapeHtml || function(s) { return s || ''; };

      main.innerHTML =
        '<section class="page-hero member-hero">' +
          '<div class="embers" aria-hidden="true">' + '<i></i>'.repeat(12) + '</div>' +
          '<div class="page-hero-content">' +
            '<div class="eyebrow reveal in" data-delay="1">' + eh(p.role ? p.role.toUpperCase() : '') + ' · ' + eh(p.titles || '选手') + '</div>' +
            '<h1 class="reveal in" data-delay="2">' + eh(p.id_name) + '</h1>' +
            '<p class="reveal in" data-delay="3" style="max-width:600px;">' + eh(p.bio || '暂无简介') + '</p>' +
            (canEdit
              ? '<div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;" class="reveal in" data-delay="4">' +
                  '<a class="primary-btn" href="edit.html?slug=' + slug + '" style="text-decoration:none;">✏ 编辑资料</a>' +
                  '<a class="ghost-btn" href="' + slug + '/">查看原始页面</a>' +
                '</div>'
              : '<div style="margin-top:16px;"><a class="ghost-btn" href="' + slug + '/">查看详情</a></div>') +
          '</div>' +
        '</section>' +

        '<section class="section list-section">' +
          '<div class="member-layout">' +
            '<aside class="member-portrait reveal" data-delay="2">' +
              '<div class="member-portrait-content">' +
                '<img class="member-portrait-pic" src="' + picUrl + '" alt="' + eh(p.name) + '" onerror="this.src=\'../resource/img/default_members_pic.webp\'">' +
                '<div class="role">' + eh(p.id_name) + ' / ' + eh(p.role) + '</div>' +
                '<h2>' + eh(p.name) + '</h2>' +
                '<p>' + eh(p.bio || '') + '</p>' +
              '</div>' +
            '</aside>' +
            '<div class="member-info">' +
              '<article class="info-panel reveal" data-delay="3">' +
                '<h3>基础资料</h3>' +
                '<div class="info-grid">' +
                  '<div class="info-cell" data-field="姓名"><span>姓名</span><b>' + eh(p.name) + '</b></div>' +
                  '<div class="info-cell" data-field="ID"><span>ID</span><b>' + eh(p.id_name) + '</b></div>' +
                  '<div class="info-cell" data-field="年龄"><span>年龄</span><b>' + eh(p.age || '—') + '</b></div>' +
                  '<div class="info-cell" data-field="分路"><span>分路</span><b>' + eh(p.role) + '</b></div>' +
                  '<div class="info-cell" data-field="荣誉"><span>荣誉</span><b>' + eh(p.titles || '—') + '</b></div>' +
                  '<div class="info-cell"><span>资料更新</span><b>' + updated + '</b></div>' +
                '</div>' +
              '</article>' +
              '<article class="info-panel reveal" data-delay="4">' +
                '<h3>属性</h3>' +
                '<div class="attribute-grid">' + statsHtml + '</div>' +
              '</article>' +
              (p.personality ? '<article class="info-panel reveal" data-delay="5"><h3>性格</h3><p>' + eh(p.personality) + '</p></article>' : '') +
              (p.experience ? '<article class="info-panel reveal" data-delay="6"><h3>经历</h3><p>' + eh(p.experience) + '</p></article>' : '') +
              (p.anchor ? '<article class="info-panel reveal" data-delay="7"><h3>锚点</h3><p>' + eh(p.anchor) + '</p></article>' : '') +
              '<a class="back-link" href="../members/">返回队员阵容</a>' +
            '</div>' +
          '</div>' +
        '</section>';

      document.title = (p.id_name || '选手') + ' - YHG电子竞技战队';

      // 观察新渲染的 reveal 元素
      if (window.__revealIO) {
        document.querySelectorAll('.member-info .reveal:not(.in), .member-portrait.reveal:not(.in)').forEach(function(el) {
          window.__revealIO.observe(el);
        });
      }

    } catch(e) {
      if (main) main.innerHTML = '<section class="section"><div class="empty-state"><div class="empty-icon">⚠️</div><p>选手资料加载失败，请检查网络后重试</p></div></section>';
    }
  })();
})();
