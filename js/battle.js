// PvE 對戰引擎：純粹是 XYQuiz 出題結果 -> 傷害計算的薄包裝層，
// 不重新設計出題邏輯（沿用 XYQuestionUI 的題目渲染）。
const XYBattle = (() => {
  const MAX_HP = 100;
  const ROSTER = [
    { name: '代理老師', atk: 6 },
    { name: '段考出題委員', atk: 8 },
    { name: '基測命題老師', atk: 10 },
    { name: '會考命題老師', atk: 12 },
    { name: '國文科輔導員', atk: 14 },
    { name: '國編館審定委員', atk: 16 },
    { name: '歷屆狀元教練', atk: 19 },
    { name: '字形字音總召', atk: 24 },
  ];

  let state = null;

  function $(sel) { return document.querySelector(sel); }

  function showRoster() {
    const battleData = XYStore.getBattle();
    const grid = $('#battle-roster');
    $('#battle-title').textContent = '';
    $('#battle-card').innerHTML = '<p class="paper-note">選擇一位考官挑戰，答對出招、連擊加成傷害。</p>';
    grid.innerHTML = ROSTER.map((r, i) => {
      const locked = i >= battleData.unlocked;
      const cleared = i < battleData.wins;
      return `<button class="roster-item ${locked ? 'locked' : ''} ${cleared ? 'cleared' : ''}" data-i="${i}" ${locked ? 'disabled' : ''}>${r.name}</button>`;
    }).join('');
    grid.querySelectorAll('.roster-item:not(.locked)').forEach((btn) => {
      btn.addEventListener('click', () => startBattle(Number(btn.dataset.i)));
    });
  }

  function startBattle(idx) {
    const opp = ROSTER[idx];
    state = { idx, opp, hpPlayer: MAX_HP, hpEnemy: MAX_HP, combo: 0 };
    $('#battle-roster').innerHTML = '';
    $('#battle-title').textContent = `對戰中：${opp.name}`;
    $('#hp-enemy-name').textContent = opp.name;
    updateHpBars();
    nextQuestion();
  }

  function updateHpBars() {
    $('#hp-player').style.width = `${Math.max(0, state.hpPlayer)}%`;
    $('#hp-enemy').style.width = `${Math.max(0, state.hpEnemy)}%`;
    $('#combo-count').textContent = state.combo;
  }

  function nextQuestion() {
    const pool = XYApp.poolForMode('mix');
    const [unit] = XYQuiz.drawUnits(pool, 1);
    XYQuestionUI.render($('#battle-card'), unit, {
      onDone: (result) => onBattleAnswer(unit, result),
      onNext: nextQuestion,
      showNextButton: false,
    });
  }

  function onBattleAnswer(unit, result) {
    XYStore.recordAnswer(unit.id, result.correct, XYQuiz.charsTaught(unit));
    if (result.correct) {
      state.combo += 1;
      const dmg = 8 + state.combo * 3 + (state.hpPlayer < 30 ? 10 : 0);
      state.hpEnemy -= dmg;
    } else {
      state.combo = 0;
      state.hpPlayer -= state.opp.atk;
    }
    updateHpBars();
    setTimeout(() => {
      if (state.hpEnemy <= 0) return onWin();
      if (state.hpPlayer <= 0) return onLose();
      nextQuestion();
    }, 900);
  }

  function onWin() {
    const battleData = XYStore.getBattle();
    if (state.idx === battleData.wins) battleData.wins += 1;
    battleData.unlocked = Math.max(battleData.unlocked, battleData.wins + 1);
    XYStore.saveBattle(battleData);
    $('#battle-card').innerHTML = `<div class="result-card"><h2>擊敗 ${state.opp.name}！</h2><button class="btn-primary" data-action="battle-again">回考官列表</button></div>`;
    $('#battle-card').querySelector('[data-action="battle-again"]').addEventListener('click', showRoster);
  }

  function onLose() {
    $('#battle-card').innerHTML = `<div class="result-card"><h2>被 ${state.opp.name} 考倒了……</h2><button class="btn-primary" data-action="battle-again">再挑戰一次</button></div>`;
    $('#battle-card').querySelector('[data-action="battle-again"]').addEventListener('click', showRoster);
  }

  return { showRoster };
})();
