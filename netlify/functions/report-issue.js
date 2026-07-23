// Netlify Function：學生題目回報 -> 轉發到 Telegram。
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

export async function handler(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ ok: false }) };
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'not configured' }) };
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* ignore malformed body */ }
  const text = buildText(body);
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!r.ok) return { statusCode: 502, body: JSON.stringify({ ok: false }) };
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
}
