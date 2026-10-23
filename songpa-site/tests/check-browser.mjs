import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {IDBFactory} from 'fake-indexeddb';
import {createBrowserStore} from '../src/platform/browser-store.mjs';
import {projectPath} from '../scripts/paths.mjs';

const factory = new IDBFactory();
const fetched = [];
const fetcher = async url => {
  const parsed = new URL(url);
  assert.equal(parsed.origin,'https://vvoosol.github.io');
  assert(parsed.pathname.startsWith('/poketour-play/'));
  assert(!parsed.pathname.includes('/api/'));
  const name = parsed.pathname.slice('/poketour-play/'.length);
  fetched.push(name);
  return new Response(fs.readFileSync(projectPath('dist/client',name)),{headers:{'Content-Type':'application/json'}});
};
let now = 1800000000000;
const options = {indexedDB:factory,fetcher,clock:()=>now,dbName:'browser-test',baseUrl:'https://vvoosol.github.io/poketour-play/'};
let store = await createBrowserStore(options);
const read = async runtime => (await runtime.request('/api/state')).json();
let current = await read(store);
assert.equal(current.revision,0);
assert.equal(fetched.filter(x=>x==='foot-graph.json').length,1,'Graph preloads on opening');
const call = async (runtime,action,payload={},requestId=crypto.randomUUID(),revision=current.revision,endpoint='/api/action') => {
  const response = await runtime.request(endpoint,{method:'POST',body:JSON.stringify({revision,requestId,action,payload})});
  const result = await response.json();
  if (response.ok) current=result;
  return {status:response.status,result};
};
assert.equal((await call(store,'demo')).status,200);
const starter = await call(store,'starter',{id:749},'starter-request');
assert.equal(starter.status,200);
assert.equal(starter.result.state.starter,749);
const saved = structuredClone(current);
const replay = await call(store,'starter',{id:749},'starter-request',0);
assert.equal(replay.result.replayed,true);
assert.deepEqual(replay.result.state,saved.state);
assert.equal((await call(store,'starter',{id:318})).status,400);
assert.equal((await call(store,'debug-spawn')).status,400);
assert.equal((await call(store,'favorite',{id:'hospital-asan'},'stale',0)).status,409);
store.close();
store = await createBrowserStore(options);
assert.deepEqual(await read(store),saved,'Reopening IndexedDB retains revision, UID, party, money and position');

const otherTab = await createBrowserStore(options);
const revision = saved.revision;
const concurrent = await Promise.all([
  call(store,'favorite',{id:'hospital-asan'},'tab-one',revision),
  call(otherTab,'favorite',{id:'park-olympic'},'tab-two',revision),
]);
assert.deepEqual(concurrent.map(x=>x.status).sort(),[200,409]);
current = await read(store);
const duplicateRevision = current.revision;
const duplicateRequest = 'same-concurrent-request';
const duplicateResponses = await Promise.all([
  call(store,'favorite',{id:'hospital-asan'},duplicateRequest,duplicateRevision),
  call(otherTab,'favorite',{id:'hospital-asan'},duplicateRequest,duplicateRevision),
]);
assert(duplicateResponses.every(x=>x.status===200));
assert(duplicateResponses.some(x=>x.result.replayed));
current = await read(store);
assert.equal(current.revision,duplicateRevision+1,'Same concurrent request commits only once');
assert.equal((await call(store,'sync',{},'')).status,400);
const graphLoadsBeforeRoute=fetched.filter(x=>x==='foot-graph.json').length;
const route = await call(store,'route',{id:'park-olympic',mode:'walk'},'route-plan',current.revision,'/api/route');
assert.equal(route.status,200,route.result.error);
assert.equal(route.result.plan.routingMethod,'songpa-a-star');
assert.equal(fetched.filter(x=>x==='foot-graph.json').length,graphLoadsBeforeRoute,'Route reuses preloaded graph');
assert.equal((await call(store,'start',{token:'wrong'})).status,400);
const start = await call(store,'start',{token:route.result.plan.token});
assert.equal(start.status,200);
assert(start.result.state.travel);
// Reopening during travel advances from the saved departure instead of restarting it.
store.close();
store = await createBrowserStore(options);
assert.deepEqual((await read(store)).state.travel,start.result.state.travel);
now+=1000;
assert.equal((await call(store,'sync')).status,200);
const afterSync = structuredClone(current);
assert.equal((await call(store,'sync',{},'offline-replay')).status,200);
const syncedRevision = current.revision;
assert.equal((await call(store,'sync',{},'offline-replay')).result.replayed,true);
assert.equal(current.revision,syncedRevision);
assert.deepEqual(current.state.player,afterSync.state.player,'Repeated reconciliation cannot duplicate rewards');
assert.equal((await call(store,'cancel')).status,200);
const history = await (await store.request('/api/events')).json();
assert(history.events.some(e=>e.kind==='starter'));
assert.equal(new Set(history.events.map(e=>e.id)).size,history.events.length);
const backup = await store.backup();
const beforeInvalid = await read(store);
await assert.rejects(store.restore({format:'wrong',state:backup.state}),/지원하지/);
await assert.rejects(store.restore({...backup,state:{...backup.state,player:{...backup.state.player,money:-1}}}),/잘못/);
for (const corrupt of [
  b=>{b.state.player.party[0].level=101;},
  b=>{b.state.player.party[0].stats=[];},
  b=>{b.state.player.party[0].hp=b.state.player.party[0].maxHp+1;},
  b=>{b.state.player.party[0].moves[0].pp=-1;},
  b=>{b.state.seq=0;},
  b=>{b.events.push({...b.events[0]});},
]) {
  const invalid=structuredClone(backup);corrupt(invalid);
  await assert.rejects(store.restore(invalid),/잘못/);
  assert.deepEqual(await read(store),beforeInvalid,'Invalid restore leaves the current save intact');
  assert.deepEqual((await (await store.request('/api/events')).json()).events,history.events,'Invalid restore preserves archived events');
}
assert.deepEqual(await read(store),beforeInvalid);
const imported = await createBrowserStore({...options,dbName:'imported-browser'});
const restored = await imported.restore(backup);
assert.deepEqual(restored.state.player,backup.state.player);
assert.deepEqual(restored.state.game,backup.state.game);
assert.equal(restored.state.companionUid,backup.state.companionUid);
const restoredHistory = await (await imported.request('/api/events')).json();
assert.deepEqual(restoredHistory.events,history.events);
for (const version of [3,4]) {
  const legacy=structuredClone(backup);
  legacy.state.version=version;
  if(version===3) for(const p of [...legacy.state.player.party,...legacy.state.box]) {
    const scale=p.hpScale||100;p.hp/=scale;p.maxHp/=scale;p.stats[0]/=scale;delete p.hpScale;
  }
  const migratedStore=await createBrowserStore({...options,dbName:'legacy-'+version});
  const migrated=await migratedStore.restore(legacy);
  assert.equal(migrated.state.version,5);
  assert.equal(migrated.state.player.party[0].uid,backup.state.player.party[0].uid);
  assert.equal(migrated.state.player.party[0].hp,backup.state.player.party[0].hp);
  assert.equal(migrated.state.player.money,backup.state.player.money);
  migratedStore.close();
}
// Old 100x backups must pass pre-migration validation, then persist the 10x scale.
const legacy100=structuredClone(backup);
for(const p of [...legacy100.state.player.party,...legacy100.state.box]){
 const factor=100/p.hpScale;p.maxHp*=factor;p.stats[0]=p.maxHp;p.hp=p.maxHp*.37;p.hpScale=100;
}
const legacy100Store=await createBrowserStore({...options,dbName:'legacy-100-backup'});
const legacy100Result=await legacy100Store.restore(legacy100);
const restored100=legacy100Result.state.player.party[0],original=backup.state.player.party[0];
assert.equal(restored100.hpScale,10);assert.equal(restored100.maxHp,original.maxHp);
assert(Math.abs(restored100.hp/restored100.maxHp-.37)<1e-12);
assert.equal(restored100.uid,original.uid);assert.deepEqual(restored100.moves,original.moves);
assert.equal((await legacy100Store.backup()).state.player.party[0].hpScale,10);
const crowded=structuredClone(backup);
crowded.state.fieldWilds=Array.from({length:12},(_,i)=>({id:'legacy-wild-'+i,speciesId:19,level:5,coord:[127.11,37.53],spawnedAt:now-1200+i,expiresAt:now+3600000}));
crowded.state.huntTargetId='legacy-wild-0';crowded.state.fieldWilds[0].pursued=true;
const trimmed=await legacy100Store.restore(crowded);
assert.deepEqual(trimmed.state.fieldWilds.map(w=>w.id),['legacy-wild-0','legacy-wild-8','legacy-wild-9','legacy-wild-10','legacy-wild-11']);
const trimmedBackup=await legacy100Store.backup();
assert.deepEqual((await legacy100Store.restore(trimmedBackup)).state.fieldWilds,trimmed.state.fieldWilds,'FIFO order and protected target survive backup round trip');
legacy100Store.close();
const separate = await createBrowserStore({...options,dbName:'separate-browser'});
assert.equal((await read(separate)).state.starter,null);
for (const runtime of [store,otherTab,imported,separate]) runtime.close();
console.log('PASS browser IndexedDB: starter, replay, reopening, multi-tab CAS, preloaded A*, travel, events, backup/restore, invalid import, independent browser');

// Claim through the real browser API after a genuine routed arrival, then restore it.
const goalStore=await createBrowserStore({...options,dbName:'adventure-browser'});
let goalCurrent=await read(goalStore);
const goalCall=async(runtime,action,payload={},requestId=crypto.randomUUID(),endpoint='/api/action')=>{
  const response=await runtime.request(endpoint,{method:'POST',body:JSON.stringify({action,payload,requestId,revision:goalCurrent.revision})});
  const result=await response.json();if(response.ok)goalCurrent=result;
  return {status:response.status,result};
};
assert.equal((await goalCall(goalStore,'demo')).status,200);
assert.equal((await goalCall(goalStore,'starter',{id:749})).status,200);
assert.equal((await goalCall(goalStore,'route',{id:'park-olympic',mode:'walk'},crypto.randomUUID(),'/api/route')).status,200);
assert.equal((await goalCall(goalStore,'start',{token:goalCurrent.plan.token})).status,200);
now=goalCurrent.state.travel.arriveAt+1;
do { assert.equal((await goalCall(goalStore,'sync')).status,200); } while(goalCurrent.state.pending);
const beforeReward=goalCurrent.state.player.money;
const goalTab=await createBrowserStore({...options,dbName:'adventure-browser'});
const rewardResults=await Promise.all([
  goalCall(goalStore,'claim-goal',{id:'first-arrival'},'same-goal-claim'),
  goalCall(goalTab,'claim-goal',{id:'first-arrival'},'same-goal-claim'),
]);
assert(rewardResults.every(x=>x.status===200));
assert.equal((await read(goalStore)).state.player.money,beforeReward+200);
const goalBackup=await goalStore.backup();
await goalTab.restore(goalBackup);goalCurrent=await read(goalTab);
assert.equal((await goalCall(goalTab,'claim-goal',{id:'first-arrival'})).status,400,'Restored saves cannot claim the same reward again');
const invalidClaims=structuredClone(goalBackup);invalidClaims.state.adventureClaims.push('first-arrival');
await assert.rejects(goalTab.restore(invalidClaims),/보상/);
goalTab.close();goalStore.close();
console.log('PASS adventure browser API: route arrival, concurrent reward paid once, backup/restore retains claim and rejects duplicated claim ledger');

const apiCalls=[];
const context=vm.createContext({window:{POKETOUR_CONFIG:{storageMode:'browser'},addEventListener(){}},document:{addEventListener(){},removeEventListener(){}},navigator:{},fetch:()=>{throw Error('Pages must not fetch a backend API');},URL});
vm.runInContext(fs.readFileSync(projectPath('src/platform/browser.js'),'utf8'),context);
const platform=context.window.createPoketourPlatform({config:{storageMode:'browser'},browserStore:{request:(...args)=>{apiCalls.push(args);return Response.json({ok:true});},backup:()=>backup}});
assert((await platform.apiFetch('/api/state')).ok);
assert.equal(apiCalls[0][0],'/api/state');
assert.equal(platform.auth.loginUrl,'./');
assert.equal(platform.allowDebug,false);
assert.match(platform.saveLabel,/브라우저/);
const html=fs.readFileSync(projectPath('dist/client/index.html'),'utf8');
assert(!html.includes('chatgpt.site'));
assert(!fs.readFileSync(projectPath('dist/client/platform/browser.js'),'utf8').includes('signin-with-chatgpt'));
assert(fs.readFileSync(projectPath('dist/client/runtime-config.js'),'utf8').includes('storageMode:"browser"'));
console.log('PASS Pages configuration: relative project paths, in-browser API, no login/GPT hosting dependency');
