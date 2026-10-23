import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createEngine} from '../src/shared/engine.mjs';
const read=n=>JSON.parse(fs.readFileSync('dist/client/'+n));
const D=read('pokemon-data.json'),C=read('game-settings.json'),W=read('world-seed.json');
const G=createEngine(D,{...C,fieldWilds:{...C.fieldWilds,spawnChance:1,rareSpawnChance:1}},W);
const make=()=>{const s=G.migrate(null,1000,42);G.apply(s,'demo',{},1000);G.apply(s,'starter',{id:749},1000);G.apply(s,'settings',{auto:false},1000);return s;};
const fill=(s,n=5)=>{s.fieldWilds=Array.from({length:n},(_,i)=>({id:'old-'+i,speciesId:915,level:5,habitat:'urban',place:'검증',coord:[s.game.coord[0],s.game.coord[1]+.0036],spawnedAt:1000+i,expiresAt:1e9,moveUntil:1e9,seed:42}));};

// Both scheduled spawn clocks fire while the oldest target's lifetime has elapsed.
const s=make();fill(s);const target=s.fieldWilds[0];target.expiresAt=2000;target.pursued=true;s.huntTargetId=target.id;
s.travel={id:'pursuit',fieldWildId:target.id,geometry:[s.game.coord,target.coord],departAt:1000,arriveAt:7000,destinationId:null};
s.nextNearbySpawn=s.nextRareSpawn=5000;
G.advance(s,5000);
assert.equal(s.pending,false,'Protected expiry cannot create an endless past-due event');
assert.equal(s.fieldWilds.length,5);assert(s.fieldWilds.some(w=>w.id===target.id));
assert(!s.fieldWilds.some(w=>['old-1','old-2'].includes(w.id)),'Simultaneous near/rare spawns evict the two oldest eligible sightings');
assert.equal(s.events.filter(e=>e.kind==='sighting').length,2);
assert(G.visibleFieldWilds(s,5000).some(w=>w.id===target.id),'Expired travelling target remains renderable');
const reopened=G.migrate(s,5000);assert(reopened.fieldWilds.some(w=>w.id===target.id));
G.advance(s,6000);assert.equal(s.battle.fieldId,target.id,'An expired but protected target can still be encountered');
const enemy=structuredClone(s.battle.enemy),battleId=s.battle.id;
s.nextNearbySpawn=s.nextRareSpawn=8000;G.advance(s,8000);
assert.equal(s.battle.id,battleId);assert.deepEqual(s.battle.enemy,enemy,'Spawning cannot replace or damage the battle opponent');
assert.equal(s.fieldWilds.length,4,'Battle enemy occupies the fifth slot');

// A selected target survives trimming of an old over-capacity save.
const legacy=make();fill(legacy,12);delete legacy.fieldWilds[0].spawnedAt;
legacy.fieldWilds[0].expiresAt=2000;legacy.huntTargetId='old-0';
const migrated=G.migrate(legacy,1000);
assert.equal(migrated.fieldWilds.length,5);assert(migrated.fieldWilds.some(w=>w.id==='old-0'));
assert.deepEqual(G.migrate(migrated,1000).fieldWilds,migrated.fieldWilds,'Migration is idempotent');
const replay=make();fill(replay);assert.equal(G.visibleFieldWilds(replay,1000,1).length,4,'Final faint playback reserves a fifth visible slot');

// Cancellation releases protection and permits normal expiry again.
G.apply(reopened,'cancel',{},5000);G.advance(reopened,5000);
assert.equal(reopened.huntTargetId,null);assert(!reopened.fieldWilds.some(w=>w.id===target.id));

// An unsuccessful spawn roll does not remove an existing sighting.
const N=createEngine(D,{...C,fieldWilds:{...C.fieldWilds,spawnChance:0,rareSpawnChance:0}},W);
const noSpawn=make();fill(noSpawn);noSpawn.nextNearbySpawn=noSpawn.nextRareSpawn=2000;
const ids=noSpawn.fieldWilds.map(w=>w.id);N.advance(noSpawn,2000);
assert.deepEqual(noSpawn.fieldWilds.map(w=>w.id),ids);assert.equal(noSpawn.events.filter(e=>e.kind==='sighting').length,0);
console.log('PASS five wild slots: scheduled near/rare FIFO, protected travel/expiry/encounter, battle reservation and identity, legacy migration, final playback, cancellation and failed rolls');
