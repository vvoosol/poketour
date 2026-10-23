import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { projectPath } from '../scripts/paths.mjs';

const nodes=Object.fromEntries(['backup-panel','backup-export','backup-file','backup-restore','backup-status','save-now','reset-open','reset-cancel','reset-confirm','reset-confirmation','detail'].map(id=>[id,{hidden:false,value:'selected-file'}]));
let selected;
const context=vm.createContext({
  window:{}, $:id=>nodes[id], Platform:{browserMode:true,restore:async backup=>{selected=backup.state.marker;}},
  busy:false, archivedLogs:[{id:123,msg:'Previous save'}], logPage:123, renderedRevision:20,
  loadSave:async()=>{}, renderGame(){},
});
vm.runInContext(fs.readFileSync(projectPath('src/client/save-controls.js'),'utf8'),context);
context.window.installSaveControls();
const file=marker=>({name:marker+'.json',size:100,text:async()=>JSON.stringify({format:'poketour-backup-v1',state:{marker}})});
let finishOldRead;
nodes['backup-file'].files=[{...file('old'),text:()=>new Promise(resolve=>{finishOldRead=resolve;})}];
const oldRead=nodes['backup-file'].onchange();
nodes['backup-file'].files=[file('latest')];
await nodes['backup-file'].onchange();
finishOldRead(JSON.stringify({format:'poketour-backup-v1',state:{marker:'old'}}));
await oldRead;
assert(nodes['backup-status'].textContent.includes('latest.json'));
await nodes['backup-restore'].onclick();
assert.equal(selected,'latest','Slow previous file cannot replace the selected backup');
assert.equal(context.archivedLogs.length,0,'Previous save history does not appear after restore');
assert.equal(context.logPage,null);
assert.equal(context.renderedRevision,-1);
assert.equal(context.busy,false);
assert.equal(nodes['backup-file'].value,'');
assert(nodes['backup-restore'].hidden);
console.log('PASS backup controls: file selection race, explicit restore, cleared old history and re-enabled actions');

let resetCount=0,savedCount=0;
Object.assign(context,{revision:12,crypto,plan:{old:true},lastMapAttack:100,selected:{id:'old'},teamView:{old:true},boxView:{query:'old',filter:'shiny',sort:'dex',limit:48},showTab:tab=>{context.activeTab=tab;},action:async kind=>{assert.equal(kind,'sync');savedCount++;return true;}});
context.Platform.reset=async request=>{assert.equal(request.revision,12);resetCount++;};
nodes['reset-confirmation'].hidden=true;
await nodes['save-now'].onclick();assert.equal(savedCount,1);
await nodes['reset-confirm'].onclick();assert.equal(resetCount,0,'Hidden confirmation cannot reset');
nodes['reset-open'].onclick();assert.equal(resetCount,0,'Opening confirmation is not a reset');
nodes['reset-cancel'].onclick();assert(nodes['reset-confirmation'].hidden);
nodes['reset-open'].onclick();context.busy=true;await nodes['reset-confirm'].onclick();assert.equal(resetCount,0);
context.busy=false;await nodes['reset-confirm'].onclick();assert.equal(resetCount,1);
assert(nodes['reset-confirmation'].hidden);assert.equal(context.plan,null);assert.equal(context.teamView,null);assert.equal(context.activeTab,'map');assert.equal(context.boxView.query,'');assert.equal(context.busy,false);
console.log('PASS save/reset controls: explicit save, confirmation/cancel, busy guard, clearing view caches and returning to starter map');
