import assert from 'node:assert';
import { readFileSync } from 'node:fs';

function loadQuiz() {
  const code = readFileSync('js/quiz.js', 'utf-8');
  return new Function('XYData', `${code}\nreturn XYQuiz;`)({ shuffle: (a) => a });
}
const Q = loadQuiz();

// 1. 判斷題填空：學生只填正解字，資料卻寫整句訂正 → 必須算對
//    （這是使用者實測踩到的：「香遠易清」填「益」被判錯）
{
  const unit = { kind: 'judge', isCorrectAsIs: false, answers: ['香遠「益」清'] };
  assert.strictEqual(Q.check(unit, { isCorrect: false, filled: ['益'] }).correct, true,
    '填「益」應算對');
  assert.strictEqual(Q.check(unit, { isCorrect: false, filled: ['香遠「益」清'] }).correct, true,
    '整句照打也應算對');
  assert.strictEqual(Q.check(unit, { isCorrect: false, filled: ['易'] }).correct, false,
    '填錯字要算錯');
}

// 2. 資料本來就只寫正解字的，行為不變
{
  const unit = { kind: 'judge', isCorrectAsIs: false, answers: ['怠'] };
  assert.strictEqual(Q.check(unit, { isCorrect: false, filled: ['怠'] }).correct, true);
  assert.strictEqual(Q.check(unit, { isCorrect: false, filled: ['殆'] }).correct, false);
}

// 3. 括號異體字兩種寫法都收
{
  const unit = { kind: 'judge', isCorrectAsIs: false, answers: ['洩（泄）'] };
  for (const v of ['洩', '泄', '洩（泄）']) {
    assert.strictEqual(Q.check(unit, { isCorrect: false, filled: [v] }).correct, true, `${v} 應算對`);
  }
  assert.strictEqual(Q.check(unit, { isCorrect: false, filled: ['瀉'] }).correct, false);
}

// 4. 疊字（蒼蒼、鼎鼎）抽出後仍是完整詞
{
  const unit = { kind: 'judge', isCorrectAsIs: false, answers: ['白髮「蒼蒼」'] };
  assert.strictEqual(Q.check(unit, { isCorrect: false, filled: ['蒼蒼'] }).correct, true);
  assert.strictEqual(Q.check(unit, { isCorrect: false, filled: ['蒼'] }).correct, false);
}

// 5. 前後空白容錯
{
  const unit = { kind: 'judge', isCorrectAsIs: false, answers: ['香遠「益」清'] };
  assert.strictEqual(Q.check(unit, { isCorrect: false, filled: [' 益 '] }).correct, true);
}

// 6. 選「完全正確」但其實有錯字 → 一律算錯（原行為保留）
{
  const unit = { kind: 'judge', isCorrectAsIs: false, answers: ['益'] };
  assert.strictEqual(Q.check(unit, { isCorrect: true }).correct, false);
}

// 7. 全庫掃描：每一題判斷題的官方答案，抽出核心後都必須是可作答的短字串，
//    否則學生在 maxlength=4 的框裡根本填不進去
{
  const items = JSON.parse(readFileSync('data/items.json', 'utf-8'));
  const bad = [];
  for (const it of items) {
    for (const p of it.parts || []) {
      if (p.mode !== 'judge' || p.isCorrectAsIs) continue;
      for (const raw of p.answers || []) {
        for (const a of String(raw).split('\n')) {
          if (!a.trim()) continue;
          const core = [...Q.acceptable(a)].filter((s) => s.length <= 4);
          if (!core.length) bad.push([it.id, a]);
        }
      }
    }
  }
  assert.deepStrictEqual(bad, [], `這些題的答案抽不出可填的字：${JSON.stringify(bad)}`);
}

console.log('quiz.test.mjs ✅ 全數通過');
