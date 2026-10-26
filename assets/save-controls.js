'use strict';
window.installSaveControls = function installSaveControls() {
  $('backup-panel').hidden = !Platform.browserMode;
  let pendingBackup = null;
  let selectionVersion = 0;
  $('save-now').onclick=async()=>{
    if(await action('sync'))$('backup-status').textContent='현재 진행도를 이 브라우저에 저장했습니다.';
  };
  $('reset-open').onclick=()=>{$('reset-confirmation').hidden=false;};
  $('reset-cancel').onclick=()=>{$('reset-confirmation').hidden=true;};
  $('reset-confirm').onclick=async()=>{
    if(busy||$('reset-confirmation').hidden)return;
    busy=true;$('reset-confirm').disabled=true;
    try{
      await Platform.reset({revision,requestId:crypto.randomUUID()});
      selectionVersion++;pendingBackup=null;
      $('backup-restore').hidden=true;$('backup-file').value='';
      archivedLogs=[];logPage=null;renderedRevision=-1;plan=null;
      selected=null;$('detail').hidden=true;teamView=null;
      boxView.query='';boxView.filter='all';boxView.sort='recent';boxView.limit=24;
      await loadSave();showTab('map');
      $('reset-confirmation').hidden=true;
      $('backup-status').textContent='초기화했습니다. 지도에서 스타팅을 다시 선택하세요.';
    }catch(error){$('backup-status').textContent=error.message;}
    finally{busy=false;$('reset-confirm').disabled=false;renderGame();}
  };
  $('backup-export').onclick = async () => {
    try {
      const backup = await Platform.backup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], {type:'application/json'}));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'poketour-save-' + new Date().toISOString().slice(0,10) + '.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url),1000);
      $('backup-status').textContent = '저장 파일을 내려받았습니다. 다른 기기에서도 이 파일로 복원할 수 있습니다.';
    } catch (error) { $('backup-status').textContent = error.message; }
  };
  $('backup-file').onchange = async () => {
    const selection = ++selectionVersion;
    pendingBackup = null;
    $('backup-restore').hidden = true;
    const file = $('backup-file').files[0];
    if (!file) return;
    try {
      if (file.size > 15000000) throw Error('저장 파일이 너무 큽니다.');
      const backup = JSON.parse(await file.text());
      if (selection !== selectionVersion) return;
      if (backup.format !== 'poketour-backup-v1' || !backup.state) throw Error('Poketour 저장 파일을 선택하세요.');
      pendingBackup = backup;
      $('backup-status').textContent = '선택한 파일: ' + file.name + '. 복원하면 이 브라우저의 현재 진행도를 바꿉니다. 먼저 현재 저장을 내려받아 두세요.';
      $('backup-restore').hidden = false;
    } catch (error) { if (selection === selectionVersion) $('backup-status').textContent = error.message; }
  };
  $('backup-restore').onclick = async () => {
    if (!pendingBackup || busy) return;
    busy = true;
    try {
      await Platform.restore(pendingBackup);
      selectionVersion++;
      pendingBackup = null;
      $('backup-restore').hidden = true;
      $('backup-file').value = '';
      archivedLogs = []; logPage = null; renderedRevision = -1;
      await loadSave();
      renderGame();
      $('backup-status').textContent = '진행도를 복원했습니다.';
    } catch (error) { $('backup-status').textContent = error.message; }
    finally { busy=false; renderGame(); }
  };
};
