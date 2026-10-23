'use strict';
// PokéRogue's command/fight/info flow, adapted to Poketour's existing turn API.
// No Phaser, third-party battle engine, RNG or reward calculation lives here.
let manualMenu='command',manualBattleId=null,manualRefs=null,manualFramesStarted=false,manualResult=null;
function manualButton(text,fn,disabled=false){const b=button(text,fn,disabled);b.dataset.baseDisabled=String(disabled);return b;}
function startManualFrames(){if(manualFramesStarted||!window.requestAnimationFrame)return;manualFramesStarted=true;let last=0;const frame=time=>{if(!document.hidden&&tab==='battle'&&manualRefs&&time-last>=32){last=time;updateManualBattle();}window.requestAnimationFrame(frame);};window.requestAnimationFrame(frame);}
function manualOpen(menu){if(combatPlayback.playing||uiLocked())return;manualMenu=menu;manualRefs=null;renderBattle();}
async function manualSubmit(command){
 if(combatPlayback.playing||uiLocked()||game.settings.auto)return false;
 const previous=manualMenu;manualMenu='command';manualRefs=null;manualResult=null;
 const ok=await action('battle',command);
 if(!ok){manualMenu=previous;manualRefs=null;renderBattle();}return ok;
}
function manualMessage(b,p){
 const f=combatDisplay?.fact;if(!f)return manualResult?.battleId===b.id?manualResult.message:game.settings.auto?'지도 자동전투 중입니다. 직접 개입하면 기술을 고를 수 있습니다.':`${p?.name||'포켓몬'}! 무엇을 할까?`;
 const actors=[combatDisplay.scene.ally,combatDisplay.scene.enemy],actor=actors.find(x=>x?.uid===f.actor),target=actors.find(x=>x?.uid===f.target);
 if(f.type==='attack')return `${actor?.name||'포켓몬'}의 ${D.moves[f.move]?.name||'공격'}!${f.result==='miss'?' 그러나 빗나갔다!':f.result==='immune'?' 효과가 없다…':''}`;
 if(f.type==='hp')return f.after>f.before?`${target?.name||'포켓몬'}의 체력이 회복되었다!`:`${target?.name||'포켓몬'}에게 피해!`;
 if(f.type==='faint')return `${target?.name||'포켓몬'}은 쓰러졌다!`;
 if(f.type==='switch')return `가랏! ${target?.name||'포켓몬'}!`;
 if(f.type==='capture')return combatDisplay.elapsed<1750?`${C.shop[f.ball]?.name||'몬스터볼'}을 던졌다!`:f.success?`${combatDisplay.scene.enemy.name}을(를) 잡았다!`:'볼에서 나왔다! 잡히지 않았다.';
 if(f.type==='end')return f.message||'전투가 끝났다!';
 if(f.type==='item')return `${C.shop[f.item]?.name||'도구'}를 사용했다!`;
 if(f.type==='blocked')return `${actor?.name||'포켓몬'}은 움직일 수 없다!`;
 return f.message||'전투가 진행되고 있다…';
}
function manualInfo(p,side){
 const root=node('div',undefined,'turn-info turn-info-'+side),heading=node('div',undefined,'turn-info-heading'),name=node('strong',p.name),level=node('span','Lv.'+p.level);
 heading.append(name,level);const status=node('small'),bar=node('progress'),hp=node('small',undefined,'turn-hp-number');bar.max=p.maxHp;bar.value=p.hp;bar.setAttribute('aria-label',p.name+' 체력');
 root.append(heading,status,bar,hp);let exp=null;
 if(side==='ally'){exp=node('progress',undefined,'turn-exp');exp.max=100;exp.setAttribute('aria-label',p.name+' 경험치');root.append(exp);}
 return {root,name,level,status,bar,hp,exp};
}
function manualBody(p,side){
 const root=node('div',undefined,'turn-mon turn-mon-'+side),img=sprite(p),canvas=node('canvas');img.loading='eager';canvas.width=canvas.height=128;canvas.className='turn-back-canvas';canvas.setAttribute('aria-hidden','true');root.append(img,canvas);
 return {root,img,canvas,species:null};
}
function renderManualBattle(el,b,p){
 if(manualBattleId!==b.id){manualBattleId=b.id;manualMenu='command';manualRefs=null;manualResult=null;}
 const key=[b.id,p?.uid,manualMenu,game.settings.auto].join(':');
 if(manualRefs?.key===key&&el.children[0]===manualRefs.root){updateManualBattle(b,p);return;}
 const root=node('div',undefined,'turn-battle'),header=node('div',undefined,'turn-header');
 const modeButton=manualButton(game.settings.auto?'직접 개입':'자동 전투로 전환',()=>action('settings',{auto:!game.settings.auto}));header.append(node('span',b.kind==='gym'?'체육관 배틀':'야생 포켓몬 배틀'),modeButton);
 const body=node('div',undefined,'turn-body'),stage=node('div',undefined,'turn-stage');stage.setAttribute('aria-label','포켓몬 전투 무대');
 stage.append(node('div',undefined,'turn-platform turn-platform-enemy'),node('div',undefined,'turn-platform turn-platform-ally'));
 const enemy=manualBody(b.enemy,'enemy'),ally=p?manualBody(p,'ally'):null,enemyInfo=manualInfo(b.enemy,'enemy'),allyInfo=p?manualInfo(p,'ally'):null;
 stage.append(enemy.root,enemyInfo.root);if(ally)stage.append(ally.root,allyInfo.root);
 const fx=node('canvas',undefined,'turn-effects');fx.width=440;fx.height=300;fx.setAttribute('aria-hidden','true');stage.append(fx);
 const controls=node('div',undefined,'battle-controls turn-controls'),message=node('p',undefined,'turn-message');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
 const choices=node('div',undefined,'turn-choices');choices.setAttribute('aria-label','전투 명령');controls.append(message,choices);
 const open=(title,menu)=>manualButton(title,()=>manualOpen(menu));
 if(game.settings.auto){choices.append(node('p','자동 사냥 중입니다. 직접 개입하면 명령을 선택할 수 있습니다.'),manualButton('지도 보기',()=>showTab('map')));}
 else if(manualMenu==='command'){
  choices.classList.add('turn-command-grid');choices.append(open('싸운다','fight'),open('가방','bag'),open('포켓몬','party'),manualButton('도망',()=>manualSubmit({kind:'flee'})));
 }else if(manualMenu==='fight'&&p){
  const moves=node('div',undefined,'manual-moves');
  for(let i=0;i<4;i++){
   const slot=p.moves[i],move=slot&&D.moves[slot.id];
   const command=move?manualButton(move.name,()=>manualSubmit({kind:'move',move:move.id}),slot.pp<=0||!E.supportedMove(move)):manualButton('배운 기술 없음',()=>{},true);
   if(move){command.append(node('small',`${D.types[move.type]?.name||'—'} · ${move.class===2?'물리':move.class===3?'특수':'변화'}`),node('small',`PP ${slot.pp}/${move.pp} · 위력 ${move.power||'—'} · 명중 ${move.accuracy==null?'필중':move.accuracy+'%'}`));command.setAttribute('aria-label',`${move.name} PP ${slot.pp}/${move.pp} 위력 ${move.power||'없음'} 명중 ${move.accuracy??'필중'}`);}
   moves.append(command);
  }
  choices.append(moves);if(!p.moves.some(m=>m.pp>0))choices.append(manualButton('발버둥',()=>manualSubmit({kind:'move',move:165})));
 }else if(manualMenu==='bag'&&p){
  choices.append(node('strong','배틀 가방'));
  for(const [id,item]of Object.entries(C.shop))if(item.ball||['potion','super-potion','antidote'].includes(id)){
   const unavailable=!game.bag[id]||item.ball&&b.kind!=='wild'||item.heal&&p.hp>=p.maxHp||item.cure&&!p.status;
   choices.append(manualButton(`${item.name} ×${game.bag[id]||0}${item.ball&&b.kind==='wild'?' · '+(E.captureChance(b.enemy,id)*100).toFixed(1)+'%':''}`,()=>manualSubmit(item.ball?{kind:'ball',ball:id}:{kind:'item',item:id}),unavailable));
  }
 }else if(manualMenu==='party'){
  choices.append(node('strong','교체할 포켓몬'));
  for(const member of game.player.party)choices.append(manualButton(`${member.name} Lv.${member.level} · HP ${Math.ceil(member.hp)}/${member.maxHp}${member.uid===p?.uid?' · 출전 중':''}`,()=>manualSubmit({kind:'switch',uid:member.uid}),member.hp<=0||member.uid===p?.uid));
 }
 if(manualMenu!=='command'&&!game.settings.auto)choices.append(open('뒤로','command'));
 body.append(stage,controls);root.append(header,body);el.replaceChildren(root);
 manualRefs={key,root,stage,controls,choices,message,enemy,ally,enemyInfo,allyInfo,fx,modeButton,fainted:new Map(),captured:false};updateManualBattle(b,p);startManualFrames();
}
function updateManualBattle(b=displayBattle(),p=displayAlly()||game.player.party.find(x=>x.uid===b?.active)){
 const r=manualRefs;if(!r||!b)return;
 for(const [model,body,info,side]of [[b.enemy,r.enemy,r.enemyInfo,'enemy'],[p,r.ally,r.allyInfo,'ally']]){
  if(!model||!body)continue;setText(info.name,model.name);setText(info.level,'Lv.'+model.level);setText(info.status,statusNames[model.status]||'');setText(info.hp,`${Math.ceil(model.hp)} / ${model.maxHp}`);info.bar.max=model.maxHp;info.bar.value=Math.max(0,model.hp);info.bar.dataset.tone=model.hp/model.maxHp<=.2?'danger':model.hp/model.maxHp<=.5?'warning':'healthy';
  if(info.exp){const growth=D.experience[D.species[model.speciesId].growth],low=growth[model.level],high=growth[model.level+1]||low+1;info.exp.value=model.level>=100?100:Math.max(0,Math.min(100,((Number.isFinite(model.xp)?model.xp:game.player.party.find(x=>x.uid===model.uid)?.xp??low)-low)/(high-low)*100));}
  if(body.species!==model.speciesId){body.species=model.speciesId;body.img.src=D.species[model.speciesId].image;body.img.alt=model.name+(side==='ally'?' · 아군':' · 상대');}
  let back=false;
  if(side==='ally'){
   const animator=getMapView()?.animator,frame=animator?.sample(model.speciesId,'Idle',now(),4),ctx=body.canvas.getContext?.('2d');
   if(frame&&ctx){const image=mapView.images.get(frame.action.sheet);if(image){ctx.clearRect(0,0,128,128);animator.draw(ctx,image,frame,64,118,2.5);back=true;}else mapView.request(frame.action);}
  }
  body.canvas.classList.toggle('shiny-sprite',!!model.shiny);body.img.classList.toggle('shiny-sprite',!!model.shiny);body.canvas.hidden=!back;body.img.hidden=back;body.root.dataset.view=back?'back':'front';
  const f=combatDisplay?.fact,elapsed=combatDisplay?.elapsed||0,move=D.moves[f?.move]||{};let offset={x:0,y:0},opacity=1;
  if(f&&!f.auto){if(f.type==='attack'&&f.actor===model.uid){offset=PoketourMoveEffects.sample(move,elapsed,{x:0,y:0},{x:side==='ally'?100:-100,y:side==='ally'?-30:30},f.result).offset;}
   if(f.type==='attack'&&f.target===model.uid&&f.result==='hit'&&elapsed>=(combatDisplay.hitAt||300))opacity=Math.floor(elapsed/60)%2?.4:1;
   if(f.type==='faint'&&f.target===model.uid){const progress=Math.min(1,elapsed/400);r.fainted.set(model.uid,progress);opacity=1-progress;offset.y=elapsed/14;}else if(r.fainted.has(model.uid))opacity=0;
   if(side==='enemy'&&f.type==='capture'){opacity=PoketourMoveEffects.captureSample(elapsed,{x:0,y:0},{x:0,y:0},f.success).enemyOpacity;if(f.success&&elapsed>=1750)r.captured=true;}
   if(side==='enemy'&&r.captured)opacity=0;
  }
  body.root.style.transform=`translate(${offset.x}px,${offset.y}px)`;body.root.style.opacity=String(opacity);
 }
 const message=manualMessage(b,p);setText(r.message,message);r.modeButton.disabled=uiLocked();setText(r.modeButton,queuedAuto!==null?'전환 대기':game.settings.auto?'직접 개입':'자동 전투로 전환');
 const locked=combatPlayback.playing||uiLocked();for(const command of r.choices.children){if(command.tagName==='BUTTON'){command.dataset.baseDisabled??=String(!!command.disabled);command.disabled=locked||command.dataset.baseDisabled==='true';}else for(const child of command.children||[])if(child.tagName==='BUTTON'){child.dataset.baseDisabled??=String(!!child.disabled);child.disabled=locked||child.dataset.baseDisabled==='true';}}
 const ctx=r.fx.getContext?.('2d');if(ctx){const w=r.stage.clientWidth||330,h=r.stage.clientHeight||300;r.fx.width=w;r.fx.height=h;const f=combatDisplay?.fact;
  if(f&&!f.auto&&f.type==='attack'){const from=f.actor===p?.uid?{x:w*.23,y:h*.75}:{x:w*.8,y:h*.34},to=f.actor===p?.uid?{x:w*.8,y:h*.34}:{x:w*.23,y:h*.75};PoketourMoveEffects.draw(ctx,D.moves[f.move]||{},combatDisplay.elapsed,from,to,f.result);}
  if(f&&!f.auto&&f.type==='capture')PoketourMoveEffects.drawCapture(ctx,combatDisplay.elapsed,{x:w*.23,y:h*.75},{x:w*.8,y:h*.34},f.success,f.ball);
 }
}
