// Netlify function：跨網域轉發到 Cloudflare Pages 的權威 KV 儲存。
const AUTHORITY = 'https://xingyin-doushi.pages.dev/api/backup-load';

export async function handler(event) {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: JSON.stringify({ ok: false }) };
  const code = encodeURIComponent((event.queryStringParameters && event.queryStringParameters.code) || '');
  const r = await fetch(`${AUTHORITY}?code=${code}`);
  const body = await r.text();
  return { statusCode: r.status, headers: { 'Content-Type': 'application/json' }, body };
}
