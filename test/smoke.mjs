// test/smoke.mjs
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const ROOT = new URL('..', import.meta.url).pathname;

const server = createServer(async (req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url;
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'text/plain' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((resolve) => server.listen(4174, resolve));

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});

await page.goto('http://localhost:4174');
await page.waitForSelector('#view-home:not(.hidden)');
await page.waitForSelector('.mode-card');
const modeCount = await page.$$eval('.mode-card', (els) => els.length);

// 0. 鍵盤作答：數字鍵 1 選第一個選項，空白鍵推進下一題
await page.click('[data-mode="mix"]');
await page.waitForSelector('#view-quiz:not(.hidden)');
await page.waitForSelector('#quiz-card button:not([disabled])');
const kbdKind = await page.$eval('#quiz-card', (el) => {
  if (el.querySelector('.opt-grid')) return 'mc';
  if (el.querySelector('.judge-row')) return 'judge';
  return 'other';
});
if (kbdKind === 'mc' || kbdKind === 'judge') {
  await page.keyboard.press('1');
  await page.waitForSelector('#quiz-card .feedback-bar');
  if (kbdKind === 'judge') {
    const fillBtn = await page.$('#quiz-card [data-action="submit-fill"]');
    if (fillBtn) { await fillBtn.click(); await page.waitForSelector('#quiz-card .feedback-bar'); }
  }
  const scoreBefore = await page.$eval('#quiz-index', (el) => el.textContent);
  await page.keyboard.press(' ');
  await page.waitForFunction(
    (prev) => document.querySelector('#quiz-index')?.textContent !== prev,
    scoreBefore,
  );
}
await page.click('#view-quiz [data-action="home"]');
await page.waitForSelector('#view-home:not(.hidden)');
const dailyPanelText = await page.$eval('#daily-quest-panel', (el) => el.textContent);

// 1. 字形挑戰模式：作答直到出現結果頁
await page.click('[data-mode="xingxing"]');
await page.waitForSelector('#view-quiz:not(.hidden)');

async function answerOneQuestion(scope) {
  await page.waitForSelector(`${scope} button:not([disabled])`);
  const kind = await page.$eval(scope, (el) => {
    if (el.querySelector('.opt-grid')) return 'mc';
    if (el.querySelector('.judge-row')) return 'judge';
    if (el.querySelector('.pick-list')) return 'pick';
    return 'unknown';
  });
  if (kind === 'mc') {
    await page.click(`${scope} .opt-btn`);
  } else if (kind === 'judge') {
    await page.click(`${scope} .judge-btn[data-v="true"]`);
    const fillBtn = await page.$(`${scope} [data-action="submit-fill"]`);
    if (fillBtn) await fillBtn.click();
  } else if (kind === 'pick') {
    await page.click(`${scope} .pick-option`);
  }
  await page.waitForSelector(`${scope} .feedback-bar`);
  return kind;
}

for (let i = 0; i < 10; i++) {
  await answerOneQuestion('#quiz-card');
  const nextBtn = await page.$('#quiz-card [data-action="next"]');
  if (nextBtn) await nextBtn.click();
  else break;
}
await page.waitForSelector('#view-result:not(.hidden)');
const resultText = await page.$eval('#result-summary', (el) => el.textContent);

// 2. 回首頁，錯題本應該至少收錄一題（因為第一題我們沒有刻意選正確答案）
await page.click('#view-result [data-action="home"]');
await page.waitForSelector('#view-home:not(.hidden)');
const wrongbookText = await page.$eval('#wrongbook-count', (el) => el.textContent);

// 3. 對戰模式：可以看到考官列表、點第一位開打、答一題看血條變化
await page.click('[data-mode="battle"]');
await page.waitForSelector('#view-battle:not(.hidden)');
await page.waitForSelector('.roster-item:not(.locked)');
await page.click('.roster-item:not(.locked)');
await answerOneQuestion('#battle-card');
await page.waitForTimeout(1200);
const hpEnemyWidth = await page.$eval('#hp-enemy', (el) => el.style.width);

// 4. 圖鑑：回首頁再進圖鑑，應該至少出現一張卡
await page.click('#battle-title'); // no-op click just to ensure page stable
await page.goto('http://localhost:4174');
await page.waitForSelector('#view-home:not(.hidden)');
await page.click('[data-mode="dex"]');
await page.waitForSelector('#view-dex:not(.hidden)');
await page.waitForSelector('.dex-card');
const dexCount = await page.$$eval('.dex-card', (els) => els.length);

// 4b. 迴歸測試：isCorrectAsIs 的字形題不可在句子裡洩漏正解字
const maskedSentenceHTML = await page.evaluate(() => {
  const fakeUnit = {
    id: 'test#0', kind: 'mc-char', mode: 'char',
    sentence: '這是「測」試句', target: '測', isCorrectAsIs: true,
    correct: '測', options: ['測', '側', '惻', '策'],
  };
  const div = document.createElement('div');
  document.body.appendChild(div);
  XYQuestionUI.render(div, fakeUnit, { onDone: () => {}, onNext: () => {} });
  const html = div.querySelector('.quiz-sentence').innerHTML;
  div.remove();
  return html;
});
if (maskedSentenceHTML.includes('>測<')) {
  console.log('FAIL: isCorrectAsIs question leaks the correct character in the sentence:', maskedSentenceHTML);
  process.exit(1);
}

// 5. 備份／還原：匯出框應該非空，還原按鈕可觸發不炸頁面
await page.click('#view-dex [data-action="home"]');
await page.waitForSelector('#view-home:not(.hidden)');
await page.click('[data-action="backup-open"]');
await page.waitForSelector('#view-backup:not(.hidden)');
const exportLen = await page.$eval('#backup-export', (el) => el.value.length);

await browser.close();
server.close();

console.log('mode cards:', modeCount);
console.log('daily quest panel after keyboard-answered question:', dailyPanelText);
console.log('round result:', resultText);
console.log('wrongbook after round:', wrongbookText);
console.log('battle enemy hp bar width after 1 hit:', hpEnemyWidth);
console.log('dex cards rendered:', dexCount);
console.log('backup export textarea length:', exportLen);
console.log('console/page errors:', errors.length);
if (errors.length) {
  errors.forEach((e) => console.log(' -', e));
  process.exit(1);
}
if (modeCount < 6 || dexCount < 1 || exportLen < 10) {
  console.log('FAIL: unexpected render counts');
  process.exit(1);
}
console.log('SMOKE TEST PASSED');
