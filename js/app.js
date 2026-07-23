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
    $('#due-count').textContent = `目前 ${XYStore.reviewDueUnitIds().length} 題到期`;
    renderDaily();
    renderStreak();
    renderSummary();
  }

  function renderSummary() {
    const s = XYStore.summaryStats();
    $('#summary-card').textContent = s.totalChars
      ? `已接觸 ${s.totalChars} 字（精通 ${s.masteredChars} 字）・已練習 ${s.practiced} 題（精通 ${s.masteredUnits} 題）`
      : '';
  }

  function renderStreak() {
    const s = XYStore.getStreak();
    $('#streak-badge').textContent = s.current > 0 ? `🔥 連續練習 ${s.current} 天` : '';
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

  function getLevelFilter() { return localStorage.getItem('xyd_level_filter') || ''; }
  function getRoundSize() { return Number(localStorage.getItem('xyd_round_size')) || ROUND_SIZE; }

  // 錯題本／到期複習看的是「你自己過去答錯/該複習的題目」，範圍篩選只影響
  // 出全新題的三種練習模式，不影響這兩種個人化複習模式。
  function poolForMode(mode) {
    const level = getLevelFilter() || undefined;
    if (mode.startsWith('char:')) return XYData.unitsForChar(mode.slice(5));
    if (mode === 'xingxing') return XYData.filterUnits({ type: 'xingxing', level });
    if (mode === 'yinyin') return XYData.filterUnits({ type: 'yinyin', level });
    if (mode === 'mix') return XYData.filterUnits({ level });
    if (mode === 'wrongbook') {
      const ids = new Set(XYStore.wrongBookUnitIds());
      return XYData.all().filter((u) => ids.has(u.id));
    }
    if (mode === 'due') {
      const ids = new Set(XYStore.reviewDueUnitIds());
      return XYData.all().filter((u) => ids.has(u.id));
    }
    return XYData.all();
  }

  function startRound(mode) {
    const pool = poolForMode(mode);
    if (!pool.length) {
      if (mode === 'wrongbook') alert('目前沒有錯題，太厲害了！');
      else if (mode === 'due') alert('目前沒有到期的複習題，明天再來看看！');
      else alert('題庫載入中，請稍後再試。');
      return;
    }
    const size = mode.startsWith('char:') ? pool.length : Math.min(getRoundSize(), pool.length);
    session = { units: XYQuiz.drawUnits(pool, size), idx: 0, score: 0, mode };
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

  function initOnboarding() {
    if (!localStorage.getItem('xyd_onboarding_seen')) {
      $('#onboarding-banner').classList.remove('hidden');
    }
    $('[data-action="onboarding-dismiss"]').addEventListener('click', () => {
      localStorage.setItem('xyd_onboarding_seen', '1');
      $('#onboarding-banner').classList.add('hidden');
    });
  }

  function initFontToggle() {
    const KEY = 'xyd_font_large';
    const apply = () => document.body.classList.toggle('font-large', localStorage.getItem(KEY) === '1');
    apply();
    $('[data-action="font-toggle"]').addEventListener('click', () => {
      localStorage.setItem(KEY, localStorage.getItem(KEY) === '1' ? '0' : '1');
      apply();
    });
  }

  function initLevelFilter() {
    const sel = $('#level-filter');
    sel.value = getLevelFilter();
    sel.addEventListener('change', () => localStorage.setItem('xyd_level_filter', sel.value));
  }

  function initRoundSize() {
    const sel = $('#round-size');
    sel.value = String(getRoundSize());
    sel.addEventListener('change', () => localStorage.setItem('xyd_round_size', sel.value));
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
    initOnboarding();
    initFontToggle();
    initLevelFilter();
    initRoundSize();
    updateHome();
    show('#view-home');
  }

  return { init, show, $, poolForMode, startRound };
})();

document.addEventListener('DOMContentLoaded', XYApp.init);
