import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createEngine} from '../src/shared/engine.mjs';
import '../src/client/combat-playback.js';

const read=n=>JSON.parse(fs.readFileSync('dist/client/'+n));
const D=read('pokemon-data.json'),C=read('game-settings.json'),W=read('world-seed.json');
const data=structuredClone(D);data.moves[33].accuracy=100;
const E=createEngine(data,C,W);
function battle(enemyId=19){
 const s=E.migrate(null,1000,42);E.apply(s,'demo',{},1000);E.apply(s,'starter',{id:749},1000);E.apply(s,'settings',{auto:false},1000);
 s.fieldWilds=[{id:'test',speciesId:enemyId,level:5,habitat:'urban',place:'검증',coord:s.game.coord,expiresAt:1e9,pursued:true}];
 E.apply(s,'pursue-wild',{id:'test'},1000);
 const p=s.player.party[0],e=s.battle.enemy;p.moves=[{id:33,pp:35}];e.moves=[{id:33,pp:35}];p.stats[5]=10000;p.ability=e.ability=null;
 return {s,p,e};
}
const facts=s=>s.events.filter(e=>e.combat).map(e=>e.combat);
{
 const {s,p,e}=battle();e.hp=1;const enemyUid=e.uid,money=s.player.money;
 E.apply(s,'battle',{kind:'move',move:33},1001);
 const events=facts(s);assert.deepEqual(events.map(e=>e.type),['attack','hp','faint','end']);
 assert.equal(events[0].actor,p.uid);assert.equal(events[1].before,1);assert.equal(events[1].after,0);
 assert.equal(events[2].target,enemyUid);assert.equal(events.at(-1).scene.enemy.hp,0);
 assert.equal(s.battle,null);assert.equal(s.player.money,money+C.battleReward);
 assert.equal(new Set(events.map(e=>e.sequence)).size,events.length);
 assert(events.every(e=>e.turnId===events[0].turnId&&e.battleId===events[0].battleId));
 // Snapshots must not alias owned Pokémon or change after growth/migration.
 const snapshot=events[0].scene.ally.hp;p.hp=0;assert.equal(events[0].scene.ally.hp,snapshot);
}
{
 const {s,e}=battle();data.moves[33].accuracy=0;const before=e.hp;
 E.apply(s,'battle',{kind:'move',move:33},1001);
 assert.equal(e.hp,before);assert(facts(s).every(e=>e.type!=='hp'));assert(facts(s).every(e=>e.result==='miss'));
 data.moves[33].accuracy=100;
}
{
 const {s,p}=battle(92); // Normal attack has no effect on Ghost.
 E.apply(s,'battle',{kind:'move',move:33},1001);
 assert.equal(facts(s).find(e=>e.actor===p.uid&&e.type==='attack').result,'immune');
 assert(!facts(s).some(e=>e.target===s.battle.enemy.uid&&e.type==='hp'));
}
{
 const {s,p}=battle();p.hp=p.maxHp/2;const before=p.hp;
 E.apply(s,'battle',{kind:'item',item:'potion'},1001);
 const events=facts(s),heal=events.find(e=>e.type==='hp'&&e.reason==='item');
 assert.equal(heal.before,before);assert(heal.after>before);assert.equal(events[0].type,'item');
 const next=E.newPokemon(s,940,5,1002);s.player.party.push(next);
 E.apply(s,'battle',{kind:'switch',uid:next.uid},1002);
 assert(facts(s).some(e=>e.type==='switch'&&e.target===next.uid&&e.from===p.uid));
}
{
 const {s,p,e}=battle();p.status=5;p.hp=p.maxHp;e.hp=e.maxHp=10000;
 E.apply(s,'battle',{kind:'move',move:33},1001);
 assert(facts(s).some(e=>e.type==='hp'&&e.reason==='status'&&e.after<e.before));
 p.status=2;p.statusTurns=0;
 E.apply(s,'battle',{kind:'move',move:33},1002);
 assert(facts(s).some(e=>e.type==='blocked'&&e.actor===p.uid));
 E.apply(s,'battle',{kind:'flee'},1003);assert.equal(facts(s).at(-1).result,'flee');
}
{
 const {s,p,e}=battle();p.hp=1;p.moves=[{id:165,pp:1}];e.hp=e.maxHp=10000;
 E.apply(s,'battle',{kind:'move',move:165},1001);
 const events=facts(s);assert(events.some(e=>e.type==='hp'&&e.reason==='recoil'));
 assert(events.some(e=>e.type==='faint'&&e.target===p.uid));
 assert(!events.some(e=>e.type==='attack'&&e.actor===e.scene.enemy.uid),'No attack after the opponent fainted from recoil');
}
{
 const {s,e}=battle();E.apply(s,'settings',{capture:'all'},1001);
 // Deterministic search exercises both actual engine outcomes, not fabricated logs.
 let success=false,failure=false;
 for(let seed=1;seed<100&&(!success||!failure);seed++){
  const sample=structuredClone(s);sample.rng=Math.imul(seed,0x9e3779b9)>>>0;sample.battle.enemy.hp=1;
  E.apply(sample,'battle',{kind:'ball',ball:'poke-ball'},1002);
  const capture=facts(sample).find(e=>e.type==='capture');assert.equal(capture.target,e.uid);
  if(capture.success){success=true;assert.equal(facts(sample).at(-1).result,'capture');assert.equal(sample.battle,null);}
  else {failure=true;assert(sample.battle);assert(facts(sample).some(e=>e.type==='attack'));}
 }
 assert(success&&failure);
}

const Player=globalThis.PoketourCombatPlayback,tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const event=(id,type='attack')=>({id,at:1000,combat:{version:1,type,battleId:'b',sequence:id}});
const state=(events,seq=Math.max(0,...events.map(e=>e.id)))=>({seq,events});
{
 // WebKit's window timer methods reject a CombatPlayback receiver. Node timers
 // accept it, so simulate the actual browser contract rather than a no-op timer.
 const browser=vm.createContext({console});
 vm.runInContext(`let cleared=0;globalThis.setTimeout=function(){if(this!==globalThis)throw Error('Illegal invocation');return 1;};globalThis.clearTimeout=function(){if(this!==globalThis)throw Error('Illegal invocation');cleared++;};`,browser);
 vm.runInContext(fs.readFileSync('src/client/combat-playback.js','utf8'),browser);
 vm.runInContext(`var player=new PoketourCombatPlayback({clock:()=>1000,present:()=>{}});player.ingest({seq:0,events:[]},0);player.ingest({seq:1,events:[{id:1,at:1000,combat:{version:1}}]},1);`,browser);
 await tick();assert.equal(vm.runInContext('player.playing',browser),false);assert.equal(vm.runInContext('cleared',browser),1);
}
{
 let release;const shown=[],errors=[];
 const player=new Player({clock:()=>1000,present:e=>{shown.push(e.id);return new Promise(resolve=>{release=resolve;});},onError:e=>errors.push(e)});
 player.ingest(state([event(1)]),1);assert.deepEqual(shown,[],'Loading a save does not replay history');
 player.ingest(state([event(1),event(2),event(3,'end')]),2);await tick();assert.deepEqual(shown,[2]);assert(player.playing);
 player.ingest(state([event(1),event(2),event(3,'end')]),3);release();await tick();assert.deepEqual(shown,[2,3],'Duplicate committed events play once');
 release();await tick();assert(!player.playing);assert.deepEqual(errors,[]);
}
{
 let release;const shown=[];const player=new Player({clock:()=>1000,present:e=>{shown.push(e.id);return new Promise(resolve=>{release=resolve;});}});
 player.ingest(state([]),0);player.ingest(state([event(1),event(2)]),1);await tick();
 const token=player.token;player.reset(state([]),2);assert(token.aborted);assert(!player.playing);
 release();await tick();assert.deepEqual(shown,[1],'Reset discards queued events');
 player.ingest({...state([event(3)]),pending:true},3);assert(!player.playing);
 player.ingest(state([event(3)]),4);assert(!player.playing,'Catch-up events are not replayed afterwards');
}
{
 const shown=[],errors=[];let clock=1000;
 const player=new Player({clock:()=>clock,present:e=>{shown.push(e.id);throw Error('missing sprite');},onError:e=>errors.push(e.message)});
 player.ingest(state([]),0);player.ingest(state([event(1)]),1);await tick();assert(!player.playing);assert.deepEqual(errors,['missing sprite']);
 clock=30000;player.ingest(state([event(2)]),2);assert.deepEqual(shown,[1],'Tab resume skips old backlog');
}
{
 let fire,cleared=0;
 const player=new Player({clock:()=>1000,present:()=>new Promise(()=>{}),setTimer:fn=>{fire=fn;return 1;},clearTimer:()=>cleared++});
 player.ingest(state([]),0);player.ingest(state([event(1)]),1);await tick();assert(player.playing);
 fire();await tick();assert(!player.playing,'A missing animation callback cannot lock commands forever');assert.equal(cleared,1);
}
console.log('PASS combat facts and playback: real turn order, final hit/faint/end, miss/immune, healing, switch, status/recoil, capture, immutable scenes, dedup, reset/resume/catch-up and error/timeout unlock');
