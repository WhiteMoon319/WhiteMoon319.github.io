/**
 * POST /api/auth/send-code
 * 发送邮箱验证码
 * Body: { email }
 * 通过 QQ 邮箱 SMTP 发送 6 位验证码
 */
import nodemailer from 'nodemailer';
import {checkRateLimit, json, err, handleAsync} from '../_auth.js';

// 生成6位随机数字验证码（密码学安全）
function generateCode() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

export const onRequest = handleAsync(async (context) => {
  const { request, env } = context;


  if (request.method !== 'POST') {
    return err('方法不允许', 405);
  }

  try {
    const { email } = await request.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return err('请输入有效的邮箱地址', 400);
    }

    // IP 频率限制：每 10 分钟最多 5 次发信请求
    const ipLimit = await checkRateLimit(request, env, 'send-code', 5, 10);
    if (!ipLimit.ok) {
      return err(ipLimit.error, 429, { 'Retry-After': '600' });
    }

    // 检查该邮箱 60 秒内是否已发过验证码（防刷）
    const recent = await env.DB.prepare(
      "SELECT id FROM verification_codes WHERE email = ? AND used = 0 AND expires_at > datetime('now', '+5 minutes') AND created_at > datetime('now', '-1 minute')"
    ).bind(email).first();
    if (recent) {
      return err('验证码已发送，请稍后再试', 429);
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString().replace('T', ' ').replace('Z', '');

    // 存验证码到 D1
    await env.DB.prepare(
      'INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)'
    ).bind(email, code, expiresAt).run();

    // 用 QQ 邮箱 SMTP 发邮件
    const transporter = nodemailer.createTransport({
      host: 'smtp.qq.com',
      port: 465,
      secure: true,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    });

    const mailContent = `
      <div style="max-width:520px;margin:0 auto;font-family:'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;background:#fafafa;border-radius:12px;overflow:hidden;border:1px solid #e8e8e8;">
        <div style="background:linear-gradient(135deg,#ff4d4f,#ff7a45);padding:28px 32px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:22px;letter-spacing:2px;">YHG ESPORTS</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">邮箱验证</p>
        </div>
        <div style="padding:32px 32px 28px;">
          <p style="font-size:15px;color:#333;margin:0 0 20px;">你好，</p>
          <p style="font-size:14px;color:#555;margin:0 0 16px;line-height:1.7;">
            你正在注册 YHG 电子竞技战队账号，请使用以下验证码完成验证：
          </p>
          <div style="text-align:center;margin:24px 0;">
            <span style="display:inline-block;font-size:36px;font-weight:800;letter-spacing:12px;color:#ff4d4f;background:#fff1f0;padding:12px 28px;border-radius:8px;border:1px dashed #ffccc7;font-family:'Courier New',monospace;">${code}</span>
          </div>
          <p style="font-size:13px;color:#999;margin:16px 0 0;line-height:1.6;">
            验证码有效期为 10 分钟，请尽快完成验证。<br>
            如非本人操作，请忽略此邮件。
          </p>
        </div>
        <div style="background:#f2f2f2;padding:16px 32px;text-align:center;border-top:1px solid #e8e8e8;">
          <p style="margin:0;font-size:12px;color:#aaa;">© 2026 YHG ESPORTS · 此邮件由系统自动发送，请勿回复</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"YHG ESPORTS" <${env.SMTP_USER}>`,
      to: email,
      subject: 'YHG 战队 - 邮箱验证码',
      html: mailContent
    });

    return json({ ok: true, message: '验证码已发送到邮箱' });
  } catch (e) {
    console.error('send-code error:', e);
    return err('发送验证码失败，请稍后重试', 500);
  }
});
