'use strict';
const canvas=document.getElementById('preview'),ctx=canvas.getContext('2d');
const status=document.getElementById('status'),controls=['species','action','direction','effect'].map(id=>document.getElementById(id));
const animator=new PoketourPokemonAnimator(PoketourCombatAssets,{baseUrl:new URL('../',document.baseURI)});
let started=performance.now(),generation=0,loaded=null,fallback=null,error=null;
async function change(){
 const version=++generation;loaded=null;fallback=null;error=null;started=performance.now();
 const id=+controls[0].value,sample=animator.sample(id,controls[1].value,0,+controls[2].value);
 try{
  if(sample){const image=await animator.image(sample.action);if(version===generation)loaded=image;}
  else {const image=new Image();image.src=new URL('../sprite-'+id+'.png',document.baseURI);await image.decode();if(version===generation)fallback=image;}
 }catch(e){if(version===generation)error=e.message;}
}
for(const control of controls)control.onchange=change;
document.getElementById('replay').onclick=()=>{started=performance.now();};
function frame(time){
 const elapsed=time-started,id=+controls[0].value,name=controls[1].value,direction=+controls[2].value;
 const sample=animator.sample(id,name,elapsed,direction),move={id:+controls[3].value,power:40,class:2};
 const from={x:140,y:160},to={x:420,y:160},effect=PoketourMoveEffects.sample(move,elapsed,from,to);
 ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#173524';ctx.fillRect(75,160,130,6);ctx.fillRect(375,160,90,6);
 ctx.save();if(name==='Faint')ctx.globalAlpha=Math.max(0,1-elapsed/650);
 if(sample&&loaded)animator.draw(ctx,loaded,sample,from.x+effect.offset.x,from.y+effect.offset.y,2);
 else if(fallback)ctx.drawImage(fallback,from.x-40+effect.offset.x,from.y-70+effect.offset.y,80,80);
 ctx.restore();ctx.strokeStyle='#e6e0ac';ctx.strokeRect(to.x-14,to.y-28,28,28);
 PoketourMoveEffects.draw(ctx,move,elapsed,from,{x:to.x,y:to.y-14});
 status.textContent=error||(!sample?'기존 정지 이미지와 기본 이동을 사용합니다.':sample.dedicated?`실제 동작 ${sample.frame+1}/${sample.action.frames} 프레임 · ${sample.action.rows}방향`:'전용 동작 없음 · 피격 프레임과 사라짐을 사용합니다.');
 requestAnimationFrame(frame);
}
change();requestAnimationFrame(frame);
