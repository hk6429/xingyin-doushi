// Cloudflare Pages Function：依代碼取回雲端備份（KV binding，權威平台，見 backup-save.js）。
function isValidCode(code) {
  return typeof code === 'string' && /^[23456789A-HJ-NP-Z]{6}$/.test(code);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = (url.searchParams.get('code') || '').toUpperCase();
  if (!isValidCode(code)) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid code' }), { status: 400 });
  }
  const data = await env.BACKUP_KV.get(`backup:${code}`);
  if (data === null) {
    return new Response(JSON.stringify({ ok: false, error: 'not found' }), { status: 404 });
  }
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}
