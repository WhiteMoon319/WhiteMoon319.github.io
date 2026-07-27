/**
 * YHG Article — 文章详情页逻辑
 * 依赖：main.js（window.escapeHtml）
 * 功能：文章加载、点赞、评论(含嵌套回复/回复折叠/删除)
 */
(function() {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  const wrap = document.querySelector('.article-wrap');
  let currentUser = null; // { id, username, role }

  if (!slug) {
    if (wrap) wrap.innerHTML = '<p style="text-align:center;padding:40px;color:var(--dim);">缺少文章标识</p>';
    return;
  }

  // 取当前登录用户
  async function fetchCurrentUser() {
    try {
      const r = await fetch('/api/auth/me');
      const d = await r.json();
      if (d.ok) currentUser = d.user;
    } catch(e) { /* 未登录 */ }
  }

  (async function() {
    await fetchCurrentUser();

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
      document.getElementById('likeBtn')?.addEventListener('click', function() {
        toggleLike(a.id);
      });

      // 提交评论
      document.getElementById('submitComment')?.addEventListener('click', function() {
        submitComment(a.id, null);
      });

      // 按 Enter 提交评论
      document.getElementById('commentInput')?.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          submitComment(a.id, null);
        }
      });

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

  /** 是否可以删除指定评论 */
  function canDelete(commentUserId) {
    if (!currentUser) return false;
    if (currentUser.role === 'admin' || currentUser.role === 'sub_admin') return true;
    return currentUser.id === commentUserId;
  }

  /** 渲染单条评论 */
  function renderComment(c, depth) {
    if (depth === undefined) depth = 0;
    const isReply = depth > 0;
    const indent = isReply ? ' style="padding-left:' + Math.min(depth * 24, 72) + 'px;"' : '';
    const replyClass = isReply ? ' comment-reply' : '';

    const replyBtn = '<button class="reply-btn" data-id="' + c.id + '">回复</button>';

    const likeActive = c.liked_by_me ? ' liked' : '';
    const likeBtn = '<button class="comment-like-btn' + likeActive + '" data-id="' + c.id + '">' +
      '<span class="heart">' + (c.liked_by_me ? '\u2764' : '\u2661') + '</span> ' +
      '<span class="like-count" data-id="' + c.id + '">' + (c.like_count || 0) + '</span>' +
    '</button>';

    let avatarHtml = '<div class="comment-avatar">\uD83D\uDC64</div>';
    if (c.avatar) {
      avatarHtml = '<div class="comment-avatar"><img src="' + window.escapeHtml(c.avatar) + '"></div>';
    }

    // 删除按钮（仅作者/管理员可见）
    const delBtn = canDelete(c.user_id)
      ? '<button class="comment-del" data-id="' + c.id + '">删除</button>'
      : '';

    let html = '<div class="comment-item' + replyClass + '" data-id="' + c.id + '"' + indent + '>' +
      avatarHtml +
      '<div class="comment-body">' +
        '<span class="comment-author">' + window.escapeHtml(c.username || '匿名') + '</span>' +
        '<span class="comment-time">' + (c.created_at ? c.created_at.split('T')[0] : '') + '</span>' +
        delBtn +
        '<div class="comment-text">' + window.escapeHtml(c.content) + '</div>' +
        '<div class="comment-actions">' +
          likeBtn +
          replyBtn +
        '</div>' +
        '<div class="reply-form" id="replyForm-' + c.id + '" style="display:none;">' +
          '<div class="reply-form-inner">' +
            '<input type="text" class="reply-input" placeholder="回复 ' + window.escapeHtml(c.username) + '…">' +
            '<button class="reply-submit" data-parent="' + c.id + '">发送</button>' +
            '<button class="reply-cancel">取消</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    // 递归渲染子回复
    if (c.replies && c.replies.length > 0) {
      // 按点赞数降序排列
      c.replies.sort(function(a, b) {
        return (b.like_count || 0) - (a.like_count || 0);
      });

      var repliesHtml = '';
      var maxVisible = 2; // 只展示前 2 条高赞回复

      for (var i = 0; i < c.replies.length; i++) {
        var replyDepth = depth + 1;
        var replyContent = renderComment(c.replies[i], replyDepth);
        if (i < maxVisible) {
          repliesHtml += replyContent;
        } else {
          repliesHtml += '<div class="reply-hidden" style="display:none;">' + replyContent + '</div>';
        }
      }

      // 如果回复数 > maxVisible，加展开按钮
      if (c.replies.length > maxVisible) {
        var remain = c.replies.length - maxVisible;
        repliesHtml += '<div class="comment-replies-toggle" data-id="' + c.id + '">'
          + '查看全部 ' + c.replies.length + ' 条回复</div>';
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
        var fullHtml = '';
        for (var i = 0; i < data.comments.length; i++) {
          fullHtml += renderComment(data.comments[i], 0);
        }
        list.innerHTML = fullHtml;
        bindCommentEvents(articleId, list);
      } else {
        list.innerHTML = '<p class="comment-placeholder">暂无评论</p>';
      }
    } catch(e) {
      console.error(e);
    }
  }

  /** 绑定评论区的所有事件（回复/点赞/删除/展开） */
  function bindCommentEvents(articleId, list) {
    // 回复按钮
    list.querySelectorAll('.reply-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = this.dataset.id;
        var form = document.getElementById('replyForm-' + id);
        if (form) {
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

    // 回复提交
    list.querySelectorAll('.reply-submit').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var parentId = parseInt(this.dataset.parent);
        var input = this.parentElement.querySelector('.reply-input');
        if (input && input.value.trim()) {
          submitComment(articleId, parentId, input);
        }
      });
    });

    // 回复取消
    list.querySelectorAll('.reply-cancel').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var form = this.closest('.reply-form');
        if (form) form.style.display = 'none';
      });
    });

    // 评论点赞
    list.querySelectorAll('.comment-like-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var commentId = parseInt(this.dataset.id);
        toggleCommentLike(commentId, this);
      });
    });

    // 删除评论
    list.querySelectorAll('.comment-del').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var commentId = parseInt(this.dataset.id);
        if (!confirm('确定要删除这条评论吗？')) return;
        try {
          const resp = await fetch('/api/news/' + slug + '/comments/' + commentId, { method: 'DELETE' });
          const data = await resp.json();
          if (data.ok) {
            var item = document.querySelector('.comment-item[data-id="' + commentId + '"]');
            if (item) item.remove();
            // 如果评论区空了
            if (list.querySelectorAll('.comment-item').length === 0) {
              list.innerHTML = '<p class="comment-placeholder">暂无评论</p>';
            }
          } else {
            window.showToast(data.error || '删除失败', 'err');
          }
        } catch(e) {
          window.showToast('网络错误', 'err');
        }
      });
    });

    // 展开折叠的回复
    list.querySelectorAll('.comment-replies-toggle').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = this.dataset.id;
        var hidden = this.parentElement.querySelectorAll('.reply-hidden');
        hidden.forEach(function(el) { el.style.display = 'block'; });
        this.style.display = 'none';
      });
    });
  }

  async function toggleLike(articleId) {
    try {
      const resp = await fetch('/api/news/' + slug + '/like', { method: 'POST' });
      const data = await resp.json();
      if (resp.ok) {
        var countEl = document.getElementById('likeCount');
        var btn = document.getElementById('likeBtn');
        if (countEl) countEl.textContent = data.like_count;
        if (btn) btn.classList.toggle('liked');
      } else {
        window.showToast(data.error || '操作失败', 'err');
      }
    } catch(e) {
      window.showToast('网络错误', 'err');
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
        window.showToast(data.error || '操作失败', 'err');
      }
    } catch(e) {
      window.showToast('网络错误', 'err');
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
        window.showToast(data.error || '评论失败', 'err');
        if (submitBtn) submitBtn.disabled = false;
      }
    } catch(e) {
      window.showToast('网络错误', 'err');
      if (submitBtn) submitBtn.disabled = false;
    }
  }
})();
