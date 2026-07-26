/**
 * 阻止直接访问 _private 目录下的敏感文件
 * 所有 /_private/* 请求均返回 403
 */
export async function onRequest(context) {
  return new Response('Forbidden', { status: 403 });
}
