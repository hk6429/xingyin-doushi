const XYStore = (() => {
  const KEY_BOXES = 'xyd_boxes';
  const KEY_STATS = 'xyd_charstats';
  const KEY_WRONG = 'xyd_wrongbook';
  const KEY_BATTLE = 'xyd_battle';
  const KEY_DAILY = 'xyd_daily';
  const KEY_STREAK = 'xyd_streak';

  const BOX_INTERVALS_MS = [0, 1, 3, 7, 14, 30].map((d) => d * 24 * 3600 * 1000);
  const MAX_BOX = BOX_INTERVALS_MS.length - 1;

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function writeJSON(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function getBoxes() { return readJSON(KEY_BOXES, {}); }
  function getCharStats() { return readJSON(KEY_STATS, {}); }
  function getWrongBook() { return readJSON(KEY_WRONG, {}); }
  function getBattle() {
    return { wins: 0, unlocked: 1, hardWins: 0, hardUnlocked: 0, ...readJSON(KEY_BATTLE, {}) };
  }
  function saveBattle(b) { writeJSON(KEY_BATTLE, b); }

  function today() { return new Date().toLocaleDateString('sv-SE'); }
  function yesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('sv-SE');
  }

  // 連續練習天數：只在「當天至少答對一題」時才累加，斷一天就歸零，
  // 純顯示用，不發任何獎勵。
  function getStreak() { return readJSON(KEY_STREAK, { date: null, current: 0, best: 0 }); }
  function bumpStreak() {
    const s = getStreak();
    const t = today();
    if (s.date === t) return s;
    s.current = s.date === yesterday() ? s.current + 1 : 1;
    s.date = t;
    s.best = Math.max(s.best || 0, s.current);
    writeJSON(KEY_STREAK, s);
    return s;
  }

  // SRS 到期複習：只看「已經練過」的題目（boxes 裡有紀錄），到期就列入。
  function reviewDueUnitIds() {
    const boxes = getBoxes();
    const now = Date.now();
    return Object.keys(boxes).filter((id) => boxes[id].due <= now);
  }

  // 每日任務：純打勾進度，不發任何虛擬貨幣/經驗值，只反映今天真的答對/精通了幾個。
  function rollDaily() {
    const d = readJSON(KEY_DAILY, null);
    if (d && d.date === today()) return d;
    const fresh = { date: today(), prog: { correct: 0, mastered: 0 } };
    writeJSON(KEY_DAILY, fresh);
    return fresh;
  }
  function getDaily() { return rollDaily(); }
  function bumpDaily(field) {
    const d = rollDaily();
    d.prog[field] = (d.prog[field] || 0) + 1;
    writeJSON(KEY_DAILY, d);
  }

  // record answering a unit. `chars` = array of characters this unit teaches
  // (for dex mastery); `correct` = whether answered correctly.
  function recordAnswer(unitId, correctFlag, chars = []) {
    const boxes = getBoxes();
    const rec = boxes[unitId] || { box: 0, streak: 0, everWrong: false, due: 0 };
    if (correctFlag) {
      rec.streak = (rec.streak || 0) + 1;
      rec.box = Math.min(MAX_BOX, rec.box + 1);
    } else {
      rec.streak = 0;
      rec.everWrong = true;
      rec.box = 0;
    }
    rec.due = Date.now() + BOX_INTERVALS_MS[rec.box];
    boxes[unitId] = rec;
    writeJSON(KEY_BOXES, boxes);

    if (correctFlag) { bumpDaily('correct'); bumpStreak(); }

    // wrong book: needs 2 consecutive correct to clear once it has ever been wrong
    const wb = getWrongBook();
    if (!correctFlag) {
      wb[unitId] = { wrongCount: (wb[unitId]?.wrongCount || 0) + 1, lastTs: Date.now(), clearStreak: 0 };
    } else if (wb[unitId]) {
      wb[unitId].clearStreak = (wb[unitId].clearStreak || 0) + 1;
      if (wb[unitId].clearStreak >= 2) delete wb[unitId];
    }
    writeJSON(KEY_WRONG, wb);

    // char stats for dex: mastered flag per unit = correct AND (streak>=2 if everWrong else streak>=1)
    const stats = getCharStats();
    for (const ch of chars) {
      if (!stats[ch]) stats[ch] = { units: {} };
      const wasMastered = !!stats[ch].units[unitId];
      const needStreak = rec.everWrong ? 2 : 1;
      const nowMastered = correctFlag && rec.streak >= needStreak;
      stats[ch].units[unitId] = nowMastered;
      if (nowMastered && !wasMastered) bumpDaily('mastered');
    }
    writeJSON(KEY_STATS, stats);

    return rec;
  }

  function isMastered(unitId) {
    const boxes = getBoxes();
    const rec = boxes[unitId];
    if (!rec) return false;
    const needStreak = rec.everWrong ? 2 : 1;
    return rec.streak >= needStreak;
  }

  function charMastery(ch) {
    const stats = getCharStats();
    const s = stats[ch];
    if (!s) return { total: 0, mastered: 0, ratio: 0 };
    const ids = Object.keys(s.units);
    const mastered = ids.filter((id) => s.units[id]).length;
    return { total: ids.length, mastered, ratio: ids.length ? mastered / ids.length : 0 };
  }

  function dueUnits(unitIds) {
    const boxes = getBoxes();
    const now = Date.now();
    return unitIds.filter((id) => {
      const rec = boxes[id];
      return !rec || rec.due <= now;
    });
  }

  function wrongBookUnitIds() {
    return Object.keys(getWrongBook());
  }

  function exportProgress() {
    return JSON.stringify({
      boxes: getBoxes(), stats: getCharStats(), wrong: getWrongBook(), battle: getBattle(),
      daily: readJSON(KEY_DAILY, null),
      streak: getStreak(),
    });
  }
  function importProgress(json) {
    const d = JSON.parse(json);
    if (d.boxes) writeJSON(KEY_BOXES, d.boxes);
    if (d.stats) writeJSON(KEY_STATS, d.stats);
    if (d.wrong) writeJSON(KEY_WRONG, d.wrong);
    if (d.battle) writeJSON(KEY_BATTLE, d.battle);
    if (d.daily) writeJSON(KEY_DAILY, d.daily);
    if (d.streak) writeJSON(KEY_STREAK, d.streak);
  }

  return {
    recordAnswer, isMastered, charMastery, dueUnits, wrongBookUnitIds,
    getBattle, saveBattle, exportProgress, importProgress,
    rollDaily, getDaily, getStreak, reviewDueUnitIds,
  };
})();
