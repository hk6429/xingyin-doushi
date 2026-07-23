// Cloudflare Pages Function：雲端備份，唯一真正存資料的平台（KV binding）。
// Vercel／Netlify 版本都只是跨網域轉發到這裡，見 api/backup-save.js 與
// netlify/functions/backup-save.js。
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 避開 0/O、1/I/L 容易看錯的字元
const TTL_SECONDS = 180 * 24 * 60 * 60; // 半年沒人用就讓它過期，KV 不用手動清

function randomCode(len = 6) {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

function isValidCode(code) {
  return typeof code === 'string' && /^[23456789A-HJ-NP-Z]{6}$/.test(code);
}

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch { /* ignore malformed body */ }
  const { data } = body;
  if (typeof data !== 'string' || !data) {
    return new Response(JSON.stringify({ ok: false, error: 'missing data' }), { status: 400 });
  }
  const code = isValidCode(body.code) ? body.code : randomCode();
  await env.BACKUP_KV.put(`backup:${code}`, data, { expirationTtl: TTL_SECONDS });
  return new Response(JSON.stringify({ ok: true, code }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}
