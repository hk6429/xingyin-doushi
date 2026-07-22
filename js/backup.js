const XYBackup = (() => {
  function $(sel) { return document.querySelector(sel); }

  function render() {
    const json = XYStore.exportProgress();
    $('#backup-export').value = json;
    $('#backup-import').value = '';
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

  function initNav() {
    $('[data-action="backup-copy"]').addEventListener('click', () => {
      navigator.clipboard.writeText($('#backup-export').value);
      alert('已複製到剪貼簿');
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
  }

  return { render, initNav };
})();
