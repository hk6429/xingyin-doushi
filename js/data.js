const XYData = (() => {
  let items = [];
  let units = [];
  let charIndex = new Map(); // char -> [unitId, ...]

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function splitAnswers(answers) {
    return (answers || [])
      .flatMap((a) => String(a).split('\n'))
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function addCharIndex(char, unitId) {
    if (!char) return;
    if (!charIndex.has(char)) charIndex.set(char, []);
    charIndex.get(char).push(unitId);
  }

  function buildUnits() {
    units = [];
    charIndex = new Map();
    for (const it of items) {
      const meta = { itemId: it.id, examTag: it.examTag, level: it.level, year: it.year, type: it.type };
      if (it.type === 'xingxing') {
        if (it.groupMode === 'pickCorrect') {
          const options = it.parts.map((p) => ({
            sentence: p.sentence,
            isCorrectAsIs: p.isCorrectAsIs,
            answers: splitAnswers(p.answers),
          }));
          const correctIndex = options.findIndex((o) => o.isCorrectAsIs);
          const unitId = `${it.id}#pick`;
          units.push({
            id: unitId, kind: 'pick-correct', meta, options, correctIndex,
          });
          continue;
        }
        it.parts.forEach((p, pi) => {
          const unitId = `${it.id}#${pi}`;
          if (p.mode === 'judge') {
            units.push({
              id: unitId, kind: 'judge', meta,
              sentence: p.sentence, isCorrectAsIs: p.isCorrectAsIs,
              // 原始資料偶爾把兩處訂正塞進同一個字串（以換行分隔），
              // 拆開才會一處一個作答框。
              answers: splitAnswers(p.answers),
            });
          } else {
            // char or reading: multiple-choice pick the right character
            const correct = p.correct || p.target;
            const opts = shuffle([correct, ...(p.distractors || [])]);
            units.push({
              id: unitId, kind: 'mc-char', meta,
              sentence: p.sentence, target: p.target, mode: p.mode,
              isCorrectAsIs: !!p.isCorrectAsIs,
              correct, options: opts,
            });
            addCharIndex(correct, unitId);
          }
        });
      } else {
        it.parts.forEach((p, pi) => {
          const unitId = `${it.id}#${pi}`;
          const opts = shuffle([p.correctZhuyin, ...(p.zhuyinDistractors || [])]);
          units.push({
            id: unitId, kind: 'mc-zhuyin', meta,
            sentence: p.sentence, char: p.target,
            correct: p.correctZhuyin, options: opts,
          });
          addCharIndex(p.target, unitId);
        });
      }
    }
  }

  async function load() {
    const res = await fetch('data/items.json?v=202607230100');
    items = await res.json();
    buildUnits();
    return units;
  }

  function all() { return units; }
  function byId(id) { return units.find((u) => u.id === id); }
  function chars() { return Array.from(charIndex.keys()); }
  function unitsForChar(ch) { return (charIndex.get(ch) || []).map(byId).filter(Boolean); }
  function filterUnits({ type, level } = {}) {
    return units.filter((u) => {
      if (type && u.meta.type !== type) return false;
      if (level && u.meta.level !== level) return false;
      return true;
    });
  }

  return { load, all, byId, chars, unitsForChar, filterUnits, shuffle };
})();
