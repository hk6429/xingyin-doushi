// Cloudflare Pages Function：學生題目回報 -> 轉發到 Telegram。
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

export async function onRequestPost({ request, env }) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return new Response(JSON.stringify({ ok: false, error: 'not configured' }), { status: 500 });
  }
  let body = {};
  try { body = await request.json(); } catch { /* ignore malformed body */ }
  const text = buildText(body);
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!r.ok) return new Response(JSON.stringify({ ok: false }), { status: 502 });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
