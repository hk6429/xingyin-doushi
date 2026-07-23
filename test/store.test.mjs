import assert from 'node:assert';
import { readFileSync } from 'node:fs';

function makeLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function loadStore() {
  const code = readFileSync('js/store.js', 'utf-8');
  // run in the same realm (no vm context) so returned Arrays/Objects are
  // real Node Array/Object instances -- vm.createContext creates a separate
  // realm whose Array is a *different* constructor, which breaks deepStrictEqual.
  const factory = new Function('localStorage', `${code}\nreturn XYStore;`);
  return factory(makeLocalStorage());
}

// 1. first-time correct answer masters immediately (streak needed = 1)
{
  const S = loadStore();
  S.recordAnswer('u1', true, ['驅']);
  assert.strictEqual(S.isMastered('u1'), true, 'first-try correct should master immediately');
  const m = S.charMastery('驅');
  assert.strictEqual(m.mastered, 1);
  assert.strictEqual(m.total, 1);
}

// 2. once wrong, needs 2 consecutive correct answers to master (1.5x-weight equivalent)
{
  const S = loadStore();
  S.recordAnswer('u2', false, ['驅']);
  assert.strictEqual(S.isMastered('u2'), false);
  S.recordAnswer('u2', true, ['驅']);
  assert.strictEqual(S.isMastered('u2'), false, 'one correct after a wrong should not master yet');
  S.recordAnswer('u2', true, ['驅']);
  assert.strictEqual(S.isMastered('u2'), true, 'two consecutive corrects after a wrong should master');
}

// 3. wrongbook: entry created on wrong, cleared after 2 consecutive corrects
{
  const S = loadStore();
  S.recordAnswer('u3', false, []);
  assert.deepStrictEqual(S.wrongBookUnitIds(), ['u3']);
  S.recordAnswer('u3', true, []);
  assert.deepStrictEqual(S.wrongBookUnitIds(), ['u3'], 'should still be in wrongbook after only 1 correct');
  S.recordAnswer('u3', true, []);
  assert.deepStrictEqual(S.wrongBookUnitIds(), [], 'should clear from wrongbook after 2 consecutive corrects');
}

// 4. a fresh wrong answer after being cleared re-enters the wrongbook
{
  const S = loadStore();
  S.recordAnswer('u4', true, []); // mastered immediately, never wrong
  assert.deepStrictEqual(S.wrongBookUnitIds(), []);
  S.recordAnswer('u4', false, []);
  assert.deepStrictEqual(S.wrongBookUnitIds(), ['u4']);
}

// 5. charMastery ratio across multiple units sharing a character
{
  const S = loadStore();
  S.recordAnswer('a', true, ['字']);
  S.recordAnswer('b', true, ['字']);
  S.recordAnswer('c', false, ['字']);
  let m = S.charMastery('字');
  assert.strictEqual(m.total, 3);
  assert.strictEqual(m.mastered, 2);
  assert.ok(Math.abs(m.ratio - 2 / 3) < 1e-9);
}

// 6. daily quest progress: correct answers and newly-mastered chars bump today's counters
{
  const S = loadStore();
  S.recordAnswer('d1', true, ['驅']);
  S.recordAnswer('d2', false, []);
  const daily = S.getDaily();
  assert.strictEqual(daily.prog.correct, 1, 'only the correct answer should bump prog.correct');
  assert.strictEqual(daily.prog.mastered, 1, 'newly-mastered char should bump prog.mastered once');
  S.recordAnswer('d1', true, ['驅']); // already mastered -- should not double-count
  assert.strictEqual(S.getDaily().prog.mastered, 1, 're-mastering the same unit should not bump again');
}

// 7. export/import round-trips boxes/stats/wrong/battle/daily through a fresh store instance
{
  const S1 = loadStore();
  S1.recordAnswer('e1', true, ['字']);
  S1.recordAnswer('e2', false, []);
  S1.saveBattle({ wins: 3, unlocked: 4 });
  const dump = S1.exportProgress();

  const S2 = loadStore();
  S2.importProgress(dump);
  assert.strictEqual(S2.isMastered('e1'), true, 'imported mastery should match source');
  assert.deepStrictEqual(S2.wrongBookUnitIds(), ['e2'], 'imported wrongbook should match source');
  assert.deepStrictEqual(S2.getBattle(), { wins: 3, unlocked: 4, hardWins: 0, hardUnlocked: 0 }, 'imported battle progress should match source');
  assert.strictEqual(S2.getDaily().prog.correct, 1, 'imported daily quest progress should match source');
}

// 8. getBattle() backfills hard-mode fields for old saves that predate them
{
  const S = loadStore();
  S.saveBattle({ wins: 2, unlocked: 3 });
  assert.deepStrictEqual(S.getBattle(), { wins: 2, unlocked: 3, hardWins: 0, hardUnlocked: 0 });
}

// 9. streak: only bumps once per day, breaks on a skipped day
{
  const S = loadStore();
  assert.strictEqual(S.getStreak().current, 0);
  S.recordAnswer('s1', true, []);
  assert.strictEqual(S.getStreak().current, 1, 'first correct answer of the day starts streak at 1');
  S.recordAnswer('s2', true, []);
  assert.strictEqual(S.getStreak().current, 1, 'second correct answer same day should not double-count');
  S.recordAnswer('s3', false, []);
  assert.strictEqual(S.getStreak().current, 1, 'a wrong answer should not affect streak');
}

// 10. reviewDueUnitIds: a wrong answer resets box to 0 (0ms interval) so it's
// immediately due again; a correct first-try answer advances to box 1 (1 day
// interval) so it is NOT due yet. Only practiced units (present in boxes) count.
{
  const S = loadStore();
  S.recordAnswer('r1', true, ['字']);
  assert.deepStrictEqual(S.reviewDueUnitIds(), [], 'first-try correct advances past the due-now box');
  S.recordAnswer('r2', false, []);
  assert.deepStrictEqual(S.reviewDueUnitIds(), ['r2'], 'a wrong answer resets to the immediately-due box');
}

console.log('store.test.mjs: all assertions passed');
