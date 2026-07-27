/**
 * YHG Player Dynamic — 选手详情页动态数据加载
 * 在所有成员页面加载后运行，从 API 读取数据替换硬编码内容
 */
(async function() {
  try {
    const slug = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '').split('/').pop();
    if (!slug) return;

    const resp = await fetch('/api/players/' + slug);
    if (!resp.ok) return;
    const data = await resp.json();
    if (!data.ok) return;
    const p = data.player;

    // 解析 stats
    let stats = {};
    try { stats = JSON.parse(p.stats || '{}'); } catch(e) {}

    const maxValues = { '实力': 20, '智商': 20, '情商': 20, '颜值': 20, '素质': 20, '运气': 20 };

    // === Hero 区 ===
    const eyebrow = document.querySelector('.eyebrow');
    if (eyebrow) eyebrow.textContent = p.role.toUpperCase();

    const heroH1 = document.querySelector('.page-hero-content h1');
    if (heroH1) {
      const strong = heroH1.querySelector('strong');
      if (strong) strong.textContent = p.id_name;
      else heroH1.textContent = p.id_name;
    }

    const heroDesc = document.querySelector('.page-hero-content > p');
    if (heroDesc && p.bio) heroDesc.textContent = `${p.name}，${p.age || ''}岁，${p.role}。${p.bio}`;

    // === 侧边栏 ===
    const portraitRole = document.querySelector('.member-portrait .role');
    if (portraitRole) portraitRole.textContent = p.id_name + ' / ' + p.role;

    const portraitName = document.querySelector('.member-portrait h2');
    if (portraitName) portraitName.textContent = p.name;

    const portraitBio = document.querySelector('.member-portrait-content > p');
    if (portraitBio) portraitBio.textContent = p.bio || '';

    // === 基础资料表格 ===
    const fieldMap = {
      '姓名': p.name,
      'ID': p.id_name,
      '年龄': String(p.age || ''),
      '分路': p.role,
      '荣誉': p.titles || ''
    };

    document.querySelectorAll('.info-cell').forEach(cell => {
      const field = cell.dataset.field;
      const value = cell.querySelector('b');
      if (!field || !value) return;
      if (fieldMap[field] !== undefined && fieldMap[field] !== '') {
        value.textContent = fieldMap[field];
      }
    });

    // page title
    if (p.id_name) document.title = p.id_name + ' - YHG电子竞技战队';

    // === 属性面板 ===
    document.querySelectorAll('.attribute').forEach(attr => {
      const span = attr.querySelector('span');
      const bar = attr.querySelector('i');
      if (!span) return;
      const label = span.textContent.replace(/\d+/g, '').trim();
      const key = Object.keys(stats).find(k => label.includes(k));
      if (key && stats[key] !== undefined) {
        const val = stats[key];
        const max = maxValues[key] || 20;
        const pct = Math.min(100, Math.round((val / max) * 100));
        span.innerHTML = `${key} <b>${String(val).padStart(2, '0')}</b>`;
        if (bar) bar.style.setProperty('--value', pct + '%');
      }
    });

    // === 性格 / 经历 / 锚点 section ===
    const sectionMap = {
      '性格': p.personality,
      '经历': p.experience,
      '锚点': p.anchor
    };

    document.querySelectorAll('.info-panel').forEach(panel => {
      const h3 = panel.querySelector('h3');
      const pEl = panel.querySelector('p');
      if (!h3 || !pEl) return;
      const key = h3.textContent.trim();
      if (sectionMap[key] !== undefined && sectionMap[key]) {
        pEl.textContent = sectionMap[key];
      }
    });

  } catch(e) {
    // 静默失败，保留原始静态内容
  }
})();
