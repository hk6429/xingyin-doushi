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

console.log('store.test.mjs: all assertions passed');
