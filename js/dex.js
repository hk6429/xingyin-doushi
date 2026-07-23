// 錯字通緝令圖鑑：每個目標字是一張收藏卡。
// 精通度 = 已答對(且達成 streak 門檻)的題目數 / 該字總關聯題數。
// 門檻沿用 XYStore：曾經答錯過的題目需連續兩次答對才算精通，形成
// 「答錯過的題目權重更高」的效果（見 vocab-game-pipeline 的字字珠璣公式）。
const XYDex = (() => {
  function tier(ratio) {
    if (ratio >= 1) return 'gold';
    if (ratio >= 0.5) return 'silver';
    if (ratio > 0) return 'bronze';
    return 'locked';
  }

  // 只在「差 1~3 題就能升階」時顯示提示，避免每張卡都掛數字造成視覺雜訊。
  function nextTierHint(m, t) {
    if (t === 'gold' || !m.total) return '';
    const neededMastered = t === 'locked' ? 1 : t === 'bronze' ? Math.ceil(m.total * 0.5) : m.total;
    const diff = neededMastered - m.mastered;
    return diff > 0 && diff <= 3 ? `<span class="dex-hint">差${diff}</span>` : '';
  }

  function render() {
    const grid = document.getElementById('dex-grid');
    const chars = XYData.chars();
    const cards = chars.map((ch) => {
      const m = XYStore.charMastery(ch);
      const t = tier(m.ratio);
      const label = t === 'locked' ? '？' : ch;
      const pct = Math.round(m.ratio * 100);
      return `<div class="dex-card ${t}" title="${ch}：${m.mastered}/${m.total} 精通（${pct}%）">${label}${nextTierHint(m, t)}</div>`;
    });
    const goldCount = chars.filter((ch) => tier(XYStore.charMastery(ch).ratio) === 'gold').length;
    grid.innerHTML = `<p class="paper-note">已收藏 ${chars.length} 字，其中 ${goldCount} 字達到「精通」。</p>` + cards.join('');
  }

  return { render };
})();
