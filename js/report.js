// 學生回報題目有問題 -> 打回 /api/report-issue 這支 serverless function ->
// 轉發成 Telegram 訊息給老師。三個部署平台（Vercel/CF Pages/Netlify）各自的
// function 實作邏輯相同，只是進入點包裝不同，見各自 api/functions 目錄。
const XYReport = (() => {
  async function send(unit, note) {
    const meta = unit.meta || {};
    const payload = {
      unitId: unit.id,
      examTag: meta.examTag || '',
      level: meta.level || '',
      year: meta.year || '',
      sentence: unit.sentence || (unit.options && unit.options[0] && unit.options[0].sentence) || '',
      note: note || '',
    };
    const res = await fetch('/api/report-issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('report failed');
  }
  return { send };
})();
