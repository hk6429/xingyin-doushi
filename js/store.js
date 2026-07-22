const XYStore = (() => {
  const KEY_BOXES = 'xyd_boxes';
  const KEY_STATS = 'xyd_charstats';
  const KEY_WRONG = 'xyd_wrongbook';
  const KEY_BATTLE = 'xyd_battle';

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
  function getBattle() { return readJSON(KEY_BATTLE, { wins: 0, unlocked: 1 }); }
  function saveBattle(b) { writeJSON(KEY_BATTLE, b); }

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
      const needStreak = rec.everWrong ? 2 : 1;
      stats[ch].units[unitId] = correctFlag && rec.streak >= needStreak;
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
    });
  }
  function importProgress(json) {
    const d = JSON.parse(json);
    if (d.boxes) writeJSON(KEY_BOXES, d.boxes);
    if (d.stats) writeJSON(KEY_STATS, d.stats);
    if (d.wrong) writeJSON(KEY_WRONG, d.wrong);
    if (d.battle) writeJSON(KEY_BATTLE, d.battle);
  }

  return {
    recordAnswer, isMastered, charMastery, dueUnits, wrongBookUnitIds,
    getBattle, saveBattle, exportProgress, importProgress,
  };
})();
