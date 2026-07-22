// XYQuiz: generic quiz engine. Draws units, renders a question, scores answers.
// Battle mode calls XYQuiz.draw()/XYQuiz.check() directly; it never re-implements
// question logic, only wraps answer-correctness into damage (see battle.js).
const XYQuiz = (() => {
  function drawUnits(pool, n) {
    return XYData.shuffle(pool).slice(0, n);
  }

  // 判斷題填空的「可接受答案」。原始資料寫法不統一，同一個欄位可能是：
  //   「益」          → 只有正解字
  //   香遠「益」清     → 整句訂正，正解在「」裡
  //   洩（泄）／（投）  → 括號內是可接受的異體字
  // 作答框只讓學生填字（maxlength=4），所以一律抽出「」內的核心，
  // 並把括號異體一起收進可接受集合；整串原文也保留（有人真的會整句打）。
  function acceptable(answer) {
    const raw = String(answer).trim();
    const m = raw.match(/「(.+?)」/);
    const core = (m ? m[1] : raw).trim();
    const out = new Set([core, raw]);
    const paren = core.match(/^(.*?)（(.+?)）$/);
    if (paren) {
      if (paren[1]) out.add(paren[1].trim());
      out.add(paren[2].trim());
    }
    out.delete('');
    return out;
  }

  // Returns { correct: bool, detail } given a unit and the user's raw answer.
  // For mc-char / mc-zhuyin: userAnswer is the chosen option string.
  // For judge: userAnswer is { isCorrect: bool, filled: [chars...] }.
  // For pick-correct: userAnswer is the chosen option index.
  function check(unit, userAnswer) {
    switch (unit.kind) {
      case 'mc-char':
      case 'mc-zhuyin':
        return { correct: userAnswer === unit.correct };
      case 'judge': {
        if (unit.isCorrectAsIs) {
          return { correct: userAnswer.isCorrect === true };
        }
        if (userAnswer.isCorrect !== false) return { correct: false };
        const filled = userAnswer.filled || [];
        const ok = filled.length === unit.answers.length
          && filled.every((c, i) => acceptable(unit.answers[i]).has(String(c).trim()));
        return { correct: ok };
      }
      case 'pick-correct':
        return { correct: userAnswer === unit.correctIndex };
      default:
        return { correct: false };
    }
  }

  function charsTaught(unit) {
    if (unit.kind === 'mc-char') return [unit.correct];
    if (unit.kind === 'mc-zhuyin') return [unit.char];
    return [];
  }

  return { drawUnits, check, charsTaught, acceptable };
})();
