const XYApp = (() => {
  const ROUND_SIZE = 10;
  let session = { units: [], idx: 0, score: 0, mode: null };

  function $(sel) { return document.querySelector(sel); }
  function show(id) {
    document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
    $(id).classList.remove('hidden');
    if (id !== '#view-quiz' && id !== '#view-battle') XYQuestionUI.teardown();
  }

  function updateHome() {
    $('#wrongbook-count').textContent = `目前 ${XYStore.wrongBookUnitIds().length} 題待複習`;
    renderDaily();
  }

  function renderDaily() {
    const { prog } = XYStore.getDaily();
    const GOALS = { correct: 10, mastered: 3 };
    const row = (icon, label, key) => {
      const val = Math.min(prog[key], GOALS[key]);
      const done = val >= GOALS[key];
      const pct = Math.round((val / GOALS[key]) * 100);
      return `<div class="quest-row ${done ? 'done' : ''}">
        <span class="quest-icon">${done ? '✓' : icon}</span>
        <div class="quest-body">
          <div class="quest-label">${label}</div>
          <div class="quest-track"><div class="quest-fill" style="width:${pct}%"></div></div>
        </div>
        <span class="quest-count">${val}/${GOALS[key]}</span>
      </div>`;
    };
    $('#daily-quest-panel').innerHTML = row('答', '今日答對', 'correct') + row('精', '今日新精通', 'mastered');
  }

  function poolForMode(mode) {
    if (mode === 'xingxing') return XYData.filterUnits({ type: 'xingxing' });
    if (mode === 'yinyin') return XYData.filterUnits({ type: 'yinyin' });
    if (mode === 'wrongbook') {
      const ids = new Set(XYStore.wrongBookUnitIds());
      return XYData.all().filter((u) => ids.has(u.id));
    }
    return XYData.all();
  }

  function startRound(mode) {
    const pool = poolForMode(mode);
    if (!pool.length) {
      alert(mode === 'wrongbook' ? '目前沒有錯題，太厲害了！' : '題庫載入中，請稍後再試。');
      return;
    }
    session = { units: XYQuiz.drawUnits(pool, Math.min(ROUND_SIZE, pool.length)), idx: 0, score: 0, mode };
    show('#view-quiz');
    renderQuestion();
  }

  function renderQuestion() {
    const unit = session.units[session.idx];
    $('#quiz-index').textContent = session.idx + 1;
    $('#quiz-total').textContent = session.units.length;
    $('#quiz-score').textContent = session.score;
    XYQuestionUI.render($('#quiz-card'), unit, {
      onDone: (result) => onAnswered(unit, result),
      onNext: advance,
      progress: { idx: session.idx + 1, total: session.units.length },
    });
  }

  function onAnswered(unit, result) {
    XYStore.recordAnswer(unit.id, result.correct, XYQuiz.charsTaught(unit));
    if (result.correct) session.score += 1;
  }

  function advance() {
    session.idx += 1;
    if (session.idx >= session.units.length) finishRound();
    else renderQuestion();
  }

  function finishRound() {
    $('#result-summary').textContent = `本回合共 ${session.units.length} 題，答對 ${session.score} 題。`;
    show('#view-result');
    updateHome();
  }

  function initNav() {
    document.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode === 'battle') { show('#view-battle'); XYBattle.showRoster(); return; }
        if (mode === 'dex') { show('#view-dex'); XYDex.render(); return; }
        startRound(mode);
      });
    });
    document.querySelectorAll('[data-action="home"]').forEach((btn) => {
      btn.addEventListener('click', () => { show('#view-home'); updateHome(); });
    });
    document.querySelectorAll('[data-action="retry"]').forEach((btn) => {
      btn.addEventListener('click', () => startRound(session.mode));
    });
    document.querySelector('[data-action="backup-open"]').addEventListener('click', () => {
      show('#view-backup');
      XYBackup.render();
    });
    XYBackup.initNav();
  }

  async function init() {
    await XYData.load();
    XYStore.rollDaily();
    initNav();
    updateHome();
    show('#view-home');
  }

  return { init, show, $, poolForMode };
})();

document.addEventListener('DOMContentLoaded', XYApp.init);
