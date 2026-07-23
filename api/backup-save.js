// Vercel serverless function：雲端備份只有一份真身在 Cloudflare Pages（KV binding），
// 這裡單純跨網域轉發，避免每個平台各自維護一份儲存邏輯。
const AUTHORITY = 'https://xingyin-doushi.pages.dev/api/backup-save';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  const r = await fetch(AUTHORITY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body || {}),
  });
  const body = await r.text();
  res.status(r.status).setHeader('Content-Type', 'application/json').send(body);
}
