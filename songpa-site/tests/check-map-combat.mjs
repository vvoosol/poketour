import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createEngine} from '../src/shared/engine.mjs';
import '../src/client/pokemon-animator.js';
import '../src/client/move-effects.js';
import '../src/client/map-combat-view.js';
const manifest=JSON.parse(fs.readFileSync('public/combat/manifest.json'));
const calls=[];
const context={clearRect(){},save(){},restore(){},drawImage(...args){calls.push(['sprite',...args]);},fillRect(...args){calls.push(['effect',...args]);},beginPath(){},moveTo(){},lineTo(){},stroke(){},strokeRect(){},measureText:t=>({width:t.length*8}),strokeText(){},fillText:t=>calls.push(['text',t])};
const canvas=()=>({getContext:()=>context,setAttribute(){},classList:{toggle(){}},dataset:{},remove(){this.removed=true;}});
let clock=1000,scale=1;
const animator=new PoketourPokemonAnimator(manifest,{baseUrl:'file:///C:/Game/assets/',loadImage:async url=>({url})});
const view=new PoketourMapCombatView({animator,effects:PoketourMoveEffects,createCanvas:canvas,clock:()=>clock});
function actor(uid,id,x,y,role='wild'){
 const element={x,y,style:{},clientWidth:54,clientHeight:54,children:[],append(c){this.children.push(c);},classList:{add(){}},getBoundingClientRect(){return {x:(this.x-27+(parseFloat(this.style.translate)||0))*scale+10,y:(this.y-27+(parseFloat(this.style.translate?.split(' ')[1])||0))*scale+20,width:54*scale,height:54*scale};}};
 return {element,img:{style:{}},health:{style:{}},model:{uid,speciesId:id,hp:200,maxHp:200},coord:[x,y],role,inBattle:true,moving:false};
}
const a=actor('ally',749,120,130,'ally'),b=actor('foe',915,175,130);
view.bind('a',a);view.bind('b',b);view.bind('a',a);assert.equal(a.element.children.length,1,'One canvas per stable marker');
let width=336,height=504;
const draw=(packet=null)=>view.render({view:packet,move:{id:33,power:40,class:2,name:'몸통박치기'},project:([x,y])=>({x,y}),viewport:{width,height,rect:{x:10,y:20,width:width*scale}},context,time:clock});
draw();await Promise.resolve();draw();assert.equal(a.img.style.opacity,'0','Loaded frame replaces the static image');
assert.equal(view.actors.get('a').canvas.dataset.animated,'true');
const fact={type:'attack',auto:true,actor:'ally',target:'foe',result:'hit'},packet={id:1,fact,scene:{ally:a.model,enemy:b.model},duration:870,hitAt:350,elapsed:0,damage:{before:200,after:190}};
draw(packet);assert.equal(view.actors.get('a').canvas.dataset.action,'Attack');assert(Math.hypot(view.actors.get('a').point.x-view.actors.get('b').point.x,view.actors.get('a').point.y-view.actors.get('b').point.y)>=75.99,'Nearby battle sprites retain visible separation at a wide zoom');
packet.elapsed=350;draw(packet);await Promise.resolve();draw(packet);
assert.equal(view.actors.get('b').canvas.dataset.action,'Hurt');assert.equal(view.actors.get('a').canvas.dataset.frame,String(manifest.species[749].actions.Attack.hitFrame),'Attack frame meets impact time');
assert(calls.some(c=>c[0]==='text'&&c[1]==='−10'));
const sequence=structuredClone(packet);sequence.id=2;sequence.fact.result='miss';calls.length=0;draw(sequence);
assert.equal(view.actors.get('b').canvas.dataset.action,'Idle');assert(calls.some(c=>c[0]==='text'&&c[1]==='빗나감'));
assert(!calls.some(c=>c[0]==='effect'),'A missed physical attack has no impact burst');
for(const success of [false,true]){
 const capture={id:20,fact:{type:'capture',auto:true,actor:'ally',target:'foe',success,ball:'poke-ball'},scene:{ally:a.model,enemy:b.model},duration:2600,elapsed:1000};
 calls.length=0;draw(capture);assert.equal(view.actors.get('b').pose.opacity,0);assert(calls.some(c=>c[0]==='effect'),'Capture draws the ball on the map');
 capture.elapsed=2100;draw(capture);assert.equal(view.actors.get('b').pose.opacity,success?0:1);assert(calls.some(c=>c[0]==='text'&&c[1]===(success?'잡았다!':'잡히지 않았다!')));
}
{
 // A camera pan and an enclosing 2x CSS scale must not detach effects/HP.
 const before=view.actors.get('a').point;scale=2;draw(packet);assert.deepEqual(view.actors.get('a').point,before);
 a.element.x+=30;draw(packet);assert.equal(view.actors.get('a').point.x,before.x+30);
 const boxes=draw(packet).boxes;
 assert(!boxes.some((p,i)=>boxes.slice(i+1).some(q=>p.x<q.x+q.w&&p.x+p.w>q.x&&p.y<q.y+q.h&&p.y+p.h>q.y)));
 width=576;height=244;draw(packet);assert(view.actors.get('b').label,'Visible actor has a local HP label');
}
{
 const fallback=actor('fallback',318,250,130);view.bind('fallback',fallback);
 draw();assert.equal(fallback.img.style.opacity,'1','Missing species stays visible using its original PNG');
 b.model.hp=0;draw({id:3,fact:{type:'faint',auto:true,target:'foe'},scene:{ally:a.model,enemy:b.model},duration:450,elapsed:225});
 assert.equal(view.actors.get('b').pose.opacity,.5);
 draw({id:4,fact:{type:'end',auto:true},scene:{ally:a.model,enemy:b.model},duration:250,elapsed:0});
 assert.equal(view.actors.get('b').pose.opacity,.5,'Faint state survives the end packet');
 const old=view.actors.get('b').canvas;view.remove('b');assert(old.removed);assert(!view.actors.has('b'));
 fallback.element.x=2000;draw();assert.equal(fallback.health.style.visibility,'hidden','Offscreen monsters cannot pin stray HP bars to the edge');
}
// Reproduce six bodies piled onto the trainer, including every map corner.
scale=1;
for(const [w,h]of [[336,504],[576,244]])for(const spot of [{x:w/2,y:h/2},{x:6,y:6},{x:w-6,y:6},{x:6,y:h-6},{x:w-6,y:h-6}]){
 const crowded=new PoketourMapCombatView({animator,effects:PoketourMoveEffects,createCanvas:canvas});
 const bodies=Array.from({length:6},(_,i)=>actor('dense-'+i,i===0?749:318,spot.x,spot.y,i===0?'ally':'wild'));
 for(const [i,body]of bodies.entries()){body.inBattle=false;body.element.style.transform='unchanged outer placement';crowded.bind('dense-'+i,body);}
 const original=JSON.stringify(bodies.map(b=>b.coord));let moved=false,walked=false,previous=null;
 for(let time=0;time<=8400;time+=700){
  const out=crowded.render({project:([x,y])=>({x,y}),trainer:spot,viewport:{width:w,height:h,rect:{x:10,y:20,width:w}},time});
  for(const [i,body]of out.actors.entries()){
   assert(Math.hypot(body.hostOffset.x,body.hostOffset.y)<450,'Spacing remains local to the geographic anchor');
   assert(Math.hypot(body.point.x-spot.x,body.point.y-spot.y)>=78,'Trainer stays clear');
   for(const other of out.actors.slice(i+1))assert(Math.hypot(body.point.x-other.point.x,body.point.y-other.point.y)>=73,'All six bodies stay separated while strolling');
   assert.equal(body.element.style.transform,'unchanged outer placement','Map placement transform is preserved');
   assert.equal(body.element.style.translate,`${body.hostOffset.x}px ${body.hostOffset.y}px`,'Button and sprite share the same display offset');
   assert(Math.abs(body.anchorPoint.x-spot.x)<1e-9,'Offsets do not feed back into the next frame');
   if(previous){const delta=Math.hypot(body.point.x-previous[i].x,body.point.y-previous[i].y);assert(delta<9,'Idle steps stay small instead of changing slots each frame');moved ||= delta>.1;}
   walked ||= body.pose.action==='Walk';
  }
  previous=out.actors.map(a=>({...a.point}));
 }
 // Small world-space changes must nudge established slots, not reshuffle them.
 for(let step=0;step<60;step++){
  for(const [i,body]of bodies.entries()){body.element.x+=Math.sin(i+step/20)*.015;body.element.y+=Math.cos(i+step/20)*.015;}
  const out=crowded.render({project:([x,y])=>({x,y}),trainer:spot,viewport:{width:w,height:h,rect:{x:10,y:20,width:w}},time:8400+step*32});
  for(const [i,body]of out.actors.entries())assert(Math.hypot(body.point.x-previous[i].x,body.point.y-previous[i].y)<3,'Slow geographic roaming must not reshuffle display slots');
  previous=out.actors.map(a=>({...a.point}));
 }
 assert(moved&&walked,'Idle Pokémon take short independent walks');assert.equal(JSON.stringify(bodies.map(b=>b.coord)),original,'Display spacing never mutates geographic coordinates');
 crowded.motionQuery={matches:true};const still=()=>crowded.render({project:([x,y])=>({x,y}),trainer:spot,viewport:{width:w,height:h,rect:{x:10,y:20,width:w}},time:clock}).actors.map(a=>({...a.point}));
 const reduced=still();clock+=1100;assert.deepEqual(still(),reduced,'Reduced motion disables idle strolls while retaining separation');
 // Move every projected geographic anchor, including the trainer, by the same
 // camera delta. Crossing any edge and returning must preserve marker offsets.
 const homeOffsets=[...crowded.actors.values()].map(a=>({...a.homeOffset}));
 let cameraX=0,cameraY=0;
 const pan=(dx,dy)=>{
  cameraX+=dx;cameraY+=dy;
  for(const body of bodies){body.element.x+=dx;body.element.y+=dy;}
  return crowded.render({project:([x,y])=>({x:x+cameraX,y:y+cameraY}),trainer:{x:spot.x+cameraX,y:spot.y+cameraY},viewport:{width:w,height:h,rect:{x:10,y:20,width:w}},time:clock}).actors;
 };
 for(const [dx,dy]of [[-w*2,0],[w*4,0],[-w*2,-h*2],[0,h*4],[0,-h*2]]){
  const result=pan(dx,dy);
  for(const [i,body]of result.entries()){
   assert(Math.hypot(body.homeOffset.x-homeOffsets[i].x,body.homeOffset.y-homeOffsets[i].y)<1e-6,'Camera drag cannot move Pokémon relative to their geographic anchors');
   assert(Math.hypot(body.point.x-reduced[i].x-cameraX,body.point.y-reduced[i].y-cameraY)<1e-6,'Sprites follow the map rather than staying inside the viewport');
   if(!body.onScreen)assert.equal(body.health.style.visibility,'hidden','Offscreen HP is not pinned to a screen edge');
  }
 }
 const returned=pan(0,0);for(const [i,body]of returned.entries())assert(Math.hypot(body.point.x-reduced[i].x,body.point.y-reduced[i].y)<1e-6,'Returning the camera restores the original visual location');
}
const read=n=>JSON.parse(fs.readFileSync('dist/client/'+n)),D=read('pokemon-data.json'),C=read('game-settings.json'),W=read('world-seed.json');
assert.equal(C.hpMultiplier,10,'Current auto HP configuration');
const legacy=createEngine(D,{...C,hpMultiplier:100},W),current=createEngine(D,C,W);
const old=legacy.migrate(null,1000,42);legacy.apply(old,'demo',{},1000);legacy.apply(old,'starter',{id:749},1000);
old.box.push(legacy.newPokemon(old,940,5,1000));old.battle={id:'old-battle',active:old.player.party[0].uid,enemy:legacy.newPokemon(old,915,5,1000),queue:[legacy.newPokemon(old,19,5,1000)],turns:0};
const all=s=>[...s.player.party,...s.box,s.battle.enemy,...s.battle.queue];
for(const p of all(old))p.hp=p.maxHp*.37;
for(const version of [3,4,5])for(const metadata of [false,true]){
 const saved=structuredClone(old);saved.version=version;
 for(const p of all(saved)){if(version===3){p.hp/=100;p.maxHp/=100;p.stats[0]/=100;}if(!metadata||version===3)delete p.hpScale;}
 const recovered=current.migrate(saved,2000);for(const [i,p]of all(recovered).entries()){
  assert.equal(p.hpScale,10);assert.equal(p.maxHp,all(old)[i].maxHp/10);assert(Math.abs(p.hp/p.maxHp-.37)<1e-12);assert.equal(p.uid,all(old)[i].uid);assert.deepEqual(p.moves,all(old)[i].moves);
 }
 assert.equal(JSON.stringify(current.migrate(recovered,3000).player.party),JSON.stringify(recovered.player.party),'No repeated HP conversion');
 current.apply(recovered,'settings',{auto:false},3001);for(const p of all(recovered)){assert.equal(p.hpScale,1);assert(Math.abs(p.hp/p.maxHp-.37)<1e-12);}
}
console.log('PASS map combat: real attack/hurt frame timing, miss, stationary map transforms, camera/scale/orientation, HP labels, image/faint/offscreen fallback; v3/4/5 100x→10x party/box/enemy/queue migrations preserve ratio/UID/PP');
