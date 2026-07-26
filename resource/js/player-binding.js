/**
 * YHG Player Binding — 选手详情页编辑按钮
 * 自动从 URL 路径提取 slug，检查当前用户是否绑定或 admin
 * 如果是，显示从动态资料页入口
 */
(async function() {
  try {
    const path = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
    const parts = path.split('/');
    const slug = parts[parts.length - 1];

    if (!slug) return;

    // 检查登录 + 绑定
    const meResp = await fetch('/api/auth/me');
    if (!meResp.ok) return;
    const meData = await meResp.json();
    if (!meData.ok) return;

    const isAdmin = await checkAdmin();
    const isBound = meData.user.player_slug === slug;

    if (!isAdmin && !isBound) return;

    const btn = document.createElement('a');
    btn.href = '../profile.html?slug=' + slug;
    btn.className = 'primary-btn';
    btn.style.cssText = 'text-decoration:none;margin-top:16px;display:inline-flex;';
    btn.textContent = '📋 动态资料页';

    // 找合适位置
    const hero = document.querySelector('.hero-actions, .page-hero-content p:last-child');
    if (hero) {
      hero.after(btn);
    } else {
      document.querySelector('.member-hero .page-hero-content')?.appendChild(btn);
    }
  } catch(e) {}

  async function checkAdmin() {
    try { return (await fetch('/api/admin/check')).ok; } catch(e) { return false; }
  }
})();
