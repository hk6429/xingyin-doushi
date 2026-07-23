// Vercel serverless function：跨網域轉發到 Cloudflare Pages 的權威 KV 儲存。
const AUTHORITY = 'https://xingyin-doushi.pages.dev/api/backup-load';

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).json({ ok: false }); return; }
  const code = encodeURIComponent(req.query.code || '');
  const r = await fetch(`${AUTHORITY}?code=${code}`);
  const body = await r.text();
  res.status(r.status).setHeader('Content-Type', 'application/json').send(body);
}
