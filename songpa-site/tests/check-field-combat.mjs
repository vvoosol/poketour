import assert from 'node:assert/strict';
import fs from 'node:fs';
import {IDBFactory} from 'fake-indexeddb';
import {createEngine} from '../src/shared/engine.mjs';
import {createBrowserStore} from '../src/platform/browser-store.mjs';
const read=n=>JSON.parse(fs.readFileSync('dist/client/'+n));
const D=read('pokemon-data.json'),C=read('game-settings.json'),W=read('world-seed.json');
const E=createEngine(D,C,W),make=(engine=E)=>{const s=engine.migrate(null,1000,42);engine.apply(s,'demo',{},1000);engine.apply(s,'starter',{id:749},1000);return s;};
const north=(p,m)=>[p[0],p[1]+m/111195];
const wild=(s,m=50)=>({id:'range-wild',speciesId:19,level:5,habitat:'urban',place:'도심',coord:north(s.game.coord,m),expiresAt:1e9,seed:42,pursued:true});
{
 const s=make();s.fieldWilds=[wild(s,101)];E.advance(s,1000);assert.equal(s.battle,null);
 s.fieldWilds=[wild(s,99)];E.advance(s,2000);assert.equal(s.battle.fieldId,'range-wild');
 assert.equal(s.battle.enemy.hpScale,C.hpMultiplier);assert.equal(s.huntTargetId,null);
 const before=s.player.party[0];before.hp=before.maxHp*.37;const uid=before.uid;
 for(let i=0;i<10;i++){E.apply(s,'settings',{auto:false},2001);assert.equal(before.hpScale,1);assert(Math.abs(before.hp/before.maxHp-.37)<1e-12);E.apply(s,'settings',{auto:true},2002);}
 assert.equal(before.uid,uid);assert(Math.abs(before.hp/before.maxHp-.37)<1e-12);
 E.apply(s,'settings',{auto:false},2003);const hp=s.battle.enemy.hp;
 E.advance(s,9000);assert.equal(s.battle.enemy.hp,hp,'Manual battle waits for a command');
 const move=before.moves.find(m=>D.moves[m.id].power>0);E.apply(s,'battle',{kind:'move',move:move.id},9001);assert.equal(s.battle.turns,1);
 assert.equal(s.battle.enemy.hpScale,1);
}
{
 const s=make(),w=wild(s,300);s.fieldWilds=[w];
 const end=north(s.game.coord,600);s.travel={id:'walk',origin:s.game.coord,destinationId:W.facilities[0].id,geometry:[s.game.coord,end],durationMs:60000,departAt:1000,arriveAt:61000};
 E.advance(s,25000);while(s.pending)E.advance(s,25000);
 assert(s.battle,'Walking past an unselected wild initiates combat');assert(E.distance(s.game.coord,w.coord)<=100);
 assert(s.battle.pausedTravel);assert.equal(s.travel,null);
 E.apply(s,'settings',{auto:false},25001);E.apply(s,'battle',{kind:'flee'},25002);
 assert(s.travel,'Remaining route resumes after battle');assert.equal(s.travel.id,'walk');
}
{
 const data=structuredClone(D);data.moves[33].accuracy=0;
 const engine=createEngine(data,C,W),s=make(engine);s.fieldWilds=[wild(s)];engine.advance(s,1000);
 const a=s.player.party[0],b=s.battle.enemy;a.moves=[{id:45,pp:40},{id:33,pp:35},{id:85,pp:15}];b.moves=[{id:33,pp:35}];
 const hp=a.hp,enemyHp=b.hp;engine.advance(s,7000);
 assert.equal(a.hp,hp);assert.equal(b.hp,enemyHp);assert.equal(a.moves[1].pp,34);assert.equal(a.moves[2].pp,15);
 assert(s.events.filter(e=>e.miss).length===2,'Both sides use first attack and respect 0% accuracy');
 data.moves[33].accuracy=100;engine.advance(s,13000);assert(a.hp<hp&&b.hp<enemyHp);
 assert(s.events.some(e=>e.damage>0&&e.actor===a.uid&&e.target===b.uid));
}
{
 const s=make();E.apply(s,'settings',{auto:false},1001);s.fieldWilds=[wild(s)];E.advance(s,2000);assert.equal(s.battle,null);
 E.apply(s,'pursue-wild',{id:'range-wild'},2001);assert(s.battle);assert.equal(s.battle.enemy.hpScale,1);
}
{
 const park={type:'Feature',properties:{id:'test-park',name:'검증 공원',kind:'park'},geometry:{type:'Polygon',coordinates:[[[127.109,37.526],[127.111,37.526],[127.111,37.528],[127.109,37.528],[127.109,37.526]]]}};
 const engine=createEngine(D,C,{...W,features:[park]}),s=make(engine);
 engine.apply(s,'settings',{auto:false},1001);engine.advance(s,1001);
 let info=engine.spawnInfo(s,1001);assert.equal(info.park,'test-park');assert.equal(info.intervalMs,120000);assert.equal(info.chance,.9);
 s.game.coord=north([127.11,37.528],100);assert.equal(engine.spawnInfo(s,1001).park,'test-park');
 s.game.coord=north([127.11,37.528],200);assert.equal(engine.spawnInfo(s,1001).park,null);
 s.game.coord=[127.11,37.527];s.rng=123;engine.apply(s,'debug-spawn',{},2001);assert.equal(s.fieldWilds.length,1);assert.equal(s.fieldWilds[0].habitat,'grass');
 assert(engine.inside(s.fieldWilds[0].coord,park.geometry),'Park bonus produces a candidate in the actual park');
 let parkSpawns=0;
 for(let seed=1;seed<=60;seed++){const sample=make(engine);sample.game.coord=[127.11,37.527];sample.rng=Math.imul(seed,0x9e3779b9)>>>0;engine.apply(sample,'settings',{auto:false},1001);engine.advance(sample,121000);if(sample.fieldWilds.length)parkSpawns++;}
 assert(parkSpawns>=45,'Boosted natural spawn schedule and chance operate without the test button');

}
// Exercise persistence and reset with real IndexedDB transactions, including another tab.
const factory=new IDBFactory(),options={indexedDB:factory,baseUrl:'https://test.invalid/game/',fetcher:async url=>Response.json(read(new URL(url).pathname.split('/').at(-1))),clock:()=>10000,dbName:'field-combat'};
let store=await createBrowserStore(options),current=await(await store.request('/api/state')).json();
const call=async(action,payload={})=>{const response=await store.request('/api/action',{method:'POST',body:JSON.stringify({action,payload,revision:current.revision,requestId:crypto.randomUUID()})});const body=await response.json();assert(response.ok,body.error);current=body;};
await call('demo');await call('starter',{id:749});
const backup=await store.backup();backup.state.fieldWilds=[wild(backup.state)];await store.restore(backup);current=await(await store.request('/api/state')).json();
await call('sync');assert(current.state.battle);const battleId=current.state.battle.id,uid=current.state.player.party[0].uid;
store.close();store=await createBrowserStore(options);current=await(await store.request('/api/state')).json();
assert.equal(current.state.battle.id,battleId);assert.equal(current.state.player.party[0].uid,uid);
const fighting=await store.backup();await store.restore(fighting);current=await(await store.request('/api/state')).json();assert.equal(current.state.battle.id,battleId);
const damaged=structuredClone(fighting);damaged.state.battle.enemy.hpScale=25;await assert.rejects(store.restore(damaged),/배율/);
const requestId='reset-one',resetRevision=current.revision,other=await createBrowserStore(options);
await store.reset({revision:resetRevision,requestId});current=await(await store.request('/api/state')).json();
assert.equal(current.revision,resetRevision+1);assert.equal(current.state.starter,null);assert.equal(current.state.battle,null);assert.equal(current.state.player.party.length,0);assert.equal(current.state.player.money,0);assert.equal(current.state.events.length,0);assert.equal((await(await store.request('/api/events')).json()).events.length,0);
await assert.rejects(other.reset({revision:resetRevision,requestId:'stale-reset'}),/다른 탭/);
await call('starter',{id:318});const newUid=current.state.player.party[0].uid;
await other.reset({revision:resetRevision,requestId});assert.equal((await(await store.request('/api/state')).json()).state.player.party[0].uid,newUid,'Replayed reset cannot erase the new adventure');
await store.restore(fighting);assert.equal((await(await store.request('/api/state')).json()).state.battle.id,battleId,'Backup can restore the pre-reset adventure');
store.close();other.close();
console.log('PASS field combat: 100m/pass-by/selected manual, first attack power+accuracy, mode HP ratio, park polygon bonus, battle save/reopen/restore, atomic reset/conflict/replay and pre-reset backup recovery');
