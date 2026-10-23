import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import '../src/client/pokemon-animator.js';
import '../src/client/move-effects.js';
const base='public/',manifest=JSON.parse(fs.readFileSync(base+'combat/manifest.json'));
assert.equal(manifest.sourceCommit,'0250bd6e62029bb896276a7f6bcb2385ed1a02f0');
assert.deepEqual(manifest.coverage.animatedSpecies,[749,915,940]);
assert.deepEqual(manifest.coverage.starterFallback,[318]);
assert.deepEqual(manifest.coverage.canonicalBattleBacks,[]);
for(const item of manifest.files){
 assert(item.path.startsWith('combat/')&&!item.path.includes('..'));
 const data=fs.readFileSync(base+item.path);
 assert.equal(data.length,item.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),item.sha256,item.path);
 assert.equal(data.toString('hex',0,8),'89504e470d0a1a0a');
}
const context=vm.createContext({});vm.runInContext(fs.readFileSync(base+'combat/manifest.js','utf8'),context);
assert.equal(JSON.stringify(context.PoketourCombatAssets),JSON.stringify(manifest),'file:// manifest equals JSON metadata');
const Animator=globalThis.PoketourPokemonAnimator,animator=new Animator(manifest,{baseUrl:'https://example.test/poketour/assets/'});
for(const [id,species]of Object.entries(manifest.species)){
 assert(species.authors.length&&species.licenses.length);assert(!species.credits.includes('Unspecified'));
 for(const [name,a]of Object.entries(species.actions)){
  if(!a.dedicated){assert.equal(name,'Faint');assert.equal(a.fallback,'Hurt');continue;}
  const png=fs.readFileSync(base+a.sheet);
  assert.equal(png.readUInt32BE(16),a.width*a.frames);assert.equal(png.readUInt32BE(20),a.height*a.rows);
  assert.equal(a.ticks.length,a.frames);assert(a.ticks.every(n=>n>0));
  for(const anchors of [a.feet,a.centers]){
   assert.equal(anchors.length,a.rows);
   for(const row of anchors){assert.equal(row.length,a.frames);for(const [x,y]of row){assert(x>=0&&x<a.width);assert(y>=0&&y<a.height);}}
  }
  assert.equal(animator.sample(+id,name,0,4).row,4);
  assert.equal(animator.sample(+id,name,a.ticks[0]*1000/60+.001,4).frame,1);
  const final=animator.sample(+id,name,a.durationMs+10,4);
  assert.equal(final.frame,name==='Walk'||name==='Idle'?0:a.frames-1);
 }
 assert.equal(animator.sample(+id,'Faint',0,0).dedicated,false);
}
assert.equal(animator.sample(318,'Attack'),null);assert.equal(animator.sample(1025,'Idle'),null);
assert.deepEqual([{x:0,y:1},{x:1,y:0},{x:0,y:-1},{x:-1,y:0}].map(to=>animator.direction({x:0,y:0},to)),[0,2,4,6]);
{
 let requests=0;const loader=new Animator(manifest,{baseUrl:'file:///C:/Game/assets/',loadImage:async url=>{requests++;assert(url.startsWith('file:///C:/Game/assets/combat/'));return {url};}});
 const a=loader.action(749,'Hurt'),b=loader.action(749,'Faint');
 assert.equal(await loader.image(a),await loader.image(b));assert.equal(requests,1,'Aliased animations share image loading');
 const draws=[],ctx={drawImage:(...args)=>draws.push(args)};const sample=loader.sample(749,'Attack',0,2);
 loader.draw(ctx,{},sample,100,80,2);assert.equal(draws.length,1);assert.equal(draws[0][5],100-sample.foot[0]*2);
 assert.equal(draws[0][6],80-sample.foot[1]*2);assert.equal(ctx.imageSmoothingEnabled,false);
 let fail=true;const retry=new Animator(manifest,{baseUrl:'https://test.invalid/',loadImage:async()=>{if(fail)throw Error('offline');return 'recovered';}});
 await assert.rejects(retry.image(a),/offline/);fail=false;assert.equal(await retry.image(a),'recovered');
}
const effects=globalThis.PoketourMoveEffects,from={x:0,y:0},to={x:100,y:20};
for(const [id,name]of [[33,'contact'],[10,'slash'],[52,'fire'],[55,'water'],[22,'grass'],[84,'electric']]){
 const move={id,power:40,class:2},def=effects.select(move);assert.equal(def.name,name);assert(def.dedicated);
 assert(effects.sample(move,def.hit,from,to).impact);assert(!effects.sample(move,def.hit,from,to,'miss').impact);
 assert(!effects.sample(move,def.hit,from,to,'immune').impact);assert(effects.sample(move,def.duration,from,to).done);
 assert.equal(effects.sample(move,def.duration,from,to).offset.x,0);
}
assert.equal(effects.select({id:99999,power:30,class:3,type:10}).name,'fire');
assert.equal(effects.select({id:99999,power:30,class:3}).dedicated,false);
assert.equal(effects.select({id:45,power:0}).name,'status');
for(const success of [false,true]){
 assert.equal(effects.captureSample(0,from,to,success).phase,'throw');
 const halfway=effects.captureSample(300,from,to,success);assert.equal(halfway.x,50);assert(halfway.y<from.y,'Ball travels in an arc');
 assert.equal(effects.captureSample(900,from,to,success).enemyOpacity,0);
 assert.equal(effects.captureSample(1400,from,to,success).phase,'shake');
 const result=effects.captureSample(2100,from,to,success);assert.equal(result.phase,success?'caught':'escaped');assert.equal(result.enemyOpacity,success?0:1);
 assert(effects.captureSample(2600,from,to,success).done);
}
console.log('PASS combat assets: 3 species, 45 unchanged PNGs/hashes, XML dimensions/timing/anchors, directions, explicit fallbacks/credits, file manifest, local paths/load retry and selected move effects');
