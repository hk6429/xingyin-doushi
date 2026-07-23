// Shared question rendering used by both practice mode (app.js) and battle mode
// (battle.js). Battle only wraps XYQuiz.check()'s result into damage -- it does
// not re-implement question rendering or scoring logic.
const XYQuestionUI = (() => {
  function sentenceHTML(sentence, targetLiteral, masked, occurrence) {
    if (!targetLiteral) return sentence;
    const shown = masked ? '＿＿' : targetLiteral;
    const needle = `「${targetLiteral}」`;
    const replacement = `「<span class="blank-target">${shown}</span>」`;
    // 一句話裡可能有兩處空格字面完全相同（如兩處都標「ㄋㄨㄥˊ」），
    // 一定要用 occurrence 指到「這一題問的那一格」，不能只換第一個 match。
    let idx = -1;
    let from = 0;
    for (let i = 0; i <= (occurrence || 0); i++) {
      idx = sentence.indexOf(needle, from);
      if (idx === -1) return sentence;
      from = idx + needle.length;
    }
    return sentence.slice(0, idx) + replacement + sentence.slice(idx + needle.length);
  }

  function html(unit) {
    if (unit.kind === 'mc-char') {
      const label = unit.mode === 'reading' ? '請選出讀音正確的字：' : '這句中標記的字，正確寫法是？';
      return `
        <div class="quiz-sentence">${sentenceHTML(unit.sentence, unit.target, unit.isCorrectAsIs, unit.targetOccurrence)}</div>
        <div class="qlabel">${label}</div>
        <div class="opt-grid" id="opt-grid">${unit.options.map((o, i) => `<button class="opt-btn" data-i="${i}">${kbdHint(i)}${o}</button>`).join('')}</div>
        <div id="feedback"></div>`;
    }
    if (unit.kind === 'mc-zhuyin') {
      return `
        <div class="quiz-sentence">${sentenceHTML(unit.sentence, unit.char, false, unit.targetOccurrence)}</div>
        <div class="qlabel">「${unit.char}」在這裡的正確注音是？</div>
        <div class="opt-grid" id="opt-grid">${unit.options.map((o, i) => `<button class="opt-btn" data-i="${i}">${kbdHint(i)}${o}</button>`).join('')}</div>
        <div id="feedback"></div>`;
    }
    if (unit.kind === 'judge') {
      return `
        <div class="quiz-sentence">${unit.sentence}</div>
        <div class="qlabel">這句用字完全正確嗎？</div>
        <div class="judge-row">
          <button class="judge-btn" data-v="true" data-i="0">${kbdHint(0)}完全正確</button>
          <button class="judge-btn" data-v="false" data-i="1">${kbdHint(1)}有錯字</button>
        </div>
        <div id="fill-area"></div>
        <div id="feedback"></div>`;
    }
    if (unit.kind === 'pick-correct') {
      return `
        <div class="qlabel">下列選項中，哪一個用字完全正確？</div>
        <div class="pick-list" id="pick-list">${unit.options.map((o, i) => `<button class="pick-option" data-i="${i}">${kbdHint(i)}${o.sentence}</button>`).join('')}</div>
        <div id="feedback"></div>`;
    }
    return '<p>未知題型</p>';
  }

  const KBD_LABELS = ['1 / ←', '2 / ↑', '3 / ↓', '4 / →'];
  function kbdHint(i) {
    return KBD_LABELS[i] ? `<span class="kbd-hint">${KBD_LABELS[i]}</span>` : '';
  }

  const KEY_TO_INDEX = {
    '1': 0, ArrowLeft: 0,
    '2': 1, ArrowUp: 1,
    '3': 2, ArrowDown: 2,
    '4': 3, ArrowRight: 3,
  };

  let activeKeyHandler = null;

  function teardown() {
    if (activeKeyHandler) {
      document.removeEventListener('keydown', activeKeyHandler);
      activeKeyHandler = null;
    }
  }

  function correctionText(unit) {
    if (unit.kind === 'mc-char' || unit.kind === 'mc-zhuyin') return `正解：${unit.correct}`;
    if (unit.kind === 'judge') {
      if (unit.isCorrectAsIs) return '這句本來就完全正確。';
      return `正確寫法：${unit.answers.join('、')}`;
    }
    if (unit.kind === 'pick-correct') return `正確選項：${unit.options[unit.correctIndex].sentence}`;
    return '';
  }

  function lockButtons(container) {
    if (!container) return;
    container.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  }

  // 對錯不能只靠顏色深淺分辨（色弱學生反映看不出差異），一律加勾叉文字符號。
  function markIcon(symbol) { return `<span class="mark-icon">${symbol}</span>`; }

  // render(container, unit, { onDone(result), showNextButton, onNext })
  function render(container, unit, opts) {
    const progressHTML = opts.progress
      ? `<div class="quiz-progress"><div class="quiz-progress-fill" style="width:${Math.round((opts.progress.idx / opts.progress.total) * 100)}%"></div></div>`
      : '';
    container.innerHTML = progressHTML + html(unit);
    const feedbackEl = () => container.querySelector('#feedback');

    teardown();
    activeKeyHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === ' ' || e.key === 'Spacebar') {
        const primary = container.querySelector('.next-btn, [data-action="submit-fill"]');
        if (primary) { e.preventDefault(); primary.click(); }
        return;
      }
      const idx = KEY_TO_INDEX[e.key];
      if (idx === undefined) return;
      const btn = container.querySelector(
        `.opt-btn[data-i="${idx}"], .judge-btn[data-i="${idx}"], .pick-option[data-i="${idx}"]`
      );
      if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
    };
    document.addEventListener('keydown', activeKeyHandler);

    function finish(result) {
      const fb = feedbackEl();
      const nextBtn = opts.showNextButton === false ? '' : '<button class="next-btn" data-action="next">下一題</button>';
      fb.innerHTML = `<div class="feedback-bar ${result.correct ? 'correct' : 'wrong'}">${result.correct ? '答對了！' : '答錯了，沒關係，看看正解再繼續'}　${correctionText(unit)}</div>${nextBtn}` +
        `<button class="report-btn" data-action="report-toggle">回報這題有問題</button>` +
        `<div class="report-form hidden">
          <textarea class="report-note" maxlength="200" placeholder="（選填）說說看哪裡怪怪的"></textarea>
          <button class="btn-secondary" data-action="report-submit">送出回報</button>
          <span class="report-status"></span>
        </div>`;
      let advanced = false;
      const doNext = () => {
        if (advanced) return;
        advanced = true;
        opts.onNext && opts.onNext();
      };
      const nb = fb.querySelector('[data-action="next"]');
      if (nb) nb.addEventListener('click', doNext);
      const toggleBtn = fb.querySelector('[data-action="report-toggle"]');
      const reportForm = fb.querySelector('.report-form');
      toggleBtn.addEventListener('click', () => reportForm.classList.toggle('hidden'));
      const submitBtn = fb.querySelector('[data-action="report-submit"]');
      submitBtn.addEventListener('click', () => {
        const note = fb.querySelector('.report-note').value.trim();
        const statusEl = fb.querySelector('.report-status');
        submitBtn.disabled = true;
        XYReport.send(unit, note).then(() => {
          statusEl.textContent = '已回報，謝謝你！';
        }).catch(() => {
          statusEl.textContent = '回報失敗，請稍後再試';
          submitBtn.disabled = false;
        });
      });
      // 答對／答錯都自動前進（答錯多留一點時間看正解），不用逼學生每次答錯都多按一次。
      if (opts.showNextButton !== false) setTimeout(doNext, result.correct ? 900 : 1800);
      fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      opts.onDone(result);
    }

    if (unit.kind === 'mc-char' || unit.kind === 'mc-zhuyin') {
      container.querySelectorAll('.opt-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const chosen = unit.options[Number(btn.dataset.i)];
          const result = XYQuiz.check(unit, chosen);
          lockButtons(container.querySelector('#opt-grid'));
          container.querySelectorAll('.opt-btn').forEach((b) => {
            if (unit.options[Number(b.dataset.i)] === unit.correct) { b.classList.add('correct'); b.insertAdjacentHTML('afterbegin', markIcon('✓')); }
            else if (b === btn) { b.classList.add('wrong'); b.insertAdjacentHTML('afterbegin', markIcon('✗')); }
          });
          finish(result);
        });
      });
    } else if (unit.kind === 'judge') {
      const markJudge = (chosenBtn, correctFlag) => {
        const correctV = unit.isCorrectAsIs ? 'true' : 'false';
        container.querySelectorAll('.judge-btn').forEach((b) => {
          b.disabled = true;
          if (b.dataset.v === correctV) { b.classList.add('correct'); b.insertAdjacentHTML('afterbegin', markIcon('✓')); }
          else if (b === chosenBtn && !correctFlag) { b.classList.add('wrong'); b.insertAdjacentHTML('afterbegin', markIcon('✗')); }
        });
      };
      container.querySelectorAll('.judge-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const isCorrectChoice = btn.dataset.v === 'true';
          if (!unit.isCorrectAsIs && isCorrectChoice) {
            markJudge(btn, false);
            finish({ correct: false });
            return;
          }
          if (unit.isCorrectAsIs) {
            markJudge(btn, isCorrectChoice);
            finish(XYQuiz.check(unit, { isCorrect: isCorrectChoice }));
            return;
          }
          markJudge(btn, true);
          const n = unit.answers.length;
          const fillArea = container.querySelector('#fill-area');
          fillArea.innerHTML = `<div class="fill-row">${Array.from({ length: n }, (_, i) => `<input class="fill-input" maxlength="4" data-i="${i}">`).join('')}</div><button class="next-btn" data-action="submit-fill">確認送出</button>`;
          fillArea.querySelector('[data-action="submit-fill"]').addEventListener('click', () => {
            const filled = Array.from(fillArea.querySelectorAll('.fill-input')).map((inp) => inp.value.trim());
            fillArea.querySelectorAll('input,button').forEach((el) => { el.disabled = true; });
            finish(XYQuiz.check(unit, { isCorrect: false, filled }));
          });
        });
      });
    } else if (unit.kind === 'pick-correct') {
      container.querySelectorAll('.pick-option').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.i);
          const result = XYQuiz.check(unit, i);
          lockButtons(container.querySelector('#pick-list'));
          container.querySelectorAll('.pick-option').forEach((b) => {
            if (Number(b.dataset.i) === unit.correctIndex) { b.classList.add('correct'); b.insertAdjacentHTML('afterbegin', markIcon('✓')); }
            else if (b === btn) { b.classList.add('wrong'); b.insertAdjacentHTML('afterbegin', markIcon('✗')); }
          });
          finish(result);
        });
      });
    }
  }

  return { render, teardown };
})();
