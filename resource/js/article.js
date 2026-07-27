/**
 * YHG Article — 文章详情页逻辑
 * 依赖：main.js（window.escapeHtml）
 */
(function() {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  const wrap = document.querySelector('.article-wrap');

  if (!slug) {
    if (wrap) wrap.innerHTML = '<p style="text-align:center;padding:40px;color:var(--dim);">缺少文章标识</p>';
    return;
  }

  (async function() {
    try {
      const resp = await fetch('/api/news/' + encodeURIComponent(slug));
      const data = await resp.json();

      if (!data.ok || !data.article) {
        if (wrap) wrap.innerHTML = '<p style="text-align:center;padding:40px;color:var(--dim);">文章不存在或已删除</p>';
        return;
      }

      const a = data.article;
      const contentHtml = cleanContent(a.content || '');
      const date = a.created_at ? a.created_at.split('T')[0] : '';
      const likedClass = a.liked ? ' liked' : '';

      const html =
        '<div class="article-card reveal in" data-delay="1">' +
          '<h1>' + window.escapeHtml(a.title) + '</h1>' +
          '<div class="article-meta">' +
            '<span>发布者 ' + window.escapeHtml(a.username || '匿名') + ' · ' + date + '</span>' +
            '<span>' + (a.view_count || 0) + ' 次阅读</span>' +
          '</div>' +
          '<div class="article-body">' + contentHtml + '</div>' +
          '<div class="article-actions">' +
            '<button class="like-btn' + likedClass + '" id="likeBtn">' +
              '<span class="heart">' + (a.liked ? '\u2764' : '\u2661') + '</span>' +
              ' <span id="likeCount">' + (a.like_count || 0) + '</span>' +
            '</button>' +
          '</div>' +
          '<div class="comment-section">' +
            '<h3>\u8BC4\u8BBA</h3>' +
            '<div class="comment-form">' +
              '<input type="text" id="commentInput" placeholder="\u8F93\u5165\u8BC4\u8BBA\u2026">' +
              '<button id="submitComment">\u53D1\u9001</button>' +
            '</div>' +
            '<div id="commentList"><p class="comment-placeholder">\u52A0\u8F7D\u4E2D\u2026</p></div>' +
          '</div>' +
        '</div>';

      if (wrap) wrap.innerHTML = html;

      // 加载评论
      loadComments(a.id);

      // 点赞事件
      const likeBtn = document.getElementById('likeBtn');
      if (likeBtn) {
        likeBtn.addEventListener('click', function() {
          toggleLike(a.id);
        });
      }

      // 提交评论
      const submitBtn = document.getElementById('submitComment');
      if (submitBtn) {
        submitBtn.addEventListener('click', function() {
          submitComment(a.id, null);
        });
      }

      // 按 Enter 提交评论
      const commentInput = document.getElementById('commentInput');
      if (commentInput) {
        commentInput.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            submitComment(a.id, null);
          }
        });
      }

    } catch (e) {
      console.error(e);
      if (wrap) wrap.innerHTML = '<p style="text-align:center;padding:40px;color:var(--dim);">\u52A0\u8F7D\u5931\u8D25</p>';
    }
  })();

  // 清洗文章内容
  function cleanContent(content) {
    return content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p\s*\/?>/gi, '')
      .replace(/<\/?div\s*[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\n/g, '<br>');
  }
  window._cleanContent = cleanContent;

  /** 渲染单条评论（含回复嵌套） */
  function renderComment(c, depth) {
    if (depth === undefined) depth = 0;
    const indent = depth > 0 ? ' style="padding-left:' + Math.min(depth * 28, 84) + 'px;"' : '';
    const replyBtn = '<button class="reply-btn" data-id="' + c.id + '">\u56DE\u590D</button>';
    const likeActive = c.liked_by_me ? ' liked' : '';
    const likeBtn = '<button class="comment-like-btn' + likeActive + '" data-id="' + c.id + '">' +
      '<span class="heart">' + (c.liked_by_me ? '\u2764' : '\u2661') + '</span> ' +
      '<span class="like-count" data-id="' + c.id + '">' + (c.like_count || 0) + '</span>' +
    '</button>';

    let avatarHtml = '<div class="comment-avatar">\uD83D\uDC64</div>';
    if (c.avatar) {
      avatarHtml = '<div class="comment-avatar"><img src="' + window.escapeHtml(c.avatar) + '"></div>';
    }

    let html = '<div class="comment-item" data-id="' + c.id + '"' + indent + '>' +
      avatarHtml +
      '<div class="comment-body">' +
        '<span class="comment-author">' + window.escapeHtml(c.username || '\u533F\u540D') + '</span>' +
        '<span class="comment-time">' + (c.created_at ? c.created_at.split('T')[0] : '') + '</span>' +
        '<div class="comment-text">' + window.escapeHtml(c.content) + '</div>' +
        '<div class="comment-actions">' +
          likeBtn +
          replyBtn +
        '</div>' +
        '<div class="reply-form" id="replyForm-' + c.id + '" style="display:none;">' +
          '<div class="reply-form-inner">' +
            '<input type="text" class="reply-input" placeholder="\u56DE\u590D ' + window.escapeHtml(c.username) + '\u2026">' +
            '<button class="reply-submit" data-parent="' + c.id + '">\u53D1\u9001</button>' +
            '<button class="reply-cancel">\u53D6\u6D88</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    // 递归渲染子回复
    if (c.replies && c.replies.length > 0) {
      var repliesHtml = '';
      for (var i = 0; i < c.replies.length; i++) {
        repliesHtml += renderComment(c.replies[i], depth + 1);
      }
      html += repliesHtml;
    }

    return html;
  }

  async function loadComments(articleId) {
    try {
      const resp = await fetch('/api/news/' + slug + '/comments');
      const data = await resp.json();
      const list = document.getElementById('commentList');
      if (!list) return;
      if (data.comments && data.comments.length > 0) {
        // 渲染嵌套评论
        var html = '';
        for (var i = 0; i < data.comments.length; i++) {
          html += renderComment(data.comments[i], 0);
        }
        list.innerHTML = html;

        // 绑定回复按钮
        list.querySelectorAll('.reply-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var id = this.dataset.id;
            var form = document.getElementById('replyForm-' + id);
            if (form) {
              // 折叠其他打开的回复框
              list.querySelectorAll('.reply-form').forEach(function(f) {
                if (f.id !== 'replyForm-' + id) f.style.display = 'none';
              });
              form.style.display = form.style.display === 'none' ? 'block' : 'none';
              if (form.style.display === 'block') {
                form.querySelector('.reply-input')?.focus();
              }
            }
          });
        });

        // 绑定回复提交
        list.querySelectorAll('.reply-submit').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var parentId = parseInt(this.dataset.parent);
            var input = this.parentElement.querySelector('.reply-input');
            if (input && input.value.trim()) {
              submitComment(articleId, parentId, input);
            }
          });
        });

        // 绑定回复取消
        list.querySelectorAll('.reply-cancel').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var form = this.closest('.reply-form');
            if (form) form.style.display = 'none';
          });
        });

        // 绑定评论点赞
        list.querySelectorAll('.comment-like-btn').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var commentId = parseInt(this.dataset.id);
            toggleCommentLike(commentId, this);
          });
        });
      } else {
        list.innerHTML = '<p class="comment-placeholder">\u6682\u65E0\u8BC4\u8BBA</p>';
      }
    } catch(e) {
      console.error(e);
    }
  }

  async function toggleLike(articleId) {
    try {
      const resp = await fetch('/api/news/' + slug + '/like', { method: 'POST' });
      const data = await resp.json();
      if (resp.ok) {
        const countEl = document.getElementById('likeCount');
        const btn = document.getElementById('likeBtn');
        if (countEl) countEl.textContent = data.like_count;
        if (btn) btn.classList.toggle('liked');
      } else {
        alert(data.error || '\u64CD\u4F5C\u5931\u8D25');
      }
    } catch(e) {
      alert('\u7F51\u7EDC\u9519\u8BEF');
    }
  }

  async function toggleCommentLike(commentId, btn) {
    try {
      const resp = await fetch('/api/news/' + slug + '/comments/' + commentId + '/like', { method: 'POST' });
      const data = await resp.json();
      if (resp.ok) {
        btn.classList.toggle('liked', data.liked);
        var countSpan = btn.querySelector('.like-count');
        if (countSpan) countSpan.textContent = data.like_count;
      } else {
        alert(data.error || '\u64CD\u4F5C\u5931\u8D25');
      }
    } catch(e) {
      alert('\u7F51\u7EDC\u9519\u8BEF');
    }
  }

  async function submitComment(articleId, parentId, inputEl) {
    var input = inputEl || document.getElementById('commentInput');
    if (!input) return;
    var content = input.value.trim();
    if (!content) return;

    var submitBtn = inputEl
      ? inputEl.parentElement.querySelector('.reply-submit')
      : document.getElementById('submitComment');
    if (submitBtn) submitBtn.disabled = true;

    try {
      var body = { content: content };
      if (parentId) body.parent_id = parentId;

      const resp = await fetch('/api/news/' + slug + '/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await resp.json();
      if (resp.ok) {
        input.value = '';
        loadComments(articleId);
      } else {
        alert(data.error || '\u8BC4\u8BBA\u5931\u8D25');
        if (submitBtn) submitBtn.disabled = false;
      }
    } catch(e) {
      alert('\u7F51\u7EDC\u9519\u8BEF');
      if (submitBtn) submitBtn.disabled = false;
    }
  }
})();
