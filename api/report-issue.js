// Vercel serverless function：學生題目回報 -> 轉發到 Telegram。
function buildText({ examTag, level, year, unitId, sentence, note }) {
  return [
    '📮 形音鬥士 題目回報',
    examTag ? `題號：${examTag}` : '',
    level || year ? `分類：${level || ''}${year ? ' ' + year + '年' : ''}` : '',
    unitId ? `unit：${unitId}` : '',
    sentence ? `內容：${sentence}` : '',
    note ? `說明：${note}` : '（無留言）',
  ].filter(Boolean).join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) { res.status(500).json({ ok: false, error: 'not configured' }); return; }
  const text = buildText(req.body || {});
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!r.ok) { res.status(502).json({ ok: false }); return; }
  res.status(200).json({ ok: true });
}
