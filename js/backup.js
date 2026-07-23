const XYBackup = (() => {
  function $(sel) { return document.querySelector(sel); }

  function render() {
    const json = XYStore.exportProgress();
    $('#backup-export').value = json;
    $('#backup-import').value = '';
  }

  function summaryText() {
    const s = XYStore.summaryStats();
    return [
      '【形音鬥士 練習戰績】',
      `已練習題目：${s.practiced} 題（已精通 ${s.masteredUnits} 題）`,
      `已接觸單字：${s.totalChars} 字（已精通 ${s.masteredChars} 字）`,
      `錯題本待複習：${s.wrongbook} 題`,
      `連續練習天數：${s.streak} 天`,
      `考官對戰：擊敗 ${s.battle.wins}/8 位（困難模式擊敗 ${s.battle.hardWins}/8 位）`,
    ].join('\n');
  }

  function download() {
    const blob = new Blob([XYStore.exportProgress()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xingyin-doushi-backup-${new Date().toLocaleDateString('sv-SE')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importFromText(json) {
    try {
      XYStore.importProgress(json);
      alert('已還原進度');
      render();
    } catch (e) {
      alert('還原失敗：檔案格式不正確');
    }
  }

  // 換裝置時同一台裝置重複上傳沿用同一組代碼，不用每次都產生新的、
  // 讓學生每次都要重新記一組。
  const CLOUD_CODE_KEY = 'xyd_cloud_code';

  function cloudUpload() {
    const statusEl = $('#cloud-status');
    const btn = $('[data-action="cloud-upload"]');
    btn.disabled = true;
    statusEl.textContent = '上傳中…';
    const code = localStorage.getItem(CLOUD_CODE_KEY) || undefined;
    fetch('/api/backup-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, data: XYStore.exportProgress() }),
    }).then((r) => r.json()).then((j) => {
      if (!j.ok) throw new Error('save failed');
      localStorage.setItem(CLOUD_CODE_KEY, j.code);
      const display = $('#cloud-code-display');
      display.textContent = `你的備份代碼：${j.code}`;
      display.classList.remove('hidden');
      statusEl.textContent = '上傳成功！';
    }).catch(() => {
      statusEl.textContent = '上傳失敗，請稍後再試';
    }).finally(() => { btn.disabled = false; });
  }

  function cloudRestore() {
    const code = $('#cloud-code-input').value.trim().toUpperCase();
    const statusEl = $('#cloud-status');
    if (!/^[23456789A-HJ-NP-Z]{6}$/.test(code)) {
      statusEl.textContent = '代碼格式不對，請確認 6 位代碼';
      return;
    }
    statusEl.textContent = '還原中…';
    fetch(`/api/backup-load?code=${code}`).then((r) => r.json()).then((j) => {
      if (!j.ok) throw new Error('not found');
      XYStore.importProgress(j.data);
      localStorage.setItem(CLOUD_CODE_KEY, code);
      alert('已還原進度');
      render();
      statusEl.textContent = '';
    }).catch(() => {
      statusEl.textContent = '找不到這組代碼，或已經過期';
    });
  }

  function initNav() {
    $('[data-action="backup-copy"]').addEventListener('click', () => {
      navigator.clipboard.writeText($('#backup-export').value);
      alert('已複製到剪貼簿');
    });
    $('[data-action="summary-copy"]').addEventListener('click', () => {
      navigator.clipboard.writeText(summaryText());
      alert('戰績摘要已複製，可貼給老師或家長看');
    });
    $('[data-action="backup-download"]').addEventListener('click', download);
    $('[data-action="backup-restore"]').addEventListener('click', () => {
      const json = $('#backup-import').value.trim();
      if (!json) { alert('請先貼上備份內容'); return; }
      importFromText(json);
    });
    $('#backup-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => importFromText(reader.result);
      reader.readAsText(file);
    });
    $('[data-action="cloud-upload"]').addEventListener('click', cloudUpload);
    $('[data-action="cloud-restore"]').addEventListener('click', cloudRestore);
  }

  return { render, initNav };
})();
