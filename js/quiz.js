// XYQuiz: generic quiz engine. Draws units, renders a question, scores answers.
// Battle mode calls XYQuiz.draw()/XYQuiz.check() directly; it never re-implements
// question logic, only wraps answer-correctness into damage (see battle.js).
const XYQuiz = (() => {
  function drawUnits(pool, n) {
    return XYData.shuffle(pool).slice(0, n);
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
          && filled.every((c, i) => c === unit.answers[i]);
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

  return { drawUnits, check, charsTaught };
})();
