import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createEngine} from '../src/shared/engine.mjs';
import {routePlan} from '../src/shared/world.mjs';
import {createFootRouter} from '../src/shared/routing.mjs';
const read=name=>JSON.parse(fs.readFileSync('dist/client/'+name));
const D=read('pokemon-data.json'),C=read('game-settings.json'),W=read('world-seed.json');
const router=createFootRouter(read('foot-graph.json'));
const normal=createEngine(D,{...C,travelSpeedMultiplier:1},W),fast=createEngine(D,C,W);
assert.equal(C.travelSpeedMultiplier,10);
const state=normal.migrate(null,1000,42);
normal.apply(state,'demo',{},1000);normal.apply(state,'starter',{id:749},1000);
for(const [mode,speciesId] of [['walk',749],['ground',750],['air',941],['water',319]]){
 const s=structuredClone(state);s.player.party=[normal.newPokemon(s,speciesId,30,1000)];
 // A simple real polygon fixture exercises both walking segments of a water route.
 let target='park-olympic',a=normal,b=fast,r=router;
 if(mode==='water'){
  const world={...W,features:[{properties:{kind:'water'},geometry:{type:'Polygon',coordinates:[[[127.1,37.51],[127.12,37.51],[127.12,37.52],[127.1,37.52],[127.1,37.51]]]}}]};
  a=createEngine(D,{...C,travelSpeedMultiplier:1},world);b=createEngine(D,C,world);
  s.game.coord=[127.0999,37.515];target={coord:[127.1201,37.515]};
  r={route:(x,y)=>({geometry:[x,y],distanceM:a.distance(x,y),startGap:0,endGap:0})};
 }
 const before=await routePlan(a,s,target,mode,r),after=await routePlan(b,s,target,mode,r);
 assert.deepEqual(after.geometry,before.geometry);assert.equal(after.distanceM,before.distanceM);
 assert(Math.abs(after.durationMs-before.durationMs/10)<=1,mode);
 for(let i=0;i<(before.segments?.length||0);i++)assert.equal(after.segments[i].durationMs,before.segments[i].durationMs/10);
}
// Run the production label placer with crowded names and map edges, in both layouts.
const ui=fs.readFileSync('src/client/game-ui.js','utf8');
const fn=ui.slice(ui.indexOf('function layoutMapLabels(){'),ui.indexOf('function syncMap(){'));
for(const [width,height] of [[576,244],[332,500]]){
 const markers=Array.from({length:12},(_,i)=>({place:{id:String(i),name:'롯데월드몰 · 에비뉴엘 월드타워점',coord:[i%4*65+10,Math.floor(i/4)*55+15]},element:{style:{display:'flex'}},label:{style:{}}}));
 const context=vm.createContext({map:{project:p=>({x:p[0],y:p[1]}),getContainer:()=>({clientWidth:width,clientHeight:height})},game:null,markers,selected:null,displayBattle:()=>null,mapView:null});
 vm.runInContext(fn+'\nlayoutMapLabels();',context);
 const boxes=[];
 for(const m of markers){if(m.label.style.display!=='block')continue;const s=m.label.style;
  const box={x:parseFloat(s.left)+m.place.coord[0]-10,y:parseFloat(s.top)+m.place.coord[1],w:parseFloat(s.width),h:parseFloat(s.height)};
  assert(box.x>=0&&box.y>=0&&box.x+box.w<=width&&box.y+box.h<=height);
  for(const b of boxes)assert(!(box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y));
  boxes.push(box);
 }
 assert(boxes.length>0);
}
console.log('PASS test travel: identical routes at 10x speed including water segments; label placement stays inside both canvases without overlaps (geometry, not browser rendering)');
