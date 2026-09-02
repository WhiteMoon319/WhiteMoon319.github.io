/**
 * YHG Forgot Password — 重置密码页逻辑
 * 依赖：main.js
 */
(function() {
  'use strict';

  const msgArea = document.getElementById('msgArea');
  const sendBtn = document.getElementById('sendCodeBtn');
  const emailInput = document.getElementById('email');
  const form = document.getElementById('resetForm');

  if (!form) return;

  let countdown = 0, timer = null;

  sendBtn.addEventListener('click', async function() {
    const email = emailInput.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMsg('请输入有效的邮箱地址', 'error');
      return;
    }
    sendBtn.disabled = true;
    sendBtn.textContent = '发送中…';
    try {
      const resp = await fetch('/api/auth/send-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      });
      const data = await resp.json();
      if (resp.ok) {
        showMsg('✅ 验证码已发送到 ' + email, 'success');
        startCountdown(60);
      } else {
        showMsg(data.error || '发送失败', 'error');
        sendBtn.disabled = false;
        sendBtn.textContent = '发送验证码';
      }
    } catch(e) {
      showMsg('网络错误', 'error');
      sendBtn.disabled = false;
      sendBtn.textContent = '发送验证码';
    }
  });

  function startCountdown(sec) {
    countdown = sec;
    sendBtn.textContent = countdown + '秒后重试';
    timer = setInterval(function() {
      countdown--;
      if (countdown <= 0) {
        clearInterval(timer);
        sendBtn.disabled = false;
        sendBtn.textContent = '重新发送';
      } else {
        sendBtn.textContent = countdown + '秒后重试';
      }
    }, 1000);
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = emailInput.value.trim();
    const code = document.getElementById('code').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;

    if (!code || code.length !== 6) {
      showMsg('请输入6位验证码', 'error');
      return;
    }
    if (password !== confirm) {
      showMsg('两次密码不一致', 'error');
      return;
    }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = '重置中…';
    try {
      const resp = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, code: code, password: password })
      });
      const data = await resp.json();
      if (resp.ok) {
        document.querySelector('.auth-card').innerHTML =
          '<div style="text-align:center;padding:30px 0;">' +
            '<div style="font-size:48px;margin-bottom:12px;">✅</div>' +
            '<h2 style="font-size:20px;color:var(--text);margin:0 0 8px;">密码已重置</h2>' +
            '<p style="color:var(--dim);">请使用新密码登录</p>' +
            '<p style="margin-top:24px;"><a href="../login/" class="auth-btn" style="display:inline-flex;width:auto;padding:0 32px;text-decoration:none;">去登录</a></p>' +
          '</div>';
      } else {
        showMsg(data.error || '重置失败', 'error');
        btn.disabled = false;
        btn.textContent = '重置密码';
      }
    } catch(e) {
      showMsg('网络错误', 'error');
      btn.disabled = false;
      btn.textContent = '重置密码';
    }
  });

  function showMsg(text, type) {
    msgArea.innerHTML = '<div class="' + (type === 'error' ? 'auth-error' : 'auth-success') + '">' + window.escapeHtml(text) + '</div>';
  }
})();
