/**
 * YHG Auth — 密码工具
 * PBKDF2 + SHA-256，符合 Cloudflare Workers 运行时
 */

// 生成随机盐 (16 字节 hex)
export function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// PBKDF2 密码哈希
export async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 验证密码
export async function verifyPassword(password, stored) {
  // stored 格式: "salt:hash"
  const [salt, hash] = stored.split(':');
  const computed = await hashPassword(password, salt);
  return computed === hash;
}

// 创建哈希存库格式
export async function createPasswordHash(password) {
  const salt = generateSalt();
  const hash = await hashPassword(password, salt);
  return `${salt}:${hash}`;
}
