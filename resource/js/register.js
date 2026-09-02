/**
 * YHG Register — 注册页逻辑
 * 依赖：main.js
 */
(function() {
  'use strict';

  const msgArea = document.getElementById('msgArea');
  const sendCodeBtn = document.getElementById('sendCodeBtn');
  const emailInput = document.getElementById('email');
  const codeInput = document.getElementById('code');
  const form = document.getElementById('registerForm');
  const submitBtn = document.getElementById('submitBtn');

  if (!form) return;

  let codeSent = false;
  let countdown = 0;
  let countdownTimer = null;

  // 发送验证码
  sendCodeBtn.addEventListener('click', async function() {
    const email = emailInput.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMsg('请输入有效的邮箱地址', 'error');
      return;
    }

    sendCodeBtn.disabled = true;
    sendCodeBtn.textContent = '发送中…';

    try {
      const resp = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      });
      const data = await resp.json();

      if (resp.ok) {
        showMsg('✅ 验证码已发送到 ' + email, 'success');
        codeSent = true;
        startCountdown(60);
      } else {
        showMsg(data.error || '发送失败', 'error');
        sendCodeBtn.disabled = false;
        sendCodeBtn.textContent = '发送验证码';
      }
    } catch (e) {
      showMsg('网络错误，请重试', 'error');
      sendCodeBtn.disabled = false;
      sendCodeBtn.textContent = '发送验证码';
    }
  });

  // 倒计时
  function startCountdown(sec) {
    countdown = sec;
    sendCodeBtn.textContent = countdown + '秒后重试';
    countdownTimer = setInterval(function() {
      countdown--;
      if (countdown <= 0) {
        clearInterval(countdownTimer);
        sendCodeBtn.disabled = false;
        sendCodeBtn.textContent = '重新发送';
      } else {
        sendCodeBtn.textContent = countdown + '秒后重试';
      }
    }, 1000);
  }

  // 提交注册
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = emailInput.value.trim();
    const code = codeInput.value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;

    if (!codeSent) {
      showMsg('请先获取验证码', 'error');
      return;
    }
    if (!code || code.length !== 6) {
      showMsg('请输入6位验证码', 'error');
      return;
    }
    if (password !== confirm) {
      showMsg('两次密码不一致', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '注册中…';

    try {
      const resp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, code: code, username: username, password: password })
      });
      const data = await resp.json();

      if (resp.ok) {
        document.querySelector('.auth-card').innerHTML =
          '<div style="text-align:center;padding:20px 0;">' +
            '<h1>注册成功</h1>' +
            '<p class="sub">欢迎加入 YHG，' + window.escapeHtml(username) + '！</p>' +
            '<p style="margin-top:16px; color:var(--dim);">即将跳转到登录页…</p>' +
          '</div>';
        setTimeout(function() { window.location.href = '../login/'; }, 2000);
      } else {
        showMsg(data.error || '注册失败', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = '注册';
      }
    } catch (e) {
      showMsg('网络错误，请重试', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = '注册';
    }
  });

  function showMsg(text, type) {
    msgArea.innerHTML = '<div class="' + (type === 'error' ? 'auth-error' : 'auth-success') + '">' + window.escapeHtml(text) + '</div>';
  }
})();
