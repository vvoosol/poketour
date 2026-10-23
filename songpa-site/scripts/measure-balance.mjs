import fs from 'node:fs';
import path from 'node:path';
import {createEngine} from '../src/shared/engine.mjs';
import {projectPath,projectRoot} from './paths.mjs';
const read=name=>JSON.parse(fs.readFileSync(projectPath('dist/client',name)));
const D=read('pokemon-data.json'),C=read('game-settings.json'),W=read('world-seed.json');
const summary=values=>{const a=[...values].sort((a,b)=>a-b);return {count:a.length,min:a[0]??null,median:a[Math.floor(a.length*.5)]??null,p95:a[Math.min(a.length-1,Math.floor(a.length*.95))]??null,max:a.at(-1)??null};};
const battles=[];
for(const policy of ['fast','capture'])for(const starter of [749,318,940])for(let seed=1;seed<=12;seed++){
 const E=createEngine(D,C,W),s=E.migrate(null,1000,Math.imul(seed,983452)>>>0);
 E.apply(s,'demo',{},1000);E.apply(s,'starter',{id:starter},1000);
 s.settings={...s.settings,policy,heal:false,fleeHp:0};s.search=false;s.nextNearbySpawn=null;s.nextRareSpawn=null;
 s.battle={id:'sample',kind:'wild',enemy:E.newPokemon(s,19,5,1000),active:s.player.party[0].uid,attempts:0,rareAttempts:0,turns:0,startedAt:1000,nextAt:1000+C.actionMs,environment:{habitat:'urban'},queue:[]};
 let t=1000;while(s.battle&&t<3601000){t+=C.actionMs;E.advance(s,t);}
 const result=s.battle?'timeout':s.events.filter(e=>['win','capture','wipe','flee'].includes(e.kind)).at(-1)?.kind;
 battles.push({starter,policy,seed,seconds:(t-1000)/1000,result});
}
const spawnTimes=[];let spawnTimeouts=0;
for(let seed=1;seed<=200;seed++){
 const E=createEngine(D,C,W),s=E.migrate(null,1000,Math.imul(seed,0x9e3779b9)>>>0);
 E.apply(s,'demo',{},1000);E.apply(s,'starter',{id:749},1000);s.settings.auto=false;
 let seen;for(let tick=1;tick<=6&&!seen;tick++){
  const t=1000+tick*C.fieldWilds.spawnIntervalMs;E.advance(s,t);while(s.pending)E.advance(s,t);
  seen=s.events.find(e=>e.kind==='sighting'&&e.spawn==='nearby');
 }
 if(seen)spawnTimes.push((seen.at-1000)/1000);else spawnTimeouts++;
}
const report={
 generatedAt:new Date().toISOString(),
 scenario:'Level 5 starter versus level 5 Rattata, fixed seeds, no auto healing/flee threshold; no external map/GPS. Results are simulation, not device playtests.',
 preserved:{hpMultiplier:C.hpMultiplier,actionSeconds:C.actionMs/1000,nearbyIntervalSeconds:C.fieldWilds.spawnIntervalMs/1000,nearbyChance:C.fieldWilds.spawnChance,rareIntervalSeconds:C.fieldWilds.rareSpawnIntervalMs/1000,rareChance:C.fieldWilds.rareSpawnChance},
 battles:[...new Set(battles.map(x=>x.policy+':'+x.starter))].map(key=>{
  const items=battles.filter(x=>x.policy+':'+x.starter===key);
  return {policy:items[0].policy,starter:items[0].starter,seconds:summary(items.map(x=>x.seconds)),outcomes:Object.fromEntries(['win','capture','wipe','flee','timeout'].map(k=>[k,items.filter(x=>x.result===k).length]))};
 }),
 firstNearbySpawnSeconds:summary(spawnTimes),spawnTimeouts,
 tuning:'Keep existing HP, action and spawn rules. Add capped one-time exploration/collection rewards: first arrival 200, first win 2 potions, first capture 5 Poke Balls, 5 species 3 Great Balls, 10 species 500, first badge 2 Super Potions. Review battle outcome disparity with real playtests before changing old saves or combat formulas.',
};
fs.writeFileSync(path.resolve(projectRoot,'../docs/BALANCE_REPORT.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({battles:report.battles,firstNearbySpawnSeconds:report.firstNearbySpawnSeconds,spawnTimeouts}));
