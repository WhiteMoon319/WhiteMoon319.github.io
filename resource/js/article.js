/**
 * YHG Article — 文章详情页逻辑
 * 加载文章、渲染、点赞、评论
 */

(function() {
  var slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) {
    var el = document.getElementById('articleContent');
    if (el) el.innerHTML = '<p style="text-align:center;color:var(--dim);">缺少文章标识</p>';
    return;
  }

  var currentUser = null;

  (async function() {
    try {
      var meResp = await fetch('/api/auth/me');
      if (meResp.ok) currentUser = (await meResp.json()).user;
    } catch(e) {}

    var articleData;
    try {
      var resp = await fetch('/api/news/' + slug);
      if (!resp.ok) throw new Error('not found');
      articleData = await resp.json();
    } catch(e) {
      document.getElementById('articleContent').innerHTML = '<p style="text-align:center;color:var(--dim);">文章不存在或加载失败</p>';
      return;
    }

    var a = articleData.article;
    var created = a.created_at ? new Date(a.created_at + 'Z').toLocaleString('zh-CN') : '';

    var el = document.getElementById('articleContent');
    el.innerHTML = [
      '<h1>' + window.escapeHtml(a.title) + '</h1>',
      '<div class="article-meta">',
      '  <span>\u270D ' + window.escapeHtml(a.username) + '</span>',
      '  <span>\uD83D\uDCC5 ' + created + '</span>',
      '  <span id="likeDisplay">\u2764 ' + (a.like_count || 0) + '</span>',
      '</div>',
      '<div class="article-body">' + a.content.replace(/<[^>]+>/g, '').replace(/\n/g, '<br>') + '</div>',
      '<div class="article-actions">',
      '  <button class="like-btn' + (a.liked_by_me ? ' liked' : '') + '" id="likeBtn">',
      '    <span class="heart">' + (a.liked_by_me ? '\u2764' : '\u2661') + '</span>',
      '    <span id="likeCount">' + (a.like_count || 0) + '</span>',
      '  </button>',
      '  <a class="ghost-btn" href="./">\u2190 \u8FD4\u56DE\u65B0\u95FB</a>',
      (currentUser ? '<a class="ghost-btn" href="write.html?edit=' + slug + '" style="text-decoration:none;font-size:13px;">\u270F \u7F16\u8F91</a>' : ''),
      (currentUser ? '<button class="btn-del" id="delBtn">\u5220\u9664</button>' : ''),
      '</div>',
      '<div class="comment-section">',
      '  <h3>\uD83D\uDCAC \u8BC4\u8BBA</h3>',
      (currentUser ? [
        '  <div class="comment-form">',
        '    <input type="text" id="commentInput" placeholder="\u5199\u4E0B\u4F60\u7684\u8BC4\u8BBA\u2026" maxlength="500">',
        '    <button id="commentSubmit">\u53D1\u8868</button>',
        '  </div>'
      ].join('\n') : '<p style="color:var(--dim);font-size:13px;margin-bottom:16px;"><a href="../login.html" style="color:var(--fire);">\u767B\u5F55</a>\u540E\u53EF\u4EE5\u8BC4\u8BBA</p>'),
      '  <div id="commentList"><div class="comment-placeholder">\u52A0\u8F7D\u8BC4\u8BBA\u4E2D\u2026</div></div>',
      '</div>'
    ].filter(Boolean).join('\n');

    // 点赞
    var likeBtn = document.getElementById('likeBtn');
    if (currentUser) {
      likeBtn.addEventListener('click', async function() {
        var r = await fetch('/api/news/' + slug + '/like', { method: 'POST' });
        if (r.ok) {
          var d = await r.json();
          document.getElementById('likeCount').textContent = d.like_count;
          document.getElementById('likeDisplay').textContent = '\u2764 ' + d.like_count;
          likeBtn.classList.toggle('liked', d.liked);
          likeBtn.querySelector('.heart').textContent = d.liked ? '\u2764' : '\u2661';
        }
      });
    } else {
      likeBtn.addEventListener('click', function() {
        window.location.href = '../login.html';
      });
    }

    // 删除
    var delBtn = document.getElementById('delBtn');
    if (delBtn) {
      delBtn.addEventListener('click', async function() {
        if (!confirm('\u786E\u5B9A\u5220\u9664\u8FD9\u7BC7\u6587\u7AE0\uFF1F')) return;
        var r = await fetch('/api/news/' + slug, { method: 'DELETE' });
        if (r.ok) { window.location.href = './'; }
        else { var err = await r.json(); alert(err.error || '\u5220\u9664\u5931\u8D25'); }
      });
    }

    // 加载评论
    await loadComments(slug);

    // 发表评论
    var submitBtn = document.getElementById('commentSubmit');
    var input = document.getElementById('commentInput');
    if (submitBtn && input) {
      submitBtn.addEventListener('click', async function() {
        var content = input.value.trim();
        if (!content) return;
        submitBtn.disabled = true;
        var r = await fetch('/api/news/' + slug + '/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: content })
        });
        if (r.ok) {
          input.value = '';
          await loadComments(slug);
        } else {
          var err = await r.json();
          alert(err.error || '\u53D1\u8868\u5931\u8D25');
        }
        submitBtn.disabled = false;
      });
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitBtn.click(); }
      });
    }
  })();

  async function loadComments(slug) {
    var list = document.getElementById('commentList');
    try {
      var resp = await fetch('/api/news/' + slug + '/comments');
      var data = await resp.json();
      if (!data.ok || !data.comments || data.comments.length === 0) {
        list.innerHTML = '<div class="comment-placeholder">\u6682\u65E0\u8BC4\u8BBA\uFF0C\u5FEB\u6765\u62A2\u6C99\u53D1\u5427</div>';
        return;
      }
      var html = '';
      data.comments.forEach(function(c) {
        var time = c.created_at ? new Date(c.created_at + 'Z').toLocaleString('zh-CN') : '';
        var avatarHtml = c.avatar ? '<img src="' + window.escapeHtml(c.avatar) + '" alt="">' : '\uD83D\uDC64';
        var canDel = currentUser && (currentUser.id === c.user_id || currentUser.role === 'admin' || currentUser.role === 'sub_admin');
        html += [
          '<div class="comment-item">',
          '  <div class="comment-avatar">' + avatarHtml + '</div>',
          '  <div class="comment-body">',
          '    <div>',
          '      <span class="comment-author">' + window.escapeHtml(c.username) + '</span>',
          '      <span class="comment-time">' + time + '</span>',
          (canDel ? '<button class="comment-del" data-id="' + c.id + '">\u5220\u9664</button>' : ''),
          '    </div>',
          '    <div class="comment-text">' + window.escapeHtml(c.content) + '</div>',
          '  </div>',
          '</div>'
        ].filter(Boolean).join('\n');
      });
      list.innerHTML = html;
      // delete event listeners (replace onclick with data-id)
      list.querySelectorAll('.comment-del').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          if (!confirm('\u786E\u5B9A\u5220\u9664\u8FD9\u6761\u8BC4\u8BBA\uFF1F')) return;
          var r = await fetch('/api/news/' + slug + '/comments/' + btn.dataset.id, { method: 'DELETE' });
          if (r.ok) { await loadComments(slug); }
          else { var err = await r.json(); alert(err.error || '\u5220\u9664\u5931\u8D25'); }
        });
      });
    } catch(e) {
      list.innerHTML = '<div class="comment-placeholder">\u8BC4\u8BBA\u52A0\u8F7D\u5931\u8D25</div>';
    }
  }
})();
