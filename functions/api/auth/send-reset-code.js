/**
 * POST /api/auth/send-reset-code
 * 发送密码重置验证码到邮箱
 * Body: { email }
 */
import nodemailer from 'nodemailer';
import { checkRateLimit } from '../_auth.js';

function generateCode() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

export async function onRequest(context) {
  const { request, env } = context;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: '方法不允许' }), { status: 405, headers });
  }

  try {
    const { email } = await request.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: '请输入有效的邮箱地址' }), { status: 400, headers });
    }

    // IP 频率限制：每 10 分钟最多 5 次发信请求
    const ipLimit = await checkRateLimit(request, env, 'send-reset-code', 5, 10);
    if (!ipLimit.ok) {
      return new Response(JSON.stringify({ error: ipLimit.error }), {
        status: 429, headers: { ...headers, 'Retry-After': '600' }
      });
    }

    // 检查邮箱是否已注册
    const user = await env.DB.prepare('SELECT id, username FROM users WHERE email = ?').bind(email).first();
    if (!user) {
      // 不泄露邮箱是否注册，统一返回成功
      return new Response(JSON.stringify({ ok: true, message: '若该邮箱已注册，验证码已发送' }), { status: 200, headers });
    }

    // 防刷：60秒内不能重复发
    const recent = await env.DB.prepare(
      "SELECT id FROM verification_codes WHERE email = ? AND used = 0 AND expires_at > datetime('now', '+5 minutes') AND created_at > datetime('now', '-1 minute')"
    ).bind(email).first();
    if (recent) {
      return new Response(JSON.stringify({ error: '验证码已发送，请稍后再试' }), { status: 429, headers });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString().replace('T', ' ').replace('Z', '');

    await env.DB.prepare(
      'INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)'
    ).bind(email, code, expiresAt).run();

    const transporter = nodemailer.createTransport({
      host: 'smtp.qq.com',
      port: 465,
      secure: true,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
    });

    await transporter.sendMail({
      from: `"YHG ESPORTS" <${env.SMTP_USER}>`,
      to: email,
      subject: 'YHG 战队 - 密码重置验证码',
      html: `
        <div style="max-width:520px;margin:0 auto;font-family:sans-serif;background:#fafafa;border-radius:12px;border:1px solid #e8e8e8;">
          <div style="background:linear-gradient(135deg,#ff4d4f,#ff7a45);padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:22px;">YHG ESPORTS</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">密码重置</p>
          </div>
          <div style="padding:32px;">
            <p style="font-size:14px;color:#555;margin:0 0 16px;line-height:1.7;">
              你正在重置 YHG 战队账号密码，请使用以下验证码：
            </p>
            <div style="text-align:center;margin:24px 0;">
              <span style="display:inline-block;font-size:36px;font-weight:800;letter-spacing:12px;color:#ff4d4f;background:#fff1f0;padding:12px 28px;border-radius:8px;border:1px dashed #ffccc7;font-family:Courier New,monospace;">${code}</span>
            </div>
            <p style="font-size:13px;color:#999;margin:16px 0 0;line-height:1.6;">
              验证码有效期为 10 分钟。<br>
              如非本人操作，请忽略此邮件。
            </p>
          </div>
          <div style="background:#f2f2f2;padding:16px;text-align:center;border-top:1px solid #e8e8e8;">
            <p style="margin:0;font-size:12px;color:#aaa;">© 2026 YHG ESPORTS · 自动发送，请勿回复</p>
          </div>
        </div>
      `
    });

    return new Response(JSON.stringify({ ok: true, message: '验证码已发送到邮箱' }), { status: 200, headers });
  } catch (e) {
    console.error('send-reset-code error:', e);
    return new Response(JSON.stringify({ error: '发送失败，请稍后重试' }), { status: 500, headers });
  }
}
