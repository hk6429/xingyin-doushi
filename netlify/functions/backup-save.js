// Netlify function：跨網域轉發到 Cloudflare Pages 的權威 KV 儲存。
const AUTHORITY = 'https://xingyin-doushi.pages.dev/api/backup-save';

export async function handler(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ ok: false }) };
  const r = await fetch(AUTHORITY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: event.body || '{}',
  });
  const body = await r.text();
  return { statusCode: r.status, headers: { 'Content-Type': 'application/json' }, body };
}
