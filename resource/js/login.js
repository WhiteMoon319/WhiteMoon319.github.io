/**
 * YHG Login — 登录页逻辑
 * 依赖：main.js
 */
(function() {
  'use strict';

  // 检查是否已登录
  fetch('/api/auth/me')
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (data && data.ok) {
        window.location.href = '../dashboard/';
      }
    })
    .catch(function() {});

  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('authError');
    const btn = document.getElementById('submitBtn');

    errorEl.textContent = '';
    btn.disabled = true;
    btn.textContent = '登录中…';

    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
      });
      const data = await resp.json();

      if (resp.ok) {
        document.getElementById('authCard').innerHTML =
          '<div class="auth-success">' +
            '<h1>欢迎回来</h1>' +
            '<p class="sub">' + window.escapeHtml(data.user.username) + '，登录成功</p>' +
            '<strong class="motto">野火烧不尽，春风吹又生</strong>' +
            '<p style="margin-top:24px;"><a class="primary-btn" href="../dashboard/" style="text-decoration:none;">进入面板</a></p>' +
          '</div>';
      } else {
        errorEl.textContent = data.error || '登录失败';
        btn.disabled = false;
        btn.textContent = '登录';
      }
    } catch (e) {
      errorEl.textContent = '网络错误，请重试';
      btn.disabled = false;
      btn.textContent = '登录';
    }
  });
})();
