/**
 * YHG News Write — 写文章/编辑文章页逻辑
 * 依赖：main.js（window._cleanContent, window.__revealIO）
 */
(function() {
  'use strict';

  // 检测是否为编辑模式
  const params = new URLSearchParams(window.location.search);
  const editSlug = params.get('edit');

  (async function() {
    try {
      const resp = await fetch('/api/auth/me');
      if (!resp.ok) {
        window.location.href = '../login/?redirect=news/write.html';
        return;
      }
      const data = await resp.json();
      const level = data.user.level || 1;
      const isStaff = data.user.role === 'admin' || data.user.role === 'sub_admin';
      if (!isStaff && level < 2) {
        const writeCard = document.querySelector('.write-card');
        if (writeCard) {
          writeCard.innerHTML =
            '<div style="text-align:center;padding:40px 0;">' +
              '<div style="font-size:48px;margin-bottom:16px;">🔒</div>' +
              '<h2 style="font-size:20px;color:var(--text);margin:0 0 8px;">需要 Lv.2 才能发文</h2>' +
              '<p style="color:var(--dim);font-size:14px;">联系战队管理员提升等级后即可发布文章。</p>' +
              '<p style="margin-top:24px;"><a href="./" style="color:var(--fire);">返回新闻</a></p>' +
            '</div>';
        }
        return;
      }

      // 编辑模式：加载文章数据
      if (editSlug) {
        const pageTitle = document.getElementById('pageTitle');
        const pageSub = document.getElementById('pageSub');
        const submitBtn = document.getElementById('submitBtn');
        if (pageTitle) pageTitle.textContent = '编辑文章';
        if (pageSub) pageSub.textContent = '修改已发布的文章';
        if (submitBtn) submitBtn.textContent = '保存修改';

        const articleResp = await fetch('/api/news/' + editSlug);
        if (!articleResp.ok) {
          const writeCard = document.querySelector('.write-card');
          if (writeCard) writeCard.innerHTML = '<p style="color:var(--flame);padding:40px;text-align:center;">文章不存在或无权编辑</p>';
          return;
        }
        const articleData = await articleResp.json();
        if (articleData.ok && articleData.article) {
          const titleEl = document.getElementById('title');
          const summaryEl = document.getElementById('summary');
          const contentEl = document.getElementById('content');
          if (titleEl) titleEl.value = articleData.article.title || '';
          if (summaryEl) summaryEl.value = articleData.article.summary || '';
          if (contentEl) {
            // 清洗内容中的 HTML 标签，保留换行
            const cleaned = (articleData.article.content || '')
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<\/p>/gi, '\n')
              .replace(/<p\s*\/?>/gi, '')
              .replace(/<[^>]+>/g, '');
            contentEl.value = cleaned;
          }
        }
      }
    } catch(e) {
      window.location.href = '../login/?redirect=news/write.html';
    }
  })();

  // 表单提交
  const articleForm = document.getElementById('articleForm');
  if (articleForm) {
    articleForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const title = document.getElementById('title').value.trim();
      const summary = document.getElementById('summary').value.trim();
      const content = document.getElementById('content').value;
      const errorEl = document.getElementById('formError');
      const btn = document.getElementById('submitBtn');

      if (errorEl) errorEl.textContent = '';
      if (!title || !content) {
        if (errorEl) errorEl.textContent = '标题和正文不能为空';
        return;
      }

      btn.disabled = true;
      btn.textContent = editSlug ? '保存中…' : '发布中…';

      try {
        const url = editSlug ? '/api/news/' + editSlug : '/api/news';
        const method = editSlug ? 'PUT' : 'POST';
        const resp = await fetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title, summary: summary, content: content })
        });
        const data = await resp.json();

        if (resp.ok) {
          if (editSlug) {
            window.location.href = 'article.html?slug=' + editSlug;
          } else if (data.status === 'pending') {
            const articleFormEl = document.getElementById('articleForm');
            if (articleFormEl) {
              articleFormEl.innerHTML =
                '<div style="text-align:center;padding:40px 0;">' +
                  '<div style="font-size:48px;margin-bottom:16px;">✅</div>' +
                  '<h2 style="font-size:20px;color:var(--text);margin:0 0 8px;">文章已提交</h2>' +
                  '<p style="color:var(--dim);font-size:14px;">已提交管理员审核，审核通过后将公开发布。</p>' +
                  '<p style="margin-top:24px;"><a href="./" style="color:var(--fire);">返回新闻</a></p>' +
                '</div>';
            }
          } else {
            window.location.href = 'article.html?slug=' + data.slug;
          }
        } else {
          if (errorEl) errorEl.textContent = data.error || '操作失败';
          btn.disabled = false;
          btn.textContent = editSlug ? '保存修改' : '发布文章';
        }
      } catch (e) {
        if (errorEl) errorEl.textContent = '网络错误，请重试';
        btn.disabled = false;
        btn.textContent = editSlug ? '保存修改' : '发布文章';
      }
    });
  }
})();
